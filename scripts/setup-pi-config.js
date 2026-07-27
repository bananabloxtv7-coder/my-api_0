const fs = require("fs");
const path = require("path");
const os = require("os");

const homeDir = os.homedir();
const piAgentDir = path.join(homeDir, ".pi", "agent");

if (!fs.existsSync(piAgentDir)) {
  fs.mkdirSync(piAgentDir, { recursive: true });
}

const MASTER_KEY = "gw_c5b62e_2sML7pyPjH7LzKXU27qicm-X0kvULPG9";
const BASE_URL = "https://my-api-0.vercel.app/v1";

// 1. Configure custom provider "smart-gateway" in ~/.pi/agent/models.json
const modelsJsonPath = path.join(piAgentDir, "models.json");
let modelsConfig = { providers: {} };

if (fs.existsSync(modelsJsonPath)) {
  try {
    modelsConfig = JSON.parse(fs.readFileSync(modelsJsonPath, "utf8"));
  } catch {}
}

modelsConfig.providers = modelsConfig.providers || {};

// Add dedicated custom provider "smart-gateway"
modelsConfig.providers["smart-gateway"] = {
  baseUrl: BASE_URL,
  api: "openai-completions",
  apiKey: MASTER_KEY,
  compat: {
    supportsUsageInStreaming: false,
    supportsReasoningEffort: true
  },
  models: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini (CometAPI)",
      contextWindow: 128000,
      maxTokens: 16384
    },
    {
      id: "gpt-5.6-sol",
      name: "GPT-5.6 Sol (CometAPI)",
      reasoning: true,
      contextWindow: 272000,
      maxTokens: 32768,
      compat: {
        supportsUsageInStreaming: false
      }
    }
  ]
};

// Also keep the built-in openai override for maximum compatibility
modelsConfig.providers.openai = {
  baseUrl: BASE_URL,
  compat: {
    supportsUsageInStreaming: false
  }
};

fs.writeFileSync(modelsJsonPath, JSON.stringify(modelsConfig, null, 2));
console.log("✅ Added custom provider 'smart-gateway' to ~/.pi/agent/models.json");

// 2. Configure auth.json with our Master Key for both custom provider and openai
const authJsonPath = path.join(piAgentDir, "auth.json");
let authConfig = {};

if (fs.existsSync(authJsonPath)) {
  try {
    authConfig = JSON.parse(fs.readFileSync(authJsonPath, "utf8"));
  } catch {}
}

authConfig["smart-gateway"] = {
  type: "api_key",
  key: MASTER_KEY
};

authConfig.openai = {
  type: "api_key",
  key: MASTER_KEY
};

fs.writeFileSync(authJsonPath, JSON.stringify(authConfig, null, 2), { mode: 0o600 });
console.log("✅ Updated ~/.pi/agent/auth.json for 'smart-gateway'");

console.log("\n=======================================================");
console.log("🎉 Dedicated Custom Provider Configured!");
console.log("You can now run either:");
console.log("   pi --provider smart-gateway --model gpt-4o-mini");
console.log("or:");
console.log("   pi --model gpt-4o-mini");
console.log("=======================================================");
