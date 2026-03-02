# Security Review — Operis API
**Date:** 2026-02-27
**Reviewer:** Security Review Agent
**Scope:** Full security audit per 10 focus areas

---

## Executive Summary

The operis-api codebase has solid foundational security practices — bcrypt password hashing (rounds=12), refresh token rotation with reuse detection, pessimistic locking on token debits, IDOR-safe deposit/cronjob queries, and idempotent webhook processing. However, several **CRITICAL and HIGH** issues undermine these strengths:

1. **Production secrets are weak defaults or committed to `.env`** — live API keys (`DEEPSEEK_API_KEY`, `BYTEPLUS_API_KEY`) and a weak DB password are in the untracked `.env` file (correct to gitignore, but the values are weak/leaked).
2. **`SafeUser` exposes `gateway_token`, `gateway_hooks_token`, and `auth_profiles_path`** to every authenticated user via `/api/auth/me` and related endpoints.
3. **No `GATEWAY_REGISTER_SECRET` set in `.env`** — falls back to hardcoded `operis-gateway-register-secret`, making the gateway registration endpoint trivially exploitable.
4. **SePay webhook skips verification when `SEPAY_WEBHOOK_API_KEY` is empty** (dev mode bypass) — this value is blank in `.env`.
5. **`wsComplete` and `reportUsage` accept unbounded token counts from the client** — a user can self-report arbitrarily large usage and drain their balance faster than intended, or report 0 tokens to avoid billing.
6. **No global `apiLimiter` applied** — the defined rate limiter for general API is exported but never mounted.
7. **`trust proxy 2`** overcounts proxy hops in single-proxy setups, allowing IP spoofing via `X-Forwarded-For`.
8. **No HTTP security headers (Helmet)** — no CSP, X-Frame-Options, HSTS, etc.
9. **Debug log file `/tmp/anthropic-proxy-debug.log`** may persist sensitive request metadata on disk.
10. **Allow-hosts middleware uses substring matching** — a host like `eviloperis.vn` would bypass the check against `operis.vn`.

**Risk Level: HIGH** — multiple issues are directly exploitable without authentication.

---

## Findings by Category

---

### 1. Authentication & Authorization

#### CRITICAL — C1: Hardcoded Gateway Register Secret (No Fallback Protection)

**File:** `src/routes/gateway-register.routes.ts:11`, `src/utils/auth-profiles-sync.util.ts:137`

```ts
const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET || "operis-gateway-register-secret";
```

`GATEWAY_REGISTER_SECRET` is not set in `.env` (verified). The fallback string is a predictable constant checked in source code. Anyone who reads the source can call `PUT /gateway/register` with `Authorization: Bearer operis-gateway-register-secret` and overwrite `gateway_token`/`hooks_token` for any user by email — effectively taking over any user's gateway.

**Recommendation:**
```ts
const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET;
if (!REGISTER_SECRET) throw new Error("GATEWAY_REGISTER_SECRET must be set");
```
Add `GATEWAY_REGISTER_SECRET=<random-64-char>` to `.env`.

---

#### HIGH — A1: `SafeUser` Leaks `gateway_token`, `gateway_hooks_token`, `auth_profiles_path`

**File:** `src/core/types/entities.ts:21`, `src/utils/sanitize.util.ts:21`

```ts
export type SafeUser = Omit<User, "password_hash">;
```

`SafeUser` omits only `password_hash`. The fields `gateway_token`, `gateway_hooks_token`, and `auth_profiles_path` (a local filesystem path) remain in the type and are returned to the authenticated user via:
- `GET /api/auth/me`
- `POST /api/auth/login` (through `AuthResult.user`)
- `POST /api/auth/register`
- `PUT /api/auth/gateway`

A user's own gateway tokens are sensitive — if the session cookie/JWT is stolen, the attacker gets full gateway access. `auth_profiles_path` leaks the server filesystem layout.

