# Security Audit Report — Operis API

**Date:** 2026-03-05
**Scope:** Full codebase deep security audit
**Files analyzed:** ~50+ source files across services, controllers, routes, middleware, DB layer, config
**Auditors:** 4 parallel security review agents

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 16 |
| MEDIUM | 14 |
| LOW | 8 |
| **Total** | **45** |

**Top 3 urgent risks:**
1. **RCE via Command Injection** in `tool-executor.service.ts` — full server takeover
2. **Live secrets in `.env`** — JWT placeholder secrets, real API keys, weak DB password
3. **Token Vault exposed** — any logged-in user can read Anthropic OAuth tokens

---

## CRITICAL Findings

### C-01: Command Injection / Remote Code Execution (RCE)

| | |
|---|---|
| **File** | `src/services/tool-executor.service.ts:110,142,184` |
| **Impact** | Full server takeover, reverse shell, data exfiltration |

3 methods inject user/AI-controlled data directly into shell commands:

```typescript
// Line 110: browser tool
await execAsync(`open "${url}"`);

// Line 142: exec tool — RUNS ARBITRARY COMMANDS
const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

// Line 184: file_read tool
const { stdout } = await execAsync(`cat "${path}"`);
```

Blacklist (line 137) only blocks 5 hardcoded strings — trivially bypassed.

**Fix:** Remove `exec` tool entirely or sandbox in Docker (network=none, read-only fs). Replace shell string interpolation with `execFile()`. Validate all paths with `path.resolve()` + allowlist.

---

### C-02: Live Secrets in `.env` File

| | |
|---|---|
| **File** | `.env` (entire file) |
| **Impact** | JWT forgery, API key abuse, DB direct access |

```
DB_PASSWORD=080103                          # 6-digit — brute-forceable
JWT_SECRET=operis-jwt-secret-change-in-production    # PLACEHOLDER — forge any JWT
JWT_ACCESS_SECRET=operis-jwt-access-secret-change-in-production
JWT_REFRESH_SECRET=operis-jwt-refresh-secret-change-in-production
DEEPSEEK_API_KEY=sk-3b6b9c4a...             # REAL KEY
BYTEPLUS_API_KEY=978632c8-...               # REAL KEY
TOKEN_ENCRYPTION_KEY=operis-vault-key-change-in-production  # PLACEHOLDER
```

**Fix:** Rotate all API keys immediately. Generate 64-char hex secrets for JWT. Set strong DB password. Re-encrypt vault tokens.

---

### C-03: Hardcoded DB Credentials in Source Code

| | |
|---|---|
| **File** | `src/db/connection.ts:37-39`, `src/db/data-source.ts:19-20` |
| **Impact** | Anyone with repo access has DB credentials |

```typescript
user: process.env.DB_USER || "duc",
password: String(process.env.DB_PASSWORD || "080103"),
```

**Fix:** Remove fallback values. Throw error if env vars not set.

---

### C-04: Token Vault GET Returns Decrypted Anthropic Tokens to Any User

| | |
|---|---|
| **File** | `src/routes/token-vault.routes.ts:50,85-98` |
| **Impact** | Any logged-in user steals Anthropic OAuth tokens (`sk-ant-oat01-*`) |

```typescript
router.use(authMiddleware); // NOT adminMiddleware!

router.get("/", asyncHandler(async (_req, res) => {
  const tokens = encryptedList.map((blob) => decrypt(blob));
  res.json({ tokens }); // Returns REAL tokens to ANY user
}));
```

**Fix:** Add `adminMiddleware` to GET, PUT, DELETE routes.

---

### C-05: JWT Algorithm Not Specified (Algorithm Confusion Attack)

| | |
|---|---|
| **File** | `src/utils/jwt.util.ts:45-56,66-78` |
| **Impact** | `alg: none` bypass in older jsonwebtoken versions |

```typescript
jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN }); // No algorithm
jwt.verify(token, ACCESS_SECRET); // No algorithms whitelist
```

**Fix:** Add `algorithm: "HS256"` to sign, `algorithms: ["HS256"]` to verify.

---

### C-06: Webhook Middleware Skips Auth When Key Not Configured

| | |
|---|---|
| **File** | `src/middleware/sepay-webhook.middleware.ts:17-21`, `src/middleware/openclaw-webhook.middleware.ts:17-21` |
| **Impact** | Fake payment notifications → credit tokens without payment |

```typescript
if (!SEPAY_WEBHOOK_API_KEY) {
  next(); // ANYONE passes through
  return;
}
```

