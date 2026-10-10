# Security notes

The OpenJEV credential previously pasted into chat is considered compromised and must be revoked at the OpenJEV provider immediately. Do not reuse it.

Provision a new `OPENJEV_API_KEY` only in server-side secret storage for the deployed proxy. Never place it in browser code, `VITE_*` variables, local storage, query parameters, logs, test fixtures, or release artifacts.

Run `npm run check:secrets` before packaging. The browser client is intentionally unable to call OpenJEV directly and falls back to deterministic Survivor decisions when the proxy is unavailable.
