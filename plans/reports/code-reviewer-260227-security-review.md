# Code Review Summary — Security Review

**Date:** 2026-02-27
**Reviewer:** code-reviewer subagent
**Scope:** Security-focused audit of Node.js/Express API

---

## Scope

- **Files reviewed:** 25+ files including all key files requested
- **Lines of code analyzed:** ~3,500+ lines
- **Review focus:** Auth & access control, secrets/config exposure, input validation & injection

---

## Overall Assessment

The codebase shows reasonable security hygiene overall — JWT/API key auth is structured correctly, admin routes are gated, SQL uses parameterized queries via TypeORM and pg driver. However, **three critical/high issues** require immediate attention: a hardcoded DB password, a hardcoded fallback gateway secret, and gateway_token exposure via the SafeUser type in API responses. Additionally, the SePay webhook has a dangerous fail-open behavior in dev, and the CORS regex allows bypass.

---

## Critical Issues

### C1 — Hardcoded DB Password in Source Code
- **Severity:** CRITICAL
- **Location:** `src/db/connection.ts:39`
- **Issue:** `password: String(process.env.DB_PASSWORD || "080103")` — literal production-looking password `080103` is hardcoded as fallback. If `DB_PASSWORD` env var is unset (misconfiguration, typo), the app silently connects with this credential. The credential is also committed to git history.
- **Recommendation:** Remove hardcoded fallback entirely. Fail fast if `DB_PASSWORD` is not set:
  ```ts
  if (!process.env.DB_PASSWORD) throw new Error("DB_PASSWORD env var is required");
  password: process.env.DB_PASSWORD,
  ```
  Rotate the `080103` credential immediately if it was ever used in production.

---

### C2 — Hardcoded Default Gateway Register Secret
- **Severity:** CRITICAL
- **Location:** `src/routes/gateway-register.routes.ts:11`, `src/utils/auth-profiles-sync.util.ts:137`
- **Issue:** `const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET || "operis-gateway-register-secret"` — this endpoint (`PUT /api/gateway/register`) allows any caller to overwrite `gateway_token` and `gateway_hooks_token` for any user by email. The default secret is publicly visible in the repo. An attacker with this secret can hijack any user's gateway credentials.
- **Recommendation:** Remove the default. Require the env var or throw at startup:
  ```ts
  const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET;
  if (!REGISTER_SECRET) throw new Error("GATEWAY_REGISTER_SECRET env var is required");
  ```

---

### C3 — gateway_token Exposed in API Responses
- **Severity:** CRITICAL
- **Location:** `src/utils/sanitize.util.ts:21`, `src/core/types/entities.ts:21`
- **Issue:** `SafeUser = Omit<User, "password_hash">` — `sanitizeUser()` strips only `password_hash`, but leaves `gateway_token`, `gateway_hooks_token`, and `gateway_url` in all user-facing responses. These fields are returned via:
  - `GET /auth/me` (any authenticated user)
  - `PATCH /auth/gateway` response
  - `POST /auth/login` and `POST /auth/register` responses
  - Admin `GET /users`, `GET /users/:id`

  `gateway_token` is a bearer token granting control over the user's AI gateway. Exposing it in every login/me response is a significant credential leak.
- **Recommendation:** Add `gateway_token`, `gateway_hooks_token` to the omit list (or create a stricter public-facing type):
  ```ts
  export type SafeUser = Omit<User, "password_hash" | "gateway_token" | "gateway_hooks_token">;
  ```
  `gateway_url` can remain (non-sensitive). If the Electron client needs the token, return it only from the specific `PATCH /auth/gateway` endpoint response, not every login.

---

## High Priority Findings

### H1 — SePay Webhook: Fail-Open When Secret Not Configured
- **Severity:** HIGH
- **Location:** `src/middleware/sepay-webhook.middleware.ts:18-21`
- **Issue:**
  ```ts
  if (!SEPAY_WEBHOOK_API_KEY) {
    console.warn("No SEPAY_WEBHOOK_API_KEY configured — skipping verification");
    next(); // <-- any caller can trigger token credits
  }
  ```
  If `SEPAY_WEBHOOK_API_KEY` is not set in production, any HTTP client can POST to `/api/deposits/webhook/sepay` and trigger token credits for arbitrary users. The comment says "dev/test" but there is no environment guard.