**Recommendation:**
```ts
export type SafeUser = Omit<User,
  | "password_hash"
  | "gateway_token"
  | "gateway_hooks_token"
  | "auth_profiles_path"
>;
```

---

#### HIGH — A2: `apiKeyMiddleware` Does Not Hash Key Before Header Prefix Check

**File:** `src/middleware/auth.middleware.ts:65-70`

```ts
if (!authHeader?.startsWith("sk_")) {
  next(Errors.unauthorized(MSG.AUTH_REQUIRED));
  return;
}
const keyHash = crypto.createHash("sha256").update(authHeader).digest("hex");
```

The full `Authorization` header value (including the `sk_` prefix, any whitespace, etc.) is hashed. This is fine if `generateApiKey` hashes the same way. However, if a client sends `Authorization: sk_xxxx` without the `Bearer` prefix (which is the expected pattern per line 65), the hash includes no `Bearer ` prefix — this must match the stored hash exactly. The issue is that there is no normalization: a key submitted as `sk_ xxxx` (extra space) would produce a different hash and fail silently. This is a minor UX/operational issue, not a security vulnerability per se, but could cause confusing auth failures.

**Recommendation:** Normalize the key by trimming whitespace before hashing.

---

#### MEDIUM — A3: JWT Secrets Have Weak Defaults in `.env`

**File:** `.env`

```
JWT_ACCESS_SECRET=operis-jwt-access-secret-change-in-production
JWT_REFRESH_SECRET=operis-jwt-refresh-secret-change-in-production
```

These "change-in-production" placeholder values are currently the active secrets. If this server is internet-facing with these values, any attacker who sees the source can forge JWTs. The `jwt.util.ts` correctly calls `requireEnv()` but only throws if the variable is _absent_ — it does not reject known-weak placeholder values.

**Recommendation:** Replace with cryptographically random 64-byte hex strings. Consider adding a startup check that rejects known placeholder strings:

```ts
const KNOWN_WEAK = ["operis-jwt-access-secret-change-in-production", ...];
if (KNOWN_WEAK.includes(val)) throw new Error(`[jwt] ${name} is using a placeholder — set a real secret`);
```

---

#### MEDIUM — A4: `trust proxy 2` Misconfiguration

**File:** `src/server.ts:47`

```ts
app.set("trust proxy", 2);
```

`trust proxy 2` trusts two levels of `X-Forwarded-For` headers. If there is only one Nginx proxy in front, this allows a client to inject a fake IP in `X-Forwarded-For` with one extra hop, bypassing IP-based rate limiting and the `allowHostsMiddleware`. Set to `1` (single Nginx reverse proxy) unless a second-layer CDN/proxy is confirmed.

**Recommendation:**
```ts
app.set("trust proxy", 1); // One Nginx in front
```

---

### 2. Injection Attacks

#### LOW — I1: No Evidence of SQL Injection (TypeORM Parameterized Queries Used)

All DB queries use TypeORM QueryBuilder with parameterized values (`:userId`, `:amount`). The deposit webhook uses raw SQL but with positional parameters `$1, $2, ...`. No string interpolation into SQL detected.

**One exception — `token-transactions.ts:191`:**

```ts
free_token_balance: () => `free_token_balance - ${freeDeduct}`,
```

`freeDeduct` is a computed number (`Math.min(...)`), not user input — no injection risk here, but this pattern is fragile. Prefer `.setParameter()`.

---

#### LOW — I2: No Command Injection Detected

No `child_process`, `exec`, `spawn`, or `eval` calls found in route/service handlers.

---

#### LOW — I3: Limited XSS Protection

`escapeHtml` is applied to `userMessage` before storing in `wsComplete` and to cronjob name/description. However:
- Chat messages submitted via the main chat route (`POST /chat`) are not shown to be sanitized before storage.
- `assistantMessage` in `wsComplete` is stored without escaping.
- No Content-Security-Policy header is set (see C4).

