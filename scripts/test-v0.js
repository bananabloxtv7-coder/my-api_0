const BASE_URL = "https://my-api-0.vercel.app";

async function main() {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer gw_c5b62e_2sML7pyPjH7LzKXU27qicm-X0kvULPG9"
    },
    body: JSON.stringify({
      model: "claude-fable-5", // one of the models on the v0 provider
      messages: [{ role: "user", content: "hello!" }]
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Headers:", res.headers);
  console.log("Body:", text);
}
main();
