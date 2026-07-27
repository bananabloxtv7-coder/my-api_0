const keys = [
  "sk-B93jURXOiXzoKGmcBqbLGYiX0kxZmKsDmAOJuUHZwonviyr9",
  "sk-huzWg7xQ3V4uTeYZ8aUaV62eaUqZg34r7sawBDSxCGWWnquL",
  "sk-z9ViGqFnDnpUPAna3UHzD7rrwHiCynuNklDxaZWvW7ThWDoS",
  "sk-MdoC2BNmIZtlzCZIRYo7SDw3lw2VfHKj4pPzRvS4JIpItHcU"
];

async function testModel(endpoint, model, apiKey) {
  const url = `https://api.cometapi.com${endpoint}`;
  console.log(`\nTesting ${url} with model "${model}"...`);
  
  let body;
  if (endpoint.includes("responses")) {
    body = { model, input: "hi", stream: true };
  } else {
    body = { model, messages: [{ role: "user", content: "hi" }], stream: true };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text.slice(0, 300)}`);
  } catch (err) {
    console.error(`Fetch Error: ${err.message}`);
  }
}

async function main() {
  const key = keys[0];
  console.log("=== 1. Checking CometAPI Available Models (/v1/models) ===");
  try {
    const res = await fetch("https://api.cometapi.com/v1/models", {
      headers: { "Authorization": `Bearer ${key}` }
    });
    const data = await res.json();
    if (data && data.data && Array.isArray(data.data)) {
      const modelNames = data.data.map(m => m.id);
      console.log(`Found ${modelNames.length} models on CometAPI.`);
      const solModels = modelNames.filter(m => m.toLowerCase().includes("sol") || m.toLowerCase().includes("5.6") || m.toLowerCase().includes("gpt-5"));
      console.log("Matching SOL/GPT-5 models:", solModels);
    }
  } catch (err) {
    console.error("Models check failed:", err.message);
  }

  console.log("\n=== 2. Testing CometAPI Directly ===");
  await testModel("/v1/chat/completions", "gpt-4o-mini", key);
  await testModel("/v1/chat/completions", "gpt-5.6-sol", key);
  await testModel("/v1/responses", "gpt-5.6-sol", key);
}

main().catch(console.error);
