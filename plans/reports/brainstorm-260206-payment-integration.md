# Brainstorm: Token Management & SePay Payment Integration

**Date:** 2026-02-06
**Status:** Analysis Complete
**Scope:** Token counting, account management, payment flow via SePay

---

## 1. Current System Analysis

### 1.1 Architecture Overview

**Operis API** = AI-as-a-Service platform (Express.js + PostgreSQL + TypeScript)
- Acts as AI proxy: receives prompts from Moltbot, calls DeepSeek API, returns Anthropic-style responses
- Token-based billing: users buy tokens, each AI request deducts tokens
- Repository → Service → Controller pattern, clean separation

### 1.2 Token Management (EXISTING)

**Two-layer token system:**

| Layer | Table | Purpose |
|-------|-------|---------|
| **Balance/Ledger** | `token_transactions` | Credit/debit/adjustment records, tracks `balance_after` |
| **Usage Analytics** | `token_usage` | Per-request tracking: input_tokens, output_tokens, cost_tokens, model, metadata |

**Token Flow:**
```
User request → balance check → DeepSeek API call → recordUsage() → debit() → response
```

**Key metrics tracked:**
- `input_tokens` / `output_tokens` (from AI provider response)
- `total_tokens` = input + output
- `cost_tokens` = actual tokens deducted from balance (may differ from total)
- Per-user stats, by-type breakdown, daily aggregation, platform-wide analytics

**Current services:**
- `token.service.ts`: getBalance, credit, debit, adjust, getTransactions
- `token-usage.ts` (repo): recordUsage, getUserStats, getUserStatsByType, getUserDailyStats, getPlatformStats, getTopUsers

### 1.3 Account Management (EXISTING)

- Registration → auto-grants 1M tokens (initial balance)
- JWT auth: 1h access token, 7d refresh token
- API key support: `sk_*` prefix, SHA256 hashed, stored in `user_api_keys`
- Hybrid auth on `/chat`: JWT OR API key accepted
- Roles: `user` / `admin`
- Admin can: credit/debit tokens manually, view all users, manage deposits

### 1.4 Payment System (EXISTING - Basic SePay)

**Already implemented** deposit flow:

| Component | File | Status |
|-----------|------|--------|
| Deposit model | `src/db/models/deposits.ts` | Done |
| Deposit service | `src/services/deposit.service.ts` | Done |
| Deposit controller | `src/controllers/deposit.controller.ts` | Done |
| Deposit routes | `src/routes/deposit.routes.ts` | Done |
| DB migration (003) | `src/db/schema/003_deposit_orders.sql` | Done |

**Current pricing:**
- 1M tokens = 500,000 VND (0.5 VND/token)
- Minimum deposit: 100,000 tokens = 50,000 VND
- 6 packages: Starter (100K) → Enterprise (10M) with bonus tiers

**Current flow:**
```
1. GET /deposits/pricing           → view packages
2. POST /deposits                  → create order (returns QR + bank info)
3. User transfers VND via bank     → SePay detects transfer
4. POST /deposits/webhook/sepay    → SePay calls webhook
5. System matches order_code in transfer content (regex: /OP[A-Z0-9]+/)
6. Verifies amount >= order.amount_vnd
7. Credits tokens to user balance
```

**QR generation:** Uses SePay's QR service: `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...`

---

## 2. Identified Gaps & Issues

### 2.1 Security Gaps (CRITICAL)

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **Webhook signature verification NOT implemented** | HIGH | `deposit.controller.ts:162` - commented out `x-sepay-signature` check |
| 2 | **No idempotency guard** on webhook | MEDIUM | `deposit.service.ts:177` - duplicate webhook = duplicate credit |
| 3 | **No IP whitelist** for webhook endpoint | MEDIUM | Route is fully public |
| 4 | Bank credentials hardcoded as fallback | LOW | `deposit.service.ts:12-14` (env vars exist but defaults exposed) |

### 2.2 Reliability Gaps

| # | Issue | Impact |
|---|-------|--------|
| 1 | **No reconciliation job** - missed webhooks = lost payments | User loses money |
| 2 | **No DB transaction** wrapping order update + token credit | Partial state possible |
| 3 | **10-minute order expiry** is very short for bank transfers | User may transfer after expiry |
| 4 | **No retry mechanism** if token credit fails after payment confirmed | Inconsistent state |
| 5 | Expired order check only on `createDeposit` and `formatDepositResponse` | Stale data in DB |

### 2.3 Feature Gaps

| # | Feature | Current State |
|---|---------|---------------|
| 1 | Auto-notification when payment confirmed | Not implemented |
| 2 | Refund handling | Not implemented |
| 3 | Payment receipt/invoice generation | Not implemented |
| 4 | Rate limiting on deposit creation | Only "1 pending order" guard |
| 5 | Subscription/recurring payments | Not applicable (prepaid model) |
| 6 | Overpayment handling | Silently accepted (amount >= check) |

---

## 3. Recommended Improvements

### Priority 1: Security (Must-Have)

**A. Implement webhook signature verification**
- SePay sends API key in header or uses signature-based auth
- Validate against `SEPAY_WEBHOOK_SECRET` env var
- Reject requests that don't match

**B. Add idempotency to webhook processing**
- Store `referenceCode` (SePay transaction ID) in deposit order
- Before processing, check if this referenceCode was already processed
- Return success without re-crediting tokens