- **Recommendation:** Either fail-closed (reject if key not configured), or add `NODE_ENV` guard:
  ```ts
  if (!SEPAY_WEBHOOK_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      res.status(200).json({ success: true }); // silent reject
      return;
    }
    next(); // dev only
    return;
  }
  ```
  Better yet: always require the key; fail startup if missing.

### H2 — Timing Attack on SePay Webhook Key Comparison
- **Severity:** HIGH
- **Location:** `src/middleware/sepay-webhook.middleware.ts:30`
- **Issue:** `if (providedKey !== SEPAY_WEBHOOK_API_KEY)` — string equality is not constant-time. An attacker can use timing to brute-force the key character by character.
- **Recommendation:** Use `crypto.timingSafeEqual`:
  ```ts
  import crypto from "node:crypto";
  const a = Buffer.from(providedKey);
  const b = Buffer.from(SEPAY_WEBHOOK_API_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { ... }
  ```

### H3 — CORS Regex Bypass via `.*` Pattern
- **Severity:** HIGH
- **Location:** `src/server.ts:53-58`
- **Issue:**
  ```ts
  const pattern = allowed.replace("*", "\\d+");
  return new RegExp(pattern).test(origin);
  ```
  The CORS check converts `http://localhost:*` to `http://localhost:\d+` and uses `RegExp.test()` without anchors (`^` / `$`). A crafted origin like `http://localhost:3000.evil.com` would match `http://localhost:\d+` because `.test()` does substring matching. Attack vector: malicious site registers a subdomain starting with `localhost:3000`.
- **Recommendation:** Add anchors:
  ```ts
  return new RegExp(`^${pattern}$`).test(origin);
  ```

### H4 — `trust proxy` Set to 2 — Potentially Inaccurate
- **Severity:** HIGH (conditional)
- **Location:** `src/server.ts:46`
- **Issue:** `app.set("trust proxy", 2)` trusts 2 proxy hops. If the actual deployment has only 1 proxy (Nginx), an attacker can forge `X-Forwarded-For` to spoof their IP, bypassing rate limiting and the `allowHostsMiddleware` IP check. The comment says "Nginx" (1 proxy) but the value is 2.
- **Recommendation:** Match the value to actual infrastructure. For single Nginx: `app.set("trust proxy", 1)`. Document the intended proxy chain.

### H5 — Image MIME Type Not Validated — Potential Content Injection
- **Severity:** HIGH
- **Location:** `src/controllers/chat-stream.controller.ts:30-36`
- **Issue:**
  ```ts
  if (img && typeof img.data === "string" && typeof img.mimeType === "string") {
    validImages.push({ data: img.data, mimeType: img.mimeType });
  }
  ```
  `mimeType` is accepted as any arbitrary string from the user. It's later embedded in a `data:${img.mimeType};base64,...` URL forwarded to the gateway. A malicious `mimeType` like `image/png\r\nX-Injected: header` could cause header injection in the gateway request. Also, `img.data` base64 length is unbounded.
- **Recommendation:**
  ```ts
  const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  if (ALLOWED_MIME_TYPES.has(img.mimeType) && img.data.length < 10_000_000) {
    validImages.push({ data: img.data, mimeType: img.mimeType });
  }
  ```

### H6 — `POST /analytics/usage` — Client-Controlled Token Deduction
- **Severity:** HIGH
- **Location:** `src/controllers/analytics.controller.ts:147-188`, `src/routes/analytics.routes.ts:86`
- **Issue:** Authenticated users can POST arbitrary `input_tokens`, `output_tokens`, `model` values to `/analytics/usage`. The server unconditionally deducts those tokens from the user's balance and records analytics. This means:
  - A user can deduct 1 token instead of 10,000 (underreporting).
  - The `model` field is user-supplied with no whitelist, polluting analytics.
  - Token deduction bypass if a user reports 0 tokens.
- **Recommendation:** This endpoint should only be called server-side or from trusted gateway with a shared secret. If client-called, validate against reasonable bounds and whitelist the `model` field.

### H7 — `POST /chat/ws-complete` — Client Reports Its Own Token Usage
- **Severity:** HIGH
- **Location:** `src/controllers/chat.controller.ts:76-124`, `src/routes/chat.routes.ts:270-274`
- **Issue:** The `wsComplete` endpoint accepts `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens` from the client body with no server-side verification. A malicious client can:
  - Report 0 tokens to avoid billing: `totalTokens = Number(usage?.total_tokens) || 0`
  - Report negative tokens (not checked)