For a REST API returning JSON, XSS is lower risk. If any API consumer renders content as HTML without escaping, this matters.

---

### 3. Sensitive Data Exposure

#### CRITICAL — S1: Live API Keys Stored in `.env` with Weak Password

**File:** `.env` (not committed to git — correct)

```
DB_PASSWORD=080103           # extremely weak
DEEPSEEK_API_KEY=sk-3b6b9c4ad30844fa93bf29499aa13605
BYTEPLUS_API_KEY=5d60935c-5830-46fd-84f8-4b83271ff69d
TOKEN_ENCRYPTION_KEY=operis-vault-key-change-in-production
```

- `DB_PASSWORD=080103`: A 6-digit numeric password is trivially brute-forceable, especially with `DB_SSL=false`.
- `DEEPSEEK_API_KEY`: Real key in plaintext. If the `.env` file is leaked (e.g., via directory traversal, mis-deployed Docker image, PM2 ecosystem file), the key is compromised.
- `BYTEPLUS_API_KEY`: Same risk.
- `TOKEN_ENCRYPTION_KEY`: Still uses the "change-in-production" placeholder — the AES-256-GCM encryption of Anthropic OAuth tokens is effectively broken.

**Recommendations:**
1. Rotate all API keys immediately after this review.
2. Use a secrets manager (HashiCorp Vault, AWS Secrets Manager) or at minimum environment injection at runtime.
3. `DB_PASSWORD`: Use a strong random password ≥20 chars.
4. `DB_SSL=false`: Enable SSL for the PostgreSQL connection.
5. `TOKEN_ENCRYPTION_KEY`: Set a random 32-byte hex value.

---

#### HIGH — S2: Debug Log File Persists Sensitive Data to Disk

**File:** `src/routes/anthropic-proxy.routes.ts:19-22`

```ts
const DEBUG_LOG = "/tmp/anthropic-proxy-debug.log";
function debugLog(msg: string) {
  fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
}
```

The log records `req.method`, `req.originalUrl`, model names, message counts, and system prompt character lengths. `/tmp` is world-readable on many Linux systems. This file grows unboundedly with no rotation. In production, remove this or replace with structured logging at debug level only when `NODE_ENV !== "production"`.

**Recommendation:** Remove `debugLog` or gate on `process.env.DEBUG_PROXY=true`.

---

### 4. Rate Limiting & DoS Protection

#### HIGH — R1: `apiLimiter` Defined but Never Applied

**File:** `src/middleware/rate-limit.middleware.ts:37-43`

```ts
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  ...
});
```

This limiter is exported but `grep` shows it is **never imported or mounted** anywhere. Only `loginLimiter` and `registerLimiter` are applied (to auth routes). All other endpoints — including AI proxy endpoints, deposit creation, token operations, analytics — are completely unrate-limited.

**Recommendation:** Apply `apiLimiter` globally in `src/server.ts` after `cookieParser`:
```ts
import { apiLimiter } from "./middleware/rate-limit.middleware";
app.use("/api", apiLimiter);
app.use("/v1", apiLimiter);
```

---

#### HIGH — R2: No Rate Limiting on AI Proxy Endpoints

**Files:** `src/routes/anthropic-proxy.routes.ts`, `src/routes/byteplus-proxy.routes.ts`, `src/routes/anthropic-compat.routes.ts`, `src/routes/openai-compat.routes.ts`

These endpoints proxy expensive AI API calls. Without rate limiting, a single user or attacker with a valid API key can:
- Send unlimited requests to drain the server-side Anthropic/BytePlus API quota.
- Cause token balance depletion attacks (rapid fire to exhaust balance before deduction completes).

**Recommendation:** Apply per-user rate limiting on these routes (not just IP-based), e.g., use `express-rate-limit` with a `keyGenerator` that uses `req.user?.userId`.

---

#### MEDIUM — R3: Chat Rate Limit Mentioned in Docs but Not Applied in Code

**File:** `src/routes/chat.routes.ts:17` (comment says "20 requests/minute per user")

