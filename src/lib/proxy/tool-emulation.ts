/**
 * Universal Tool Calling Emulation Layer
 * 
 * Intercepts requests containing `tools` and translates them into a system prompt
 * instruction for models/providers that do not support native tool calling.
 * 
 * Scans the response text for <tool_call> XML tags and translates it back into 
 * a native OpenAI tool_calls response.
 */

export interface EmulationState {
  hasTools: boolean;
}

/**
 * Strips tools from the request and injects a tool-calling instruction prompt.
 */
export function emulateToolsInRequest(body: any, state: EmulationState): any {
  if (!body || typeof body !== "object") return body;
  
  if (!body.tools || !Array.isArray(body.tools) || body.tools.length === 0) {
    state.hasTools = false;
    return body;
  }
  
  state.hasTools = true;
  
  const out = { ...body };
  delete out.tools;
  delete out.tool_choice;
  
  // Format the tool definitions into a clear system prompt
  let toolPrompt = "You have access to the following tools:\n";
  for (const t of body.tools) {
    if (t.type === "function" && t.function) {
      toolPrompt += `- ${t.function.name}: ${t.function.description || ""}\n`;
      toolPrompt += `  Arguments Schema: ${JSON.stringify(t.function.parameters)}\n`;
    }
  }
  toolPrompt += "\nTo use a tool, you MUST output an XML block in exactly this format:\n";
  toolPrompt += "<tool_call>{\"name\": \"tool_name\", \"arguments\": {\"arg1\": \"value1\"}}</tool_call>\n";
  toolPrompt += "Do NOT output anything else inside the tool_call block. If you use a tool, wait for the user to provide the tool result before continuing.\n";
  
  out.messages = [];
  
  // Convert tool messages and inject prompt
  const originalMessages = body.messages || [];
  
  let systemInjected = false;
  
  for (const msg of originalMessages) {
    if (msg.role === "system" || msg.role === "developer") {
      out.messages.push({
        ...msg,
        role: "system", // normalize developer → system
        content: typeof msg.content === "string" 
          ? msg.content + "\n\n" + toolPrompt
          : msg.content
      });
      systemInjected = true;
    } else if (msg.role === "tool") {
      // Map 'tool' role back to 'user' for providers that reject 'tool' role
      out.messages.push({
        role: "user",
        content: `Tool '${msg.name || "unknown"}' output:\n${msg.content}`
      });
    } else if (msg.role === "assistant" && msg.tool_calls) {
      // Map prior assistant tool calls into the conversation history as text
      let text = msg.content || "";
      for (const tc of msg.tool_calls) {
        if (tc.type === "function") {
          text += `\n<tool_call>{"name": "${tc.function.name}", "arguments": ${tc.function.arguments}}</tool_call>`;
        }
      }
      out.messages.push({
        role: "assistant",
        content: text.trim()
      });
    } else {
      out.messages.push(msg);
    }
  }
  
  if (!systemInjected && out.messages.length > 0) {
    // If no system message existed, prepend one, or inject into the first user message
    if (out.messages[0].role === "user") {
       out.messages[0].content = toolPrompt + "\n\n" + out.messages[0].content;
    } else {
       out.messages.unshift({ role: "system", content: toolPrompt });
    }
  }
  
  // Force stream: false because we cannot reliably parse XML tool blocks mid-stream without complex buffering
  out.stream = false;
  
  return out;
}

/**
 * Parses the response text to find <tool_call> blocks.
 * If found, transforms the response into an OpenAI tool_calls response.
 */
export function emulateToolsInResponse(responseJson: any, state: EmulationState): any {
  if (!state.hasTools) return responseJson;
  if (!responseJson || !responseJson.choices || !responseJson.choices.length) return responseJson;
  
  const message = responseJson.choices[0].message;
  if (!message || !message.content || typeof message.content !== "string") return responseJson;
  
  const text = message.content as string;
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  
  let match;
  const toolCalls: any[] = [];
  let newText = text;
  
  while ((match = toolCallRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && parsed.arguments) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).substr(2, 9)}`,
          type: "function",
          function: {
            name: parsed.name,
            arguments: typeof parsed.arguments === "string" ? parsed.arguments : JSON.stringify(parsed.arguments)
          }
        });
        // Remove the XML block from the text response
        newText = newText.replace(match[0], "").trim();
      }
    } catch (e) {
      // Ignore parsing errors for malformed tool calls
      console.error("[ToolEmulation] Failed to parse tool call JSON", match[1], e);
    }
  }
  
  if (toolCalls.length > 0) {
    message.content = newText || null; // OpenAI usually leaves content null if ONLY a tool is called
    message.tool_calls = toolCalls;
    responseJson.choices[0].finish_reason = "tool_calls";
  }
  
  return responseJson;
}

/**
 * Generates a fake SSE stream representing the fully loaded JSON response.
 * This is needed because we force stream=false upstream to easily parse tools,
 * but the client might still expect a streaming response.
 */
export function generateFakeStream(responseJson: any): string {
  const model = responseJson.model || "unknown";
  const id = responseJson.id || `chatcmpl-${Date.now()}`;
  
  let streamOut = "";
  
  // 1. Initial chunk
  const startChunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }]
  };
  streamOut += `data: ${JSON.stringify(startChunk)}\n\n`;
  
  const message = responseJson.choices?.[0]?.message;
  const finishReason = responseJson.choices?.[0]?.finish_reason || "stop";
  
  if (message) {
    if (message.content) {
      const contentChunk = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { content: message.content }, finish_reason: null }]
      };
      streamOut += `data: ${JSON.stringify(contentChunk)}\n\n`;
    }
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolChunk = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ 
          index: 0, 
          delta: { 
            tool_calls: message.tool_calls.map((tc: any, i: number) => ({
              index: i,
              id: tc.id,
              type: "function",
              function: tc.function
            }))
          }, 
          finish_reason: null 
        }]
      };
      streamOut += `data: ${JSON.stringify(toolChunk)}\n\n`;
    }
  }
  
  const endChunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: {}, finish_reason: finishReason }]
  };
  streamOut += `data: ${JSON.stringify(endChunk)}\n\n`;
  streamOut += `data: [DONE]\n\n`;
  
  return streamOut;
}
