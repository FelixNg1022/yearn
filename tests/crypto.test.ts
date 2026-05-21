import { describe, test, expect } from "bun:test";
import { encrypt, decrypt, encryptToJson, decryptFromJson } from "../src/crypto.ts";

const TEST_KEY = Buffer.alloc(32); // 32 zero bytes — safe for testing

describe("crypto", () => {
  test("encrypt then decrypt returns original string", () => {
    const plain = "2002-10-22T18:00:00+08:00";
    const enc = encrypt(plain, TEST_KEY);
    const dec = decrypt(enc, TEST_KEY);
    expect(dec).toBe(plain);
  });

  test("different encryptions produce different ciphertexts (random IV)", () => {
    const plain = "2002-10-22T18:00:00+08:00";
    const a = encrypt(plain, TEST_KEY);
    const b = encrypt(plain, TEST_KEY);
    expect(a.ct).not.toBe(b.ct);
  });

  test("JSON roundtrip", () => {
    const plain = "1990-01-01T00:00:00+00:00";
    const enc = encrypt(plain, TEST_KEY);
    const json = JSON.stringify(enc);
    const dec = decrypt(JSON.parse(json), TEST_KEY);
    expect(dec).toBe(plain);
  });

  test("encryptToJson / decryptFromJson round-trip using env key", () => {
    // Set a test key so config.birthEncryptionKey() doesn't throw
    process.env.BIRTH_ENCRYPTION_KEY = TEST_KEY.toString("base64");
    const plain = "2000-06-15T12:00:00+05:30";
    const json = encryptToJson(plain);
    expect(typeof json).toBe("string");
    const dec = decryptFromJson(json);
    expect(dec).toBe(plain);
  });
});
