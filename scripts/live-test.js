const https = require("https");
const http = require("http");

async function fetchApi(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return {
    status: res.status,
    headers: res.headers,
    data: parsed
  };
}

async function main() {
  const BASE_URL = "https://my-api-0.vercel.app";
  let cookie = "";

  console.log("=== 1. Registering Account ===");
  const regRes = await fetchApi(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bananabloxtv7@gmail.com", password: "JooSOUner1234", name: "Youssef" })
  });
  console.log("Register Response:", regRes.status, regRes.data);
  
  console.log("=== 2. Logging In ===");
  const loginRes = await fetchApi(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bananabloxtv7@gmail.com", password: "JooSOUner1234" })
  });
  console.log("Login Response:", loginRes.status, loginRes.data);
  
  const setCookieHeader = loginRes.headers.get("set-cookie");
  if (setCookieHeader) {
    cookie = setCookieHeader.split(";")[0];
  } else {
    console.error("Failed to get session cookie!");
    return;
  }

  console.log("=== 3. Setting Up CometAPI via Quick-Setup ===");
  const setupRes = await fetchApi(`${BASE_URL}/api/providers/quick-setup`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({
      template: "cometapi",
      apiKey: "sk-B93jURXOiXzoKGmcBqbLGYiX0kxZmKsDmAOJuUHZwonviyr9",
      additionalKeys: [
        "sk-huzWg7xQ3V4uTeYZ8aUaV62eaUqZg34r7sawBDSxCGWWnquL",
        "sk-z9ViGqFnDnpUPAna3UHzD7rrwHiCynuNklDxaZWvW7ThWDoS",
        "sk-MdoC2BNmIZtlzCZIRYo7SDw3lw2VfHKj4pPzRvS4JIpItHcU"
      ]
    })
  });
  console.log("Quick-Setup Response:", setupRes.status, setupRes.data);

  let providerId = setupRes.data?.provider?.id;
  
  if (!providerId) {
    const providersRes = await fetchApi(`${BASE_URL}/api/providers`, {
      method: "GET",
      headers: { "Cookie": cookie }
    });
    if (providersRes.status === 200 && providersRes.data.providers) {
      const comet = providersRes.data.providers.find(p => p.name === "CometAPI");
      if (comet) providerId = comet.id;
    }
  }

  if (providerId) {
    console.log("=== 4. Adding Cheap Model (gpt-4o-mini) ===");
    const modelRes = await fetchApi(`${BASE_URL}/api/providers/${providerId}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ name: "gpt-4o-mini" })
    });
    console.log("Add Model Response:", modelRes.status, modelRes.data);
  }

  console.log("=== 5. Generating Master API Key ===");
  const masterKeyRes = await fetchApi(`${BASE_URL}/api/master-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookie },
    body: JSON.stringify({ name: "Pi-Agent-Key" })
  });
  console.log("Master Key Response:", masterKeyRes.status, masterKeyRes.data);
  
  if (masterKeyRes.status === 200 || masterKeyRes.status === 201) {
    const gwKey = masterKeyRes.data.plainKey || masterKeyRes.data.key?.plainKey || masterKeyRes.data.key;
    console.log("\n✅ ALL SETUP DONE!");
    console.log("GATEWAY URL:", BASE_URL + "/v1");
    console.log("MASTER API KEY:", gwKey);
    console.log("\n=== 6. Testing gateway proxy with 'hi' ===");
    
    const chatRes = await fetchApi(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gwKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }]
      })
    });
    
    console.log("Proxy Status:", chatRes.status);
    console.log("Proxy Response:", JSON.stringify(chatRes.data, null, 2));
  } else {
    console.log("Failed to create master key.");
  }
}

main().catch(console.error);