`SEPAY_WEBHOOK_API_KEY` is **not set** in current `.env`.

**Fix:** Reject all requests when key not configured. Block in production.

---

### C-07: Mass Assignment — User Update Passes Raw req.body

| | |
|---|---|
| **File** | `src/controllers/user.controller.ts:36-38` |
| **Impact** | Modify `token_balance`, `role`, `email` of any user |

```typescript
const user = await userService.update(id, req.body); // No validation!
```

**Fix:** Validate with `UserValidator.validateUpdate()`. Remove `token_balance`, `role` from update DTO.

---

## HIGH Findings

### H-01: SSRF via User-Controlled `gateway_url`

| | |
|---|---|
| **File** | `src/services/gateway-proxy.service.ts:161,522`, `src/services/chat-stream.service.ts:188` |
| **Impact** | Internal network scanning, AWS metadata theft |

User can set `gateway_url = "http://169.254.169.254/"` → fetch to cloud metadata endpoint.

**Fix:** Validate URL on save — block private/loopback IPs, require HTTPS.

---

### H-02: Webhook Key Comparison Not Timing-Safe

| | |
|---|---|
| **File** | `src/middleware/sepay-webhook.middleware.ts:30`, `src/middleware/openclaw-webhook.middleware.ts:29` |
| **Impact** | Character-by-character key extraction via timing attack |

```typescript
if (providedKey !== SEPAY_WEBHOOK_API_KEY) { ... } // Timing attack vulnerable
```

**Fix:** Use `crypto.timingSafeEqual()`.

---

### H-03: SePay Webhook — No HMAC Signature Verification

| | |
|---|---|
| **File** | `src/middleware/sepay-webhook.middleware.ts` |
| **Impact** | If API key leaked, attacker fakes payment notifications |

Only static API key auth. No HMAC payload verification.

**Fix:** Implement HMAC-SHA256 signature verification if SePay supports it.

---

### H-04: Race Condition / TOCTOU in Token Deduction

| | |
|---|---|
| **File** | `src/services/chat-stream.service.ts:105,369-376` |
| **Impact** | Users spend more tokens than their balance |

Balance check uses stale `user` object fetched before streaming (can be 10+ min old). 5 concurrent requests all pass check, all debit.

**Fix:** Remove stale check. Rely entirely on `tokenService.debit()` which has `FOR UPDATE` lock.

---

### H-05: SQL String Interpolation in debitTokens

| | |
|---|---|
| **File** | `src/db/models/token-transactions.ts:190-193` |
| **Impact** | NaN/Infinity injection causing SQL errors or data corruption |

```typescript
.set({ free_token_balance: () => `free_token_balance - ${freeDeduct}` })
```

**Fix:** Use parameterized approach: `.setParameters({ freeDeduct, paidDeduct })`.

---

### H-06: Error Messages Expose Internal Details

| | |
|---|---|
| **File** | `src/services/chat-stream.service.ts:204-207,434`, `src/routes/byteplus-proxy.routes.ts:148-153`, `src/routes/anthropic-proxy.routes.ts:384` |
| **Impact** | Leaks internal IPs, API key fragments, stack traces |

```typescript
const errorText = await byteplusRes.text();
res.send(errorBody); // Forward raw upstream error to client
```

**Fix:** Log details server-side, return generic error to client.

---

### H-07: Zalo Webhook IDOR — `user_id` from Request Body

| | |
|---|---|
| **File** | `src/controllers/zalo.controller.ts:60-92` |
| **Impact** | Debit tokens from any user with webhook key |

```typescript
const { user_id, input_tokens, output_tokens } = req.body; // IDOR!
```

**Fix:** Validate `user_id` is UUID, verify user exists, cap token values.

---

### H-08: Image Validation Missing — No Size/Count/MIME Limits

| | |
|---|---|
| **File** | `src/controllers/chat-stream.controller.ts:29-36` |
| **Impact** | DoS via unlimited base64 images, MIME spoofing |

**Fix:** Whitelist MIME types, limit image size to 5MB, max 10 images.

---

### H-09: Path Traversal via `auth_profiles_path`

| | |
|---|---|
| **File** | `src/utils/auth-profiles-sync.util.ts:69,93`, `src/validators/auth.validator.ts:245-247` |
| **Impact** | Write arbitrary JSON to any path on server |

```typescript
fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + "\n"); // No path validation
```

**Fix:** Validate resolved path stays within allowed base directory.

---

### H-10: Body Parser Limit 50MB — DoS Risk

