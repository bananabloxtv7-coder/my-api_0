const MASTER_KEY = "gw_c5b62e_2sML7pyPjH7LzKXU27qicm-X0kvULPG9";
const BASE_URL = "https://my-api-0.vercel.app/v1";

async function testGateway(model, stream = false) {
  console.log(`\nTesting Gateway (${BASE_URL}) with model "${model}" (stream=${stream})...`);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MASTER_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        stream
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.slice(0, 350));
  } catch (err) {
    console.error("Gateway fetch error:", err.message);
  }
}

async function main() {
  await testGateway("gpt-4o-mini", false);
  await testGateway("gpt-5.6-sol", false);
  await testGateway("gpt-5.6-sol", true);
}

main().catch(console.error);
