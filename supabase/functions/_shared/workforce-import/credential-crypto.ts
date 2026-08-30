const ENCRYPTION_KEY_ENV = "CREDENTIAL_ENCRYPTION_KEY";

function decodeEncryptionKey(rawKey: string): Uint8Array {
  const trimmed = rawKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let index = 0; index < 32; index += 1) {
      bytes[index] = Number.parseInt(
        trimmed.slice(index * 2, index * 2 + 2),
        16,
      );
    }
    return bytes;
  }

  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (bytes.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  return bytes;
}

export async function encryptCredential(
  plaintext: string,
  readEnv: (name: string) => string | undefined,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const rawKey = readEnv(ENCRYPTION_KEY_ENV);
  if (!rawKey) {
    throw new Error("Credential encryption is not configured.");
  }

  const keyBytes = decodeEncryptionKey(rawKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    encoded,
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    nonce,
  };
}

export async function decryptCredential(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  readEnv: (name: string) => string | undefined,
): Promise<string> {
  const rawKey = readEnv(ENCRYPTION_KEY_ENV);
  if (!rawKey) {
    throw new Error("Credential encryption is not configured.");
  }

  const keyBytes = decodeEncryptionKey(rawKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

export function postgresByteaToBytes(
  value: string | Uint8Array | number[],
): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("\\x")) {
    const hex = trimmed.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  return base64ToBytes(trimmed);
}

export function bytesToPostgresBytea(bytes: Uint8Array): string {
  return `\\x${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
