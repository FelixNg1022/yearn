import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { config } from "./config.ts";

const ALGO = "aes-256-gcm";

export interface Encrypted {
  iv: string;  // 12-byte nonce, hex
  ct: string;  // ciphertext, hex
  at: string;  // 16-byte auth tag, hex
}

function loadKey(): Buffer {
  const key = Buffer.from(config.birthEncryptionKey(), "base64");
  if (key.byteLength !== 32) {
    throw new Error(`birthEncryptionKey must decode to 32 bytes, got ${key.byteLength}`);
  }
  return key;
}

export function encrypt(plaintext: string, key?: Buffer): Encrypted {
  const k = key ?? loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, k, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const at = cipher.getAuthTag();
  return { iv: iv.toString("hex"), ct: ct.toString("hex"), at: at.toString("hex") };
}

export function decrypt(enc: Encrypted, key?: Buffer): string {
  const k = key ?? loadKey();
  const decipher = createDecipheriv(ALGO, k, Buffer.from(enc.iv, "hex"));
  decipher.setAuthTag(Buffer.from(enc.at, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ct, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptToJson(plaintext: string): string {
  return JSON.stringify(encrypt(plaintext));
}

export function decryptFromJson(json: string): string {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== "object" || parsed === null ||
    typeof (parsed as Record<string, unknown>).iv !== "string" ||
    typeof (parsed as Record<string, unknown>).ct !== "string" ||
    typeof (parsed as Record<string, unknown>).at !== "string"
  ) {
    throw new Error("decryptFromJson: malformed ciphertext envelope");
  }
  return decrypt(parsed as Encrypted);
}