- **Recommendation:** This is a systemic design issue. Gateway usage should be reported server-to-server. At minimum, add bounds validation: require `totalTokens > 0` and cap at a reasonable maximum. Consider verifying via the gateway API.

---

## Medium Priority Improvements

### M1 — Debug Log File Written to /tmp in Production Code
- **Severity:** MEDIUM
- **Location:** `src/routes/anthropic-proxy.routes.ts:19-21`
- **Issue:**
  ```ts
  const DEBUG_LOG = "/tmp/anthropic-proxy-debug.log";
  function debugLog(msg: string) {
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  }
  ```
  Production code writes to a world-readable `/tmp` file on every request. Log content includes model names, message lengths, and token counts — potentially revealing usage patterns. `appendFileSync` is also blocking (performance).
- **Recommendation:** Remove or gate behind `DEBUG` env var. Use the existing console logger instead.

### M2 — Unvalidated Date Inputs in Analytics
- **Severity:** MEDIUM
- **Location:** `src/controllers/analytics.controller.ts:97-98`, `src/controllers/analytics.controller.ts:361-362`
- **Issue:**
  ```ts
  const startDate = new Date(start);
  const endDate = new Date(end);
  ```
  `start` and `end` from query params are passed directly to `new Date()`. Invalid dates produce `Invalid Date` which TypeORM may handle unpredictably. No upper bound on date range means potentially expensive queries.
- **Recommendation:** Validate with a date parser and enforce maximum range (e.g., 1 year).

### M3 — Deposit `tokenAmount` Accepts Arbitrary Values
- **Severity:** MEDIUM
- **Location:** `src/controllers/deposit.controller.ts:29-54`
- **Issue:** When `type === "token"` without a `tierId`, `tokenAmount` comes directly from `req.body` with no minimum/maximum validation. A user could create a deposit order for 0 or negative tokens.
- **Recommendation:** Add validation: `tokenAmount > 0` and enforce a reasonable maximum.

### M4 — `allowHostsMiddleware` Bypass via `host` Header Substring Match
- **Severity:** MEDIUM
- **Location:** `src/middleware/allow-hosts.middleware.ts:37-43`
- **Issue:**
  ```ts
  host.toLowerCase().includes(allowed)
  ```
  `includes()` does substring matching. If `ALLOWED_HOSTS` contains `operis.vn`, a Host header of `evil-operis.vn` would pass the check.
- **Recommendation:** Use exact match or suffix match:
  ```ts
  host.toLowerCase() === allowed || host.toLowerCase().endsWith(`.${allowed}`)
  ```

### M5 — No Rate Limiting on `/analytics/usage` (Token Deduction)
- **Severity:** MEDIUM
- **Location:** `src/routes/analytics.routes.ts:86`
- **Issue:** `POST /analytics/usage` has auth but no rate limiting. A user can spam it to rapidly drain their balance (DoS on self) or test bypass conditions.
- **Recommendation:** Add rate limiting middleware similar to `loginLimiter`.

### M6 — Swagger UI Exposed Without Auth
- **Severity:** MEDIUM
- **Location:** `src/server.ts:85`
- **Issue:** `app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))` — Swagger UI is publicly accessible, exposing full API surface, request/response schemas, and example payloads. This significantly aids attackers in reconnaissance.
- **Recommendation:** Gate behind admin auth or restrict to localhost/internal network only in production.

### M7 — `error.message` Leaked in Generic Error Handler
- **Severity:** MEDIUM
- **Location:** `src/routes/openai-compat.routes.ts:379`, `src/routes/anthropic-compat.routes.ts:452`
- **Issue:**
  ```ts
  res.status(500).json({ error: { message: error.message || "Internal server error" } });
  ```
  Raw `error.message` from internal services (DB errors, network errors) is returned to the client. This can reveal internal hostnames, table names, or stack details.
- **Recommendation:** Log the full error internally; return a generic message to clients.

### M8 — DB User Fallback to Hardcoded Username
- **Severity:** MEDIUM
- **Location:** `src/db/connection.ts:37`
- **Issue:** `user: process.env.DB_USER || "duc"` — fallback to a personal username `"duc"`. Minor, but indicates the code was developed with a personal DB user and the fallback should be removed.
- **Recommendation:** Remove the fallback; require env var.

