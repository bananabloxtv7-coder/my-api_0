import crypto from "crypto";

/**
 * AES-256-GCM encryption for provider API keys at rest.
 * The encryption key is read from ENCRYPTION_KEY (64 hex chars = 32 bytes).
 */

const KEY_HEX = process.env.ENCRYPTION_KEY || "";

function getKey(): Buffer {
  if (KEY_HEX.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex chars (32 bytes). Set it in .env"
    );
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns a single base64 string: iv(12) || ciphertext || tag(16)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

/** Decrypt a value produced by encrypt(). */
export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** SHA-256 hex hash, used for fast lookups of master keys. */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Generate a random master API key: gw_<prefix>_<secret> */
export function generateMasterKey(): { key: string; keyPrefix: string } {
  const rand = crypto.randomBytes(24).toString("base64url");
  const prefix = crypto.randomBytes(3).toString("hex");
  const key = `gw_${prefix}_${rand}`;
  return { key, keyPrefix: `gw_${prefix}` };
}

/** Last 4 characters for safe display preview. */
export function preview(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(-4);
}