The comment documents a rate limit but the actual route handlers (`router.post("/")`, `router.post("/stream")`) do not include any rate-limiting middleware. The limit is not enforced.

---

### 5. Input Validation Gaps

#### HIGH — V1: `wsComplete` and `reportUsage` Accept Unbounded Token Counts from Client

**File:** `src/controllers/chat.controller.ts:83-85` (`wsComplete`), `src/controllers/analytics.controller.ts:162-166` (`reportUsage`)

```ts
// wsComplete
const inputTokens = Number(usage?.input_tokens) || 0;
const outputTokens = Number(usage?.output_tokens) || 0;
const totalTokens = Number(usage?.total_tokens) || inputTokens + outputTokens;

// reportUsage
const inputTokens = parseInt(input_tokens) || 0;
const outputTokens = parseInt(output_tokens) || 0;
const totalTokens = inputTokens + outputTokens + cacheRead + cacheWrite;
```

Both endpoints accept token counts entirely from the client. Problems:
1. **Under-reporting**: A client can submit `input_tokens=0, output_tokens=0` after an actual AI response, paying 0 tokens.
2. **Over-reporting**: A client can submit `input_tokens=999999999` — `tokenService.debit` will check balance, so overdraft is prevented, but it creates fraudulent transaction records and inflates analytics.
3. **`wsComplete`** uses `Number()` which accepts floats and scientific notation (`1e9`).

**Recommendation:**
- Validate token counts are positive integers within a reasonable max (e.g., `MAX_TOKENS_PER_REQUEST = 1_000_000`).
- For `wsComplete`, the gateway should sign the usage payload; otherwise under-reporting is trivially exploitable.

```ts
const MAX_TOKENS = 1_000_000;
if (!Number.isInteger(totalTokens) || totalTokens < 0 || totalTokens > MAX_TOKENS) {
  throw Errors.badRequest("Invalid token count");
}
```

---

#### MEDIUM — V2: `tokenAmount` in Deposit Can Be Negative

**File:** `src/services/deposit.service.ts:73-75`

```ts
if (input.tokenAmount < 100000)
  throw Errors.badRequest(MSG.MIN_DEPOSIT_TOKENS);
```

A negative `tokenAmount` (e.g., `-100`) passes the `< 100000` check since `-100 < 100000`. This would create a deposit order with a negative token amount. While the webhook processing would then `creditTokens` with a negative value, which would actually subtract tokens — a potential financial manipulation vector.

**Recommendation:** Add an explicit positive check:
```ts
if (!input.tokenAmount || input.tokenAmount <= 0)
  throw Errors.badRequest("Token amount must be positive");
if (input.tokenAmount < 100000)
  throw Errors.badRequest(MSG.MIN_DEPOSIT_TOKENS);
```

---

#### MEDIUM — V3: No Validation on `adminUpdateTokens` Amount

**File:** `src/controllers/deposit.controller.ts:190-195`

```ts
const { userId, amount, reason } = req.body;
const result = await depositService.adminUpdateTokens(adminUserId, userId, amount, reason);
```

`amount` and `reason` are passed directly without type-checking. A missing `reason` string or a non-numeric `amount` would propagate to the service. While admin-only, defensive validation is still appropriate.

---

#### LOW — V4: Pagination Parameters Not Bounded

**File:** `src/controllers/deposit.controller.ts:135`

```ts
const limit = parseInt(String(req.query.limit ?? "20"), 10);
const offset = parseInt(String(req.query.offset ?? "0"), 10);
```

No upper bound on `limit`. A user could request `limit=100000` and trigger a massive DB scan. The admin deposit controller does cap at 100, but the user-facing deposit history and token history do not.

---

### 6. CORS Misconfiguration

#### MEDIUM — C1: CORS Origin Pattern Using `startsWith` — Not Strict Enough

**File:** `src/server.ts:54-63`

