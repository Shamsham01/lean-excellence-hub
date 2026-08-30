import { describe, expect, it } from "vitest";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function importAesKey(hexKey: string) {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = Number.parseInt(hexKey.slice(index * 2, index * 2 + 2), 16);
  }
  expect(bytes.length).toBe(32);
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptCredential(plaintext: string, key: CryptoKey) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  expect(nonce.length).toBe(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { nonce, ciphertext: new Uint8Array(ciphertext) };
}

async function decryptCredential(
  ciphertext: ArrayBuffer,
  nonce: Uint8Array,
  key: CryptoKey,
) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce as Uint8Array<ArrayBuffer> },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

describe("workforce import credential crypto invariants", () => {
  it("decodes a 32-byte AES-GCM key from hex", async () => {
    const key = await importAesKey(TEST_KEY_HEX);
    expect(key.algorithm.name).toBe("AES-GCM");
  });

  it("uses a fresh 12-byte nonce for every encryption", async () => {
    const key = await importAesKey(TEST_KEY_HEX);
    const first = await encryptCredential("TempPass123!", key);
    const second = await encryptCredential("TempPass123!", key);
    expect(first.nonce).not.toEqual(second.nonce);
  });

  it("round-trips plaintext and rejects tampering", async () => {
    const key = await importAesKey(TEST_KEY_HEX);
    const encrypted = await encryptCredential("TempPass123!", key);
    const plaintext = await decryptCredential(
      encrypted.ciphertext.buffer.slice(
        encrypted.ciphertext.byteOffset,
        encrypted.ciphertext.byteOffset + encrypted.ciphertext.byteLength,
      ),
      encrypted.nonce,
      key,
    );
    expect(plaintext).toBe("TempPass123!");

    const tampered = new Uint8Array(encrypted.ciphertext);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = (tampered[lastIndex] ?? 0) ^ 0xff;

    await expect(
      decryptCredential(
        tampered.buffer.slice(
          tampered.byteOffset,
          tampered.byteOffset + tampered.byteLength,
        ),
        encrypted.nonce,
        key,
      ),
    ).rejects.toThrow();
  });

  it("includes an authentication tag in the ciphertext payload", async () => {
    const key = await importAesKey(TEST_KEY_HEX);
    const encrypted = await encryptCredential("abc", key);
    expect(encrypted.ciphertext.length).toBeGreaterThan(3);
  });
});
