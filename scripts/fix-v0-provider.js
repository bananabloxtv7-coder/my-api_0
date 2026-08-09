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
  console.log("=== 1. Logging In ===");
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

  console.log("=== 2. Fetching Providers ===");
  const provRes = await fetchApi(`${BASE_URL}/api/providers`, {
    headers: { "Cookie": cookie }
  });
  
  const v0Provider = provRes.data.providers.find(p => p.name.includes(".api.v0") || p.name.includes("api.v0."));
  if (!v0Provider) {
    console.error("Could not find v0 provider.");
    console.log("Providers found:", provRes.data.providers.map(p => p.name));
    return;
  }
  
  console.log("Found v0 provider:", v0Provider.id, v0Provider.name);

  console.log("=== 3. Updating Provider Settings ===");
  const updateRes = await fetchApi(`${BASE_URL}/api/providers/${v0Provider.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Cookie": cookie },
    body: JSON.stringify({
      baseUrl: "https://api.v0.dev",
      protocol: "v0"
    })
  });
  console.log("Update status:", updateRes.status, updateRes.data.error || "OK");

  console.log("=== 4. Deleting Existing Endpoints ===");
  for (const ep of v0Provider.endpoints) {
    const delRes = await fetchApi(`${BASE_URL}/api/providers/${v0Provider.id}/endpoints/${ep.id}`, {
      method: "DELETE",
      headers: { "Cookie": cookie }
    });
    console.log(`Deleted endpoint ${ep.type} (${ep.path}):`, delRes.status);
  }

  console.log("=== 5. Adding Correct Chat Endpoint ===");
  const addRes = await fetchApi(`${BASE_URL}/api/providers/${v0Provider.id}/endpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookie },
    body: JSON.stringify({
      type: "chat",
      path: "/v1/chats",
      method: "POST"
    })
  });
  console.log("Add endpoint status:", addRes.status, addRes.data.error || "OK");
}

main().catch(console.error);