**C. Wrap payment confirmation in DB transaction**
```
BEGIN
  → Update deposit_orders status = 'completed'
  → Insert token_transactions (credit)
  → Update users.token_balance
COMMIT
```

### Priority 2: Reliability (Should-Have)

**A. Reconciliation cron job**
- Every 15-30 min, query SePay Transaction API for recent transfers
- Match against pending orders that haven't received webhooks
- Auto-complete matched orders
- SePay API rate limit: 2 calls/sec

**B. Extend order expiry**
- 10 min → 30 min or 1 hour for bank transfers
- Bank transfers can take 1-5 min to process, user needs time to open banking app

**C. Handle overpayment**
- If `transferAmount > order.amount_vnd`, credit exact token_amount (not more)
- Log overpayment for admin review

**D. Handle late payments (after expiry)**
- If transfer arrives after order expired: auto-reactivate order and credit tokens
- Better UX than losing customer's money

### Priority 3: Features (Nice-to-Have)

**A. Payment notification via webhook/SSE to frontend**
- When payment confirmed, push notification to user's active session
- Simple approach: polling from frontend every 5s while on payment page

**B. Admin dashboard enhancements**
- Revenue reports (daily/weekly/monthly)
- Failed payment tracking
- Conversion rate (orders created vs completed)

---

## 4. SePay Integration Deep Dive

### 4.1 SePay Capabilities

| Feature | Details |
|---------|---------|
| QR Code | VietQR standard, works with 30+ VN banks |
| Webhook | Real-time notification on bank transfer detection |
| API | Transaction query for reconciliation (2 req/sec) |
| Auth | API Key header OR OAuth 2.0 |
| Retry | Auto-retries failed webhooks 7 times over 5 hours |
| Pricing | Free tier available; Startup ~1M VND/month for 180 tx |

### 4.2 Webhook Payload (from SePay docs)

```json
{
  "id": 123456,
  "gateway": "BIDV",
  "transactionDate": "2026-02-06 10:30:00",
  "accountNumber": "96247CISI1",
  "subAccount": null,
  "transferType": "in",
  "transferAmount": 500000,
  "accumulated": 1500000,
  "code": null,
  "content": "OP M2X3Y4Z5 chuyen khoan",
  "referenceCode": "FT26037123456",
  "description": "BIDV-FT26037123456-OP M2X3Y4Z5"
}
```

**Critical:** Response MUST be HTTP 200 + `{"success": true}` — else SePay retries.

### 4.3 Current Implementation vs Best Practice

| Aspect | Current | Recommended |
|--------|---------|-------------|
| Webhook auth | None (commented out) | API Key header validation |
| Idempotency | None | Check referenceCode before processing |
| DB transaction | Separate queries | Single DB transaction |
| Error response | Returns error JSON | Always return 200 + success:true (log errors internally) |
| Order matching | Regex on content field | Regex + fallback to exact amount matching |
| Reconciliation | None | Cron job via SePay Transaction API |

---

## 5. Recommended Implementation Plan

### Phase 1: Harden Existing Payment Flow (1-2 days)
1. Add webhook signature/API key verification
2. Add idempotency guard (store + check referenceCode)
3. Wrap payment confirmation in DB transaction
4. Extend order expiry to 30 min
5. Handle late payments (after expiry)
6. Always respond 200 to SePay (log errors internally)

### Phase 2: Reconciliation & Monitoring (1 day)
1. Add SePay Transaction API client
2. Create reconciliation cron job (check unmatched pending orders)
3. Admin alert for failed/orphan payments
4. Log all webhook payloads for debugging

### Phase 3: UX Improvements (1 day)
1. Frontend polling for payment status
2. Payment success notification
3. Better error messages for users
4. Overpayment handling + admin review

### Phase 4: Admin & Analytics (Optional)
1. Revenue dashboard
2. Payment conversion funnel
3. Export/invoice generation

---

## 6. Key Decisions Needed

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Order expiry time | 10min / 30min / 1hr | **30 min** — balances UX vs order spam |
| 2 | Overpayment policy | Credit exact tokens / Credit proportional | **Exact tokens** — refund difference manually |
| 3 | Late payment handling | Reject / Auto-credit | **Auto-credit** — never lose customer money |
| 4 | Webhook auth method | API Key / IP whitelist / Both | **API Key** — simpler, SePay supports it |
| 5 | Reconciliation frequency | 5min / 15min / 30min | **15 min** — sufficient for most cases |
| 6 | Frontend notification | Polling / SSE / WebSocket | **Polling (5s)** — simplest, sufficient for payment page |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Webhook forgery (no auth) | HIGH | CRITICAL | Implement API key verification immediately |
| Double-credit from duplicate webhook | MEDIUM | HIGH | Idempotency via referenceCode |
| Lost payment (webhook missed) | LOW | HIGH | Reconciliation cron job |
| Partial state (credit without status update) | LOW | HIGH | DB transaction |
| SePay service outage | LOW | MEDIUM | Manual admin credit as fallback |

---

## 8. Summary

**Good news:** The foundation is solid. Token management, deposit orders, SePay QR, and webhook endpoint all exist and work.

**Bad news:** Critical security gap (no webhook verification) and reliability issues (no idempotency, no DB transaction, no reconciliation) need to be fixed before going to production.

**Effort estimate:** Phase 1-3 = ~3-4 days of development. Phase 1 (security hardening) is the highest priority and should be done first.

**Bottom line:** The system is 70% complete. The remaining 30% is the hardest part — making it production-safe and bulletproof against edge cases.