---

## Low Priority Suggestions

### L1 — `trust proxy` Value Not Documented
- **Location:** `src/server.ts:46`
- The comment says "1 proxy layer (Nginx)" but value is `2`. Either update the comment or the value.

### L2 — No `X-Content-Type-Options`, `X-Frame-Options` Security Headers
- **Location:** `src/server.ts` (global middleware)
- No security headers middleware (e.g., Helmet.js). Consider adding: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`.

### L3 — `escapeHtml` Used for DB Storage, Not Just Output
- **Location:** `src/controllers/chat.controller.ts:26`, `src/controllers/chat-stream.controller.ts:39`
- HTML-escaping is for rendering in HTML, not for DB storage. Storing `&lt;` in the DB corrupts the data and makes it impossible to render in non-HTML contexts (JSON API, mobile apps). Use parameterized queries (already done) for SQL safety; leave content un-escaped for storage.

### L4 — `GET /v1/models` Unauthenticated
- **Location:** `src/routes/openai-compat.routes.ts:392`
- Returns model list without auth. Low risk but unnecessary information disclosure.

### L5 — Uncaught Exception Handler Continues Process
- **Location:** `src/server.ts:121-128`
- `process.on("uncaughtException")` logs and continues. This can leave the app in an undefined state. Consider calling `process.exit(1)` after logging for true uncaught exceptions.

---

## Positive Observations

- JWT authentication is well-structured with proper refresh token rotation and DB-stored token hashes.
- API key hashing uses SHA-256 (no plaintext storage of keys).
- `requireRole()` / `adminMiddleware` pattern is clean and consistently applied on admin routes.
- Parameterized queries used throughout TypeORM and `pg` calls — no raw string interpolation found in SQL.
- `password_hash` is correctly stripped from `sanitizeUser()`.
- Rate limiting applied on login, register, and password change endpoints.
- SePay webhook signature verification is attempted (though with timing vulnerability).
- Anthropic OAuth tokens are encrypted at rest in the DB (AES-256-GCM).
- `.env` is properly in `.gitignore`.
- Client disconnect detection in `chat-stream.service.ts` prevents timer/resource leaks.

---

## Recommended Actions (Prioritized)

1. **IMMEDIATE:** Fix C1 — remove hardcoded `"080103"` DB password fallback and rotate credential.
2. **IMMEDIATE:** Fix C2 — remove hardcoded `"operis-gateway-register-secret"` fallback.
3. **IMMEDIATE:** Fix C3 — add `gateway_token` and `gateway_hooks_token` to `sanitizeUser()` omit list.
4. **TODAY:** Fix H1 — make SePay webhook fail-closed when secret not configured.
5. **TODAY:** Fix H2 — use `crypto.timingSafeEqual` for webhook key comparison.
6. **TODAY:** Fix H3 — add `^` and `$` anchors to CORS origin regex.
7. **THIS WEEK:** Fix H4 — verify and correct `trust proxy` value to match actual infra.
8. **THIS WEEK:** Fix H5 — whitelist image MIME types and bound base64 length.
9. **THIS WEEK:** Fix H6/H7 — add server-side validation/bounds on client-reported token usage; consider making these server-to-server only.
10. **THIS WEEK:** Fix M1 — remove or gate the debug file logger in `/tmp`.
11. **THIS MONTH:** Address M2-M8 and low-priority items.

---

## Metrics

- **Type Coverage:** N/A (not run — no tsc errors visible from static review)
- **Test Coverage:** Not assessed
- **Critical Issues:** 3
- **High Issues:** 7
- **Medium Issues:** 8
- **Low Issues:** 5

---

## Unresolved Questions

1. Does the `POST /analytics/usage` endpoint serve a legitimate client use case (e.g., Electron desktop app reporting tokens after a WebSocket chat), or can it be moved to a server-internal call? This determines whether H6 is a design issue or just needs hardening.
2. Does the Electron client need `gateway_token` returned on login? If so, there should be a dedicated endpoint for it rather than including it in every `/auth/me` response.
3. Is `trust proxy 2` intentional (two Nginx hops, or Nginx + Cloudflare)? The deployed topology needs to be documented to validate this setting.