```ts
const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
  if (allowed.includes("*")) {
    const pattern = allowed.replace("*", "\\d+");
    return new RegExp(pattern).test(origin);
  }
  return origin.startsWith(allowed);
});
```

`origin.startsWith("https://operis.vn")` would allow `https://operis.vn.evil.com`. Should use exact match or a stricter regex.

**Recommendation:**
```ts
return origin === allowed || origin.startsWith(allowed + "/");
```

---

#### MEDIUM — C2: Allow-Hosts Middleware Uses Substring Match — Bypassable

**File:** `src/middleware/allow-hosts.middleware.ts:38-43`

```ts
const isAllowed = ALLOWED_HOSTS.some((allowed) => {
  return (
    host.toLowerCase().includes(allowed) ||
    origin.toLowerCase().includes(allowed) ||
    clientIp.includes(allowed)
  );
});
```

`host.includes("operis.vn")` is true for `eviloperis.vn`. An attacker can set their `Host` header to contain an allowed string to bypass this check.

**Recommendation:** Use exact equality or suffix match:
```ts
return host === allowed || host.endsWith(`.${allowed}`);
```

---

### 7. Cookie Security

#### LOW — C3: Cookie `sameSite: "none"` in Production Requires `secure: true`

**File:** `src/utils/cookie.util.ts:22-24`

```ts
sameSite: isProduction ? "none" : "lax",
secure: isProduction,
```

The implementation is correct — `secure` is `true` when `sameSite` is `"none"` in production. This is fine. However, the `httpOnly: true` flag is correctly set and refresh cookie is scoped to `/api/auth/refresh`. No issues here.

**Note:** `sameSite: "none"` requires the client and server to be on different origins (cross-site). If both are on `operis.vn` subdomains, `sameSite: "strict"` or `"lax"` would be more restrictive and safer.

---

### 8. Token Handling

#### HIGH — T1: Anthropic OAuth Token Encryption Key is a Placeholder

**File:** `.env`

```
TOKEN_ENCRYPTION_KEY=operis-vault-key-change-in-production
```

The Anthropic proxy at `src/routes/anthropic-proxy.routes.ts:35-38` uses AES-256-GCM:

```ts
function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  return crypto.createHash("sha256").update(secret).digest();
}
```

The placeholder value produces a deterministic encryption key. Anyone who reads the source and knows the value can decrypt all stored Anthropic OAuth tokens from the DB.

**Recommendation:** Set `TOKEN_ENCRYPTION_KEY` to a cryptographically random 32-byte hex string and re-encrypt existing tokens.

---

#### MEDIUM — T2: Gateway Register Endpoint — No Rate Limiting or Logging of Failed Attempts

**File:** `src/routes/gateway-register.routes.ts`

The endpoint rejects invalid secrets but logs nothing and has no rate limit. An attacker can brute-force the secret key without detection.

---

#### MEDIUM — T3: `debitTokens` Uses String Interpolation for Numbers

**File:** `src/db/models/token-transactions.ts:191-193`

```ts
.set({
  free_token_balance: () => `free_token_balance - ${freeDeduct}`,
  ...(paidDeduct > 0 ? { token_balance: () => `token_balance - ${paidDeduct}` } : {}),
})
```

`freeDeduct` and `paidDeduct` are computed numbers, so no injection risk in practice. However, using TypeORM's `.setParameter()` is safer and more idiomatic.

---

### 9. Financial/Billing Security

#### HIGH — F1: Payment Amount Not Server-Verified Against Package Price

**File:** `src/controllers/deposit.controller.ts:46-51`

```ts
// Convert custom VND amount to tokens if no tokenAmount/tierId given
if (!tokenAmount && amountVnd && amountVnd > 0) {
  const { calculateTokensFromVnd } = await import("../db/models/deposits");
  tokenAmount = calculateTokensFromVnd(amountVnd);
  packagePriceVnd = amountVnd;
}
```