| | |
|---|---|
| **File** | `src/server.ts:75` |
| **Impact** | RAM exhaustion via continuous 50MB requests |

**Fix:** Default `1mb`, use `10mb` only for AI routes with images.

---

### H-11: Access Token Remains Valid 1 Hour After Logout

| | |
|---|---|
| **File** | `src/services/auth.service.ts:142-150` |
| **Impact** | Stolen access token usable 1 hour post-logout |

Only refresh token is revoked on logout. Access token stays valid.

**Fix:** Reduce access token TTL to 15 minutes, or implement token blacklist.

---

### H-12: No Per-User Rate Limiting on AI Proxy Endpoints

| | |
|---|---|
| **File** | `src/routes/byteplus-proxy.routes.ts`, `src/routes/anthropic-proxy.routes.ts`, `src/routes/openai-compat.routes.ts` |
| **Impact** | Cost explosion via rapid AI API requests |

Only global IP-based limiter (200/min). Users with VPN bypass easily.

**Fix:** Per-user rate limit: max 20 AI requests/min per userId.

---

### H-13: Helmet CSP Completely Disabled

| | |
|---|---|
| **File** | `src/server.ts:51` |
| **Impact** | No XSS protection headers |

```typescript
app.use(helmet({ contentSecurityPolicy: false }));
```

**Fix:** Configure proper CSP directives.

---

### H-14: No HTTPS Enforcement

| | |
|---|---|
| **File** | `src/server.ts:116` |
| **Impact** | JWT tokens, API keys sent in plaintext |

**Fix:** Add HTTPS redirect middleware in production.

---

### H-15: Cookie `secure: false` in Production

| | |
|---|---|
| **File** | `src/utils/cookie.util.ts:17-27` |
| **Impact** | Session cookies sent over HTTP |

`COOKIE_SECURE` and `NODE_ENV` not set in `.env` → `secure: false`.

**Fix:** Set `COOKIE_SECURE=true` and `NODE_ENV=production`.

---

### H-16: `SafeUser` Exposes `gateway_url` and `auth_profiles_path`

| | |
|---|---|
| **File** | `src/core/types/entities.ts:21`, `src/utils/sanitize.util.ts:21-24` |
| **Impact** | Leaks internal URLs and filesystem paths |

**Fix:** Add `gateway_url` and `auth_profiles_path` to Omit type.

---

## MEDIUM Findings

| ID | Issue | File | Fix |
|----|-------|------|-----|
| M-01 | `wsComplete` — no conversationId ownership check (IDOR) | `src/controllers/chat.controller.ts:76-125` | Verify conversation belongs to user |
| M-02 | Gateway token prefix logged to console | `src/services/zalo.service.ts:56` | Remove token from logs |
| M-03 | DB config (host, port, user) logged on startup | `src/db/connection.ts:24-31` | Remove or mask debug log |
| M-04 | CORS allows requests without Origin header | `src/server.ts:56-57` | Require Origin in production |
| M-05 | CORS regex doesn't escape dots in domain | `src/server.ts:59-63` | Escape special chars |
| M-06 | Request logging includes query string params | `src/server.ts:84-87` | Use `req.path` instead of `req.originalUrl` |
| M-07 | Unsafe pricing data deserialization | `src/services/deposit.service.ts:528-537` | Validate schema after JSON.parse |
| M-08 | `markHelpful` — no auth/duplicate prevention | `src/services/review.service.ts:68-72` | Track votes per (reviewId, userId) |
| M-09 | Analytics date range — no validation or limit | `src/controllers/analytics.controller.ts:86-117` | Validate dates, max 1 year range |
| M-10 | OpenAI-compat — no limit on messages[]/tools[] | `src/routes/openai-compat.routes.ts:133-163` | Cap messages ≤ 500, tools ≤ 50 |
| M-11 | Gateway `hookName` — no format validation | `src/services/gateway-proxy.service.ts:301-302` | Regex `^[a-zA-Z0-9_-]{1,50}$` |
| M-12 | Feedback controller — no input validation | `src/controllers/feedback.controller.ts:9-18` | Whitelist type, limit lengths |
| M-13 | Log injection via user message content | `src/controllers/chat.controller.ts:109` | Sanitize newlines in log strings |
| M-14 | Negative token balance — no floor constraint | `src/db/models/token-transactions.ts:220-252` | Add DB CHECK constraint `>= 0` |

---

## LOW Findings

