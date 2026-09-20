import { describe, expect, it, vi } from "vitest";

import { handleWorkforceImportExportRequest } from "../../supabase/functions/_shared/workforce-import/export-handler";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function encryptTestCredential(plaintext: string) {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = Number.parseInt(
      TEST_KEY_HEX.slice(index * 2, index * 2 + 2),
      16,
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    credential_ciphertext: Array.from(new Uint8Array(ciphertext)),
    credential_nonce: Array.from(nonce),
  };
}

describe("workforce import export handler", () => {
  it("returns csv without acknowledging export server-side", async () => {
    const encrypted = await encryptTestCredential("Temp-Pass-123!");
    const markExported = vi.fn().mockResolvedValue({ error: null });
    const dependencies = {
      readEnv: () => TEST_KEY_HEX,
      createUserClient: () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "user-1" } },
            error: null,
          }),
        },
        rpc: markExported,
      }),
      createServiceClient: () => ({
        rpc: async (fn: string) => {
          if (fn === "get_workforce_import_credential_export_rows") {
            return {
              data: [
                {
                  first_name: "Anna",
                  last_name: "Smith",
                  username: "anna.smith",
                  job_title: "Operator",
                  primary_unit_path: "Site > Ops",
                  ...encrypted,
                },
              ],
              error: null,
            };
          }
          return { data: null, error: new Error("unexpected rpc") };
        },
      }),
    };

    const response = await handleWorkforceImportExportRequest(
      new Request("http://localhost/functions/v1/workforce-import-export", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          importJobId: "job-1",
          organisationCode: "demo",
          exportSessionId: "session-1",
        }),
      }),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("anna.smith");
    expect(markExported).not.toHaveBeenCalled();
  });

  it("requires exportSessionId in request body", async () => {
    const response = await handleWorkforceImportExportRequest(
      new Request("http://localhost/functions/v1/workforce-import-export", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          importJobId: "job-1",
          organisationCode: "demo",
        }),
      }),
      {
        readEnv: () => undefined,
        createUserClient: () => ({
          auth: {
            getUser: async () => ({ data: { user: null }, error: null }),
          },
          rpc: vi.fn(),
        }),
        createServiceClient: () => ({ rpc: vi.fn() }),
      },
    );

    expect(response.status).toBe(400);
  });
});