When a user supplies an arbitrary `amountVnd` (not tied to a package `tierId`), the server uses a calculated per-token rate. This path bypasses package-based pricing. A user could deposit `amountVnd=1` (minimum allowed is 1000 VND), receive tokens at the per-token rate, potentially bypassing package minimums or getting a different rate than intended.

**Recommendation:** Enforce that custom `amountVnd` must be at or above the minimum package price, or require `tierId` to be mandatory.

---

#### MEDIUM — F2: `creditTokens` in Webhook Does Not Validate `token_amount > 0`

**File:** `src/services/deposit.service.ts:319-325`

```ts
await creditTokensWithClient(
  manager,
  order.user_id,
  order.token_amount,
  ...
);
```

If an `order` deposit type (not token) triggers the webhook, `order.token_amount` is `0` (set at line 83). `creditTokensWithClient` would be called with `amount=0`, creating a no-op transaction record. This is a correctness issue more than a security issue, but could inflate transaction records.

---

#### MEDIUM — F3: Free Topup `processFreeTokenTopup` — No Cap on Balance After Reset

**File:** `src/services/cron.service.ts:544`

```ts
await usersRepo.updateUser(user.id, { free_token_balance: FREE_TOPUP_AMOUNT });
```

The topup resets `free_token_balance` to `FREE_TOPUP_AMOUNT` (200,000) every 5 hours regardless of current balance. If a user has not spent any free tokens, they still get reset to 200,000 (no harm — reset, not accumulation). The idempotency check prevents double-topup within a window. This is acceptable but worth noting.

---

#### LOW — F4: `adjustTokens` Can Drive `token_balance` Negative

**File:** `src/db/models/token-transactions.ts:221-252`

```ts
export async function adjustTokens(
  userId: string,
  amount: number, // can be positive or negative
  ...
```

Admin adjustment with a large negative amount can set `token_balance` to a negative value since no floor check is performed. This is admin-only and intentional per the comment, but should be documented or guarded.

---

### 10. IDOR (Insecure Direct Object Reference)

#### LOW — IDOR1: IDOR Generally Well-Mitigated

The codebase includes explicit anti-IDOR comments and scoped queries in:
- `depositService.cancelPendingOrder` — `getDepositOrderByIdAndUser(orderId, userId)` ✓
- `depositService.getDeposit` — same ✓
- `cronService.getCronjob` — `getCronjobByIdAndUser(cronjobId, userId)` ✓
- `cronService.deleteCronjob` — `deleteCronjobByUser(cronjobId, userId)` ✓

No IDOR vulnerabilities found in these paths.

---

#### LOW — IDOR2: Admin Endpoints Do Not Validate That Admin Token Belongs to an Admin User via DB

**File:** `src/middleware/auth.middleware.ts:165-178`

```ts
export function requireRole(...roles: string[]) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      next(Errors.forbidden());
      ...
```

The `role` in `req.user` comes from the JWT payload, which was set at login time. If a user was promoted/demoted after token issuance, the JWT still carries the old role until it expires (1 hour). This is standard JWT behavior, not a vulnerability per se, but worth documenting. Password change does revoke all refresh tokens, but the 1-hour window for access tokens remains.

---

### Summary Table