| ID | Issue | File |
|----|-------|------|
| L-01 | DB pool size 200 exceeds PostgreSQL default max_connections (100) | `src/db/connection.ts:41` |
| L-02 | No max message length for chat | `src/services/chat-stream.service.ts:98` |
| L-03 | `host.includes("localhost")` allows `evil-localhost.com` | `allow-hosts.middleware.ts:28` |
| L-04 | Swagger UI accessible in production (no auth) | `src/server.ts:95` |
| L-05 | No limit on active refresh tokens per user | `src/services/auth.service.ts` |
| L-06 | Password — no max length (bcrypt processes 72 bytes, DoS with huge input) | `src/validators/auth.validator.ts` |
| L-07 | User enumeration via 409 Conflict on registration | `src/services/auth.service.ts:55-56` |
| L-08 | `/health` no rate limit (mounted before apiLimiter) | `src/server.ts:90-92` |

---

## Positive Observations

1. Refresh token rotation + reuse detection — best practice
2. Bcrypt 12 rounds for password hashing
3. API keys stored as SHA-256 hash in DB
4. HttpOnly cookie for JWT session
5. `FOR UPDATE` pessimistic lock in debitTokens (atomic)
6. Anti-IDOR scoping (userId + id) in deposit, API key queries
7. Mass assignment whitelist in api-key.service.ts
8. AES-256-GCM for token vault encryption
9. AbortController timeout on all proxy requests
10. Rate limiting on login, register, password change
11. Generic error on login validation (no field-specific hints)
12. HTML escaping via `escapeHtml()` utility

---

## Priority Action Plan

### Immediate (< 24 hours)

| # | Action | Files |
|---|--------|-------|
| 1 | **Rotate** all API keys (DEEPSEEK, BYTEPLUS) on provider dashboards | `.env` |
| 2 | **Generate** strong JWT secrets (64-char hex) and TOKEN_ENCRYPTION_KEY | `.env` |
| 3 | **Remove/sandbox** `tool-executor.service.ts` exec tool | `tool-executor.service.ts` |
| 4 | **Add** `adminMiddleware` to token vault GET/PUT/DELETE | `token-vault.routes.ts` |
| 5 | **Fix** webhook middleware: reject when key not set | `sepay-webhook.middleware.ts`, `openclaw-webhook.middleware.ts` |
| 6 | **Remove** hardcoded DB credentials from source | `connection.ts`, `data-source.ts` |
| 7 | **Add** `algorithm: "HS256"` to JWT sign/verify | `jwt.util.ts` |

### This Week

| # | Action | Files |
|---|--------|-------|
| 8 | Add `crypto.timingSafeEqual()` for webhook key comparison | Webhook middlewares |
| 9 | Validate `gateway_url` — block private IPs | `auth.service.ts`, `gateway-proxy.service.ts` |
| 10 | Validate `auth_profiles_path` — prevent path traversal | `auth-profiles-sync.util.ts` |
| 11 | Add input validation to user update controller | `user.controller.ts` |
| 12 | Remove `gateway_url`, `auth_profiles_path` from SafeUser | `entities.ts`, `sanitize.util.ts` |
| 13 | Reduce body parser limit to 1mb (10mb for AI routes) | `server.ts` |
| 14 | Set `COOKIE_SECURE=true`, `NODE_ENV=production` | `.env` |

### This Month

| # | Action | Files |
|---|--------|-------|
| 15 | Per-user rate limiting on AI proxy endpoints | Proxy routes |
| 16 | Configure Helmet CSP properly | `server.ts` |
| 17 | HTTPS redirect enforcement | `server.ts` |
| 18 | Enable DB SSL with `rejectUnauthorized: true` | `connection.ts` |
| 19 | Reduce access token TTL to 15min or implement blacklist | `jwt.util.ts` |
| 20 | Image validation (MIME whitelist, size/count limits) | `chat-stream.controller.ts` |
| 21 | Parameterize SQL in debitTokens | `token-transactions.ts` |
| 22 | Sanitize upstream error messages before client response | Proxy routes |

---

## Unresolved Questions

1. `tool-executor.service.ts` — which routes call this service? If no auth guard, this is RCE with zero barriers.
2. Is the server running behind Nginx with HTTPS termination? Affects cookie/CORS security posture.
3. Is `SEPAY_WEBHOOK_API_KEY` intentionally unset? If processing real payments, this is actively exploitable.
4. Is token vault `GET /` intentionally accessible to all users? Or oversight?
5. `DB_HOST=192.168.1.5` — is DB on same machine? If remote, plaintext DB connection is high risk.
6. Is `.env` committed to git history? If so, all historical secrets need rotation + git history rewrite.
