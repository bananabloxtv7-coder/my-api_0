const BASE_URL = "https://my-api-0.vercel.app";

async function fetchApi(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  return JSON.parse(text);
}

async function main() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bananabloxtv7@gmail.com", password: "JooSOUner1234" })
  });
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];
  
  const provRes = await fetchApi(`${BASE_URL}/api/providers`, { headers: { "Cookie": cookie } });
  const v0Provider = provRes.providers.find(p => p.name.includes("api.v0"));
  
  const detail = await fetchApi(`${BASE_URL}/api/providers/${v0Provider.id}`, { headers: { "Cookie": cookie } });
  console.log(JSON.stringify(detail.provider, null, 2));
}
main();