| ID | Severity | Category | Title |
|----|----------|----------|-------|
| C1 | CRITICAL | Auth | Hardcoded Gateway Register Secret |
| S1 | CRITICAL | Data Exposure | Live API keys + weak DB password in `.env` |
| A1 | HIGH | Auth | `SafeUser` exposes `gateway_token`, `gateway_hooks_token` |
| R1 | HIGH | Rate Limit | `apiLimiter` defined but never applied |
| R2 | HIGH | Rate Limit | No rate limit on AI proxy endpoints |
| T1 | HIGH | Tokens | `TOKEN_ENCRYPTION_KEY` is placeholder |
| V1 | HIGH | Validation | Unbounded client-reported token counts (billing bypass) |
| F1 | HIGH | Financial | Custom `amountVnd` bypasses package pricing |
| S2 | HIGH | Data Exposure | Debug log writes to `/tmp`, unbounded |
| A2 | MEDIUM | Auth | JWT secrets are placeholder values |
| A3 | MEDIUM | Auth | `apiKeyMiddleware` whitespace normalization |
| A4 | MEDIUM | Auth | `trust proxy 2` allows IP spoofing |
| C1 | MEDIUM | CORS | `startsWith` origin check — not strict enough |
| C2 | MEDIUM | CORS | `allow-hosts` substring match bypassable |
| T2 | MEDIUM | Tokens | No rate limit/logging on gateway register failures |
| T3 | MEDIUM | Tokens | Number interpolation in TypeORM query builder |
| V2 | MEDIUM | Validation | Negative `tokenAmount` passes min-check |
| V3 | MEDIUM | Validation | No type validation on admin token update inputs |
| V4 | MEDIUM | Validation | Pagination `limit` unbounded in user routes |
| F2 | MEDIUM | Financial | `creditTokens` called with `amount=0` for order-type deposits |
| F3 | MEDIUM | Financial | Free topup amount not validated against existing balance |
| R3 | MEDIUM | Rate Limit | Chat rate limit documented but not enforced |
| F4 | LOW | Financial | `adjustTokens` can make `token_balance` negative |
| I1 | LOW | Injection | `free_token_balance - ${freeDeduct}` string interpolation |
| I3 | LOW | Injection | XSS — `assistantMessage` stored unsanitized |
| IDOR2 | LOW | IDOR | Role in JWT not re-validated against DB |

---

## Recommended Actions (Priority Order)

1. **[CRITICAL] Rotate all secrets immediately**: DEEPSEEK_API_KEY, BYTEPLUS_API_KEY, TOKEN_ENCRYPTION_KEY, DB_PASSWORD. Set `GATEWAY_REGISTER_SECRET` to a random value.
2. **[CRITICAL] Remove hardcoded fallback in gateway-register.routes.ts and auth-profiles-sync.util.ts** — fail-fast if env var is missing.
3. **[HIGH] Fix `SafeUser` type** to exclude `gateway_token`, `gateway_hooks_token`, `auth_profiles_path`.
4. **[HIGH] Mount `apiLimiter`** globally in `server.ts`.
5. **[HIGH] Add per-user rate limiting** on all AI proxy routes.
6. **[HIGH] Enforce max token count cap** in `wsComplete` and `reportUsage` (e.g., 1,000,000 per request).
7. **[HIGH] Fix `tokenAmount` negative validation** in `createDeposit`.
8. **[HIGH] Remove or gate debug file logging** in anthropic-proxy.routes.ts.
9. **[MEDIUM] Fix CORS `startsWith` to exact match** in server.ts.
10. **[MEDIUM] Fix allow-hosts substring match** to use exact/suffix matching.
11. **[MEDIUM] Enable DB SSL** (`DB_SSL=true`).
12. **[MEDIUM] Add Helmet** for HTTP security headers (CSP, HSTS, X-Frame-Options, etc.).
13. **[MEDIUM] Document and enforce 1-hour stale-role window** — consider short access token or DB role check for admin operations.

---

## Unresolved Questions

1. Is the `GATEWAY_REGISTER_SECRET` intentionally left blank in `.env` (server not using gateway register feature)? If so, consider disabling the route entirely in production.
2. Is `trust proxy 2` intentional? Are there two layers of proxies (e.g., CDN + Nginx)?
3. Is `SEPAY_WEBHOOK_API_KEY` intentionally blank (no webhook verification in current deployment)?
4. Does `SafeUser` returning `gateway_token` to the user intentionally (so they can copy it into the OpenClaw client)? If yes, this design choice should be documented and the token should at minimum be masked (show last 4 chars).
5. For the BytePlus proxy, `user.token_balance <= 0` check ignores `free_token_balance` — is this intentional?
