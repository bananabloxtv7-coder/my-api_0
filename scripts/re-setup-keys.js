const BASE_URL = "https://my-api-0.vercel.app";

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
  console.log("=== 1. Logging In as bananabloxtv7@gmail.com ===");
  const loginRes = await fetchApi(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bananabloxtv7@gmail.com", password: "JooSOUner1234" })
  });

  const setCookieHeader = loginRes.headers.get("set-cookie");
  if (!setCookieHeader) {
    console.error("Login failed:", loginRes.status, loginRes.data);
    return;
  }

  const cookie = setCookieHeader.split(";")[0];
  console.log("✅ Logged in successfully!");

  console.log("=== 2. Re-setting Up CometAPI keys ===");
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

  console.log("Quick-Setup Status:", setupRes.status, setupRes.data);
  const providerId = setupRes.data?.provider?.id;

  if (providerId) {
    console.log("=== 3. Registering Models (gpt-4o-mini & gpt-5.6-sol) ===");
    await fetchApi(`${BASE_URL}/api/providers/${providerId}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ name: "gpt-4o-mini" })
    });

    const solRes = await fetchApi(`${BASE_URL}/api/providers/${providerId}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ name: "gpt-5.6-sol" })
    });
    console.log("Registered gpt-5.6-sol:", solRes.status, solRes.data);
  }

  console.log("=== 4. Testing Gateway with Master Key ===");
  const chatRes = await fetchApi(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer gw_c5b62e_2sML7pyPjH7LzKXU27qicm-X0kvULPG9"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }]
    })
  });

  console.log("Test Proxy Status:", chatRes.status);
  console.log("Test Proxy Output:", JSON.stringify(chatRes.data, null, 2));
}

main().catch(console.error);
