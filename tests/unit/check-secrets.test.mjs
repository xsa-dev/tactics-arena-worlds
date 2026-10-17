import { describe, expect, it } from "vitest";
import { scanEntriesForSecrets } from "../../scripts/check-secrets.mjs";

describe("secret scanner", () => {
  it("allows clean source and built files", () => {
    expect(
      scanEntriesForSecrets([
        { path: "src/main.ts", content: "console.log('clean');" },
        {
          path: "dist/index.html",
          content: "<!doctype html><title>ok</title>",
        },
      ]),
    ).toEqual([]);
  });

  it("rejects OpenJEV keys, Android keystores, keystore/dApp Store password assignments, and 64-byte Solana keypair arrays", () => {
    const ojKey = ["oj", "live", "1234567890abcdefghij1234"].join("_");
    const keystoreVar = ["SOLANA_MOBILE", "KEYSTORE_PASSWORD"].join("_");
    const dappVar = ["DAPP_STORE", "API_KEY"].join("_");
    const keypairJson = `[${Array.from({ length: 64 }, (_, i) => (i * 3) % 255).join(",")}]`;

    expect(
      scanEntriesForSecrets([{ path: "src/leak.ts", content: ojKey }]),
    ).toContain("src/leak.ts");
    expect(
      scanEntriesForSecrets([
        { path: "android/release.keystore", content: "" },
      ]),
    ).toContain("android/release.keystore");
    expect(
      scanEntriesForSecrets([{ path: "keys/upload.jks", content: "" }]),
    ).toContain("keys/upload.jks");
    expect(
      scanEntriesForSecrets([{ path: "keys/cert.p12", content: "" }]),
    ).toContain("keys/cert.p12");
    expect(
      scanEntriesForSecrets([
        { path: "publisher-keypair.json", content: "[]" },
      ]),
    ).toContain("publisher-keypair.json");
    expect(
      scanEntriesForSecrets([
        { path: ".env", content: `${keystoreVar}="supersecret123"` },
      ]),
    ).toContain(".env");
    expect(
      scanEntriesForSecrets([
        {
          path: "dist/app.js",
          content: `${dappVar}: "secret_portal_token_123"`,
        },
      ]),
    ).toContain("dist/app.js");
    expect(
      scanEntriesForSecrets([{ path: "dist/key.json", content: keypairJson }]),
    ).toContain("dist/key.json");
  });
});
