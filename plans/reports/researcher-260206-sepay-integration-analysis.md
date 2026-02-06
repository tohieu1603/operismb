# SePay Payment Gateway Integration Research

**Date**: 2026-02-06
**Topic**: SePay (sepay.vn) Integration for Node.js/Express/TypeScript SaaS Billing
**Status**: Complete Research Report

---

## Executive Summary

SePay is a Vietnamese payment gateway and banking API platform providing payment collection, bank transfer verification, and VietQR integration. Suitable for Node.js/Express/TypeScript integration with webhook-based payment notifications and polling-based transaction reconciliation. Primary use case: bank transfer verification for Vietnam-based SaaS billing systems.

---

## 1. SePay API Capabilities Overview

### Core Features
- **VietQR QR Code Generation**: Generate QR codes for bank transfers with amount, account, bank code, and description
- **Bank Transfer Verification**: Real-time notification via webhooks when payments received
- **Transaction Query API**: Proactive polling for reconciliation, transaction history, details lookup
- **Virtual Account (VA)**: Order-based virtual accounts for isolated payment tracking
- **Multi-Bank Support**: 30+ Vietnamese banks including Vietcombank, VPBank, VIB, VietinBank, MBBank, ACB

### Authentication Methods
- **Basic Authentication**: Base64 encoded (merchant_id:secret_key) in Authorization header
- **OAuth 2.0**: Token-based authentication with refresh capability
- **Webhook Options**: No auth, API Key, or OAuth 2.0

### Key Limitations
- **Rate Limit**: 2 requests/second (HTTP 429 on exceed)
- **Retry Behavior**: SePay retries failed webhooks 7 times max, 5-hour window with Fibonacci intervals
- **Connection Timeout**: 5 seconds; Response timeout: 8 seconds

---

## 2. Payment Flow Architecture

### Bank Transfer Verification Flow (Webhook-based)

```
User Bank App          SePay Gateway              Your Backend
     |                     |                           |
     |-- Send Transfer --->|                           |
     |                     |-- Webhook (JSON) -------->|
     |                     |                    (detect & store)
     |                     |                           |
     |                     |<-- ACK {success:true} ----|
```

### Implementation Steps

1. **Create Payment Order**
   - Backend: Generate unique payment code/reference
   - Generate VietQR code via `qr.sepay.vn/img` endpoint
   - Display QR to user on frontend

2. **User Transfers Money**
   - User scans QR in banking app
   - User confirms payment (auto-filled amount, account, description)
   - Bank processes transfer

3. **SePay Webhook Notification**
   - SePay detects transaction on configured bank account
   - Matches payment code/reference in transfer content
   - Sends webhook POST with transaction details to your endpoint

4. **Backend Payment Verification**
   - Receive webhook at `/webhook/sepay` endpoint
   - Validate webhook authentication (API Key, OAuth, or IP whitelist)
   - Extract transaction ID, amount, reference code
   - Store in database with `pending` status
   - Respond `{success: true}` to SePay (200 or 201 status)

5. **Order Fulfillment**
   - Mark order paid in database
   - Trigger subscription activation, product delivery, etc.

### Optional: Polling-based Reconciliation

For critical orders or missed webhooks:
- Use Transaction Query API: `GET /api/v1/transactions` with filters
- Query by date range, bank account, reference code, or transaction ID
- Maximum 2 calls/second, 100 items/page pagination
- Compare with local database to catch missing webhooks

---

## 3. SePay Webhook Format & Authentication

### Webhook Payload Structure

```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2023-03-25 14:02:37",
  "accountNumber": "0123499999",
  "code": null,
  "content": "transfer to buy iphone",
  "transferType": "in",
  "transferAmount": 2277000,
  "accumulated": 19077000,
  "subAccount": null,
  "referenceCode": "MBVCB.3278907687",
  "description": ""
}
```

### Field Mapping for Billing
- `id`: Transaction ID (unique)
- `transferAmount`: Payment amount (in VND)
- `content`: Transfer description (use for payment code detection)
- `referenceCode`: Bank reference (for reconciliation)
- `transactionDate`: Payment timestamp
- `gateway`: Bank name (logging/audit)
- `accountNumber`: Receiving bank account (verify matches config)

### Authentication Options (Choose One)

#### Option A: API Key (Recommended for simplicity)
```
Header: Authorization: APIkey_YOUR_API_KEY_HERE
Content-Type: application/json
```

**Verification**: Check Authorization header equals expected API key

#### Option B: No Authentication + IP Whitelist (Not recommended for production)
```
// SePay IP whitelist in firewall
// Verify webhook source IP
```

#### Option C: OAuth 2.0 (Recommended for security)
```
Header: Authorization: Bearer ACCESS_TOKEN
Configured in SePay dashboard with Access Token URL, Client ID, Client Secret
```

### Success Response Requirements

```typescript
// Must respond with proper HTTP status + JSON body
// Status: 200 or 201
// Body: JSON with success: true
{
  "success": true,
  "message": "Payment verified and stored"
}
```

**Critical**: If response doesn't meet conditions, SePay marks webhook as failed and retries.

### Webhook Configuration in SePay Dashboard

1. Dashboard: my.sepay.vn → Webhooks
2. Set Call URL: `https://yourdomain.com/api/webhooks/sepay`
3. Choose authentication: API Key (recommended)
4. Select trigger banks (or all banks)
5. Optional: Enable "Payment Verification WebHook" for additional verification step
6. Optional: Specify Virtual Accounts (VA) to filter notifications
7. Test: Use "Simulate Transaction" to test webhook delivery

---

## 4. Integration Best Practices for SaaS Billing

### Database Schema

```typescript
// User Subscription/Order
interface Order {
  id: string;
  userId: string;
  amount: number; // VND
  paymentCode: string; // unique reference for transfer content
  status: 'pending' | 'paid' | 'failed' | 'expired';
  createdAt: Date;
  paidAt?: Date;
  expiresAt: Date; // typically 24-48 hours
}

// Webhook Log (for audit trail)
interface WebhookLog {
  id: string;
  sepayTransactionId: number;
  orderId: string;
  referenceCode: string;
  amount: number;
  transferDate: Date;
  status: 'processed' | 'duplicate' | 'mismatch';
  raw: any; // store entire webhook payload
  processedAt: Date;
}
```

### Key Implementation Considerations

#### 1. Payment Code Detection (Critical)
- Embed order ID in transfer `content` field
- Example format: "OPERSB_ORDER_12345"
- SePay webhook setting: Enable "Payment Code Recognition"
- Webhook only triggers if payment code detected in transfer content
- Reduces false positive webhook triggers

#### 2. Idempotency & Deduplication
- Track `sepayTransactionId` (the `id` field) in webhook log
- Always check: `IF NOT EXISTS (id + referenceCode + amount)` before processing
- Combine fields for uniqueness: `id + referenceCode + transferType + transferAmount`
- Prevents double-charging if webhook retried

#### 3. Amount Verification
- Compare webhook `transferAmount` with order amount
- Handle rounding: Store amounts as integers (cents or smallest currency unit)
- Log mismatches for manual review (partial payments, overpayments)

#### 4. Timestamp Handling
- SePay provides `transactionDate` (when bank processed)
- Store both webhook `receivedAt` and transaction `transactionDate`
- Audit trail: track discrepancies between actual and reported times

#### 5. Error Handling & Retries
- SePay automatically retries failed webhooks
- Your endpoint must respond 200/201 + `{success: true}` quickly
- Offload heavy processing to async job queue
- Database transaction: save webhook → queue job → respond success
- Use transactional outbox pattern for reliable order updates

#### 6. Testing Strategy
- SePay Sandbox: `https://pgapi-sandbox.sepay.vn`
- Test account available at my.sepay.vn
- "Simulate Transaction" feature for testing without real transfers
- Monitor: Dashboard → Logs → WebHooks Log for delivery status

### Node.js/Express/TypeScript Implementation Example

#### Setup
```bash
npm install express-validator crypto dotenv
npm install --save-dev @types/express @types/node typescript
```

#### Webhook Endpoint
```typescript
// src/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db'; // your database
import { logger } from '../logger';

const router = Router();

router.post(
  '/sepay',
  body('id').isInt().notEmpty(),
  body('transferAmount').isInt().notEmpty(),
  body('content').isString(),
  body('referenceCode').isString(),
  async (req: Request, res: Response) => {
    // Validate request format
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Invalid webhook payload', errors.array());
      return res.status(400).json({ success: false });
    }

    // Verify API Key authentication
    const authHeader = req.headers.authorization || '';
    if (authHeader !== `APIkey_${process.env.SEPAY_API_KEY}`) {
      logger.warn('Unauthorized webhook attempt');
      return res.status(401).json({ success: false });
    }

    const {
      id: sepayId,
      transferAmount,
      content,
      referenceCode,
      transactionDate,
      accountNumber,
      gateway
    } = req.body;

    try {
      // Extract payment code from content
      const match = content.match(/OPERSB_ORDER_(\d+)/);
      const orderId = match ? match[1] : null;

      if (!orderId) {
        logger.info('Webhook ignored: no payment code in content', { content });
        return res.status(200).json({ success: true }); // Still respond success
      }

      // Check for duplicate webhook
      const existing = await db.webhookLog.findUnique({
        where: { sepayTransactionId: sepayId }
      });

      if (existing) {
        logger.info('Duplicate webhook detected, skipping', { sepayId });
        return res.status(200).json({ success: true });
      }

      // Fetch order and verify amount
      const order = await db.order.findUnique({ where: { id: orderId } });
      if (!order) {
        logger.warn('Order not found', { orderId });
        // Log webhook for manual investigation
        await db.webhookLog.create({
          data: {
            sepayTransactionId: sepayId,
            orderId,
            referenceCode,
            amount: transferAmount,
            transferDate: new Date(transactionDate),
            status: 'mismatch',
            raw: req.body
          }
        });
        return res.status(200).json({ success: true });
      }

      // Verify amount matches
      if (order.amount !== transferAmount) {
        logger.warn('Amount mismatch', {
          orderId,
          expected: order.amount,
          received: transferAmount
        });
        await db.webhookLog.create({
          data: {
            sepayTransactionId: sepayId,
            orderId,
            referenceCode,
            amount: transferAmount,
            transferDate: new Date(transactionDate),
            status: 'mismatch',
            raw: req.body
          }
        });
        return res.status(200).json({ success: true });
      }

      // Process payment (queue async job)
      await db.$transaction(async (tx) => {
        // Log webhook
        await tx.webhookLog.create({
          data: {
            sepayTransactionId: sepayId,
            orderId,
            referenceCode,
            amount: transferAmount,
            transferDate: new Date(transactionDate),
            status: 'processed',
            raw: req.body
          }
        });

        // Update order
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'paid',
            paidAt: new Date(),
            sepayReferenceCode: referenceCode
          }
        });

        // Queue subscription activation job
        await queue.enqueue('activate_subscription', { orderId });
      });

      logger.info('Payment processed successfully', { orderId, sepayId });
      return res.status(200).json({ success: true });

    } catch (error) {
      logger.error('Webhook processing error', error);
      // Don't respond success if critical error - let SePay retry
      return res.status(500).json({ success: false });
    }
  }
);

export default router;
```

#### Reconciliation Job (Optional, for safety)
```typescript
// src/jobs/reconcile-sepay-payments.ts
import { db } from '../db';
import { sepayApi } from '../services/sepay-api';

export async function reconcileSepayPayments() {
  // Find unpaid orders older than 1 hour
  const orders = await db.order.findMany({
    where: {
      status: 'pending',
      createdAt: {
        lt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      }
    }
  });

  for (const order of orders) {
    try {
      // Query SePay for transactions matching this order
      const transactions = await sepayApi.getTransactions({
        accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,
        minAmount: order.amount - 100,
        maxAmount: order.amount + 100,
        fromDate: order.createdAt,
        toDate: new Date()
      });

      // Look for matching transfer
      const match = transactions.data.find(tx =>
        tx.content.includes(`ORDER_${order.id}`) &&
        tx.transferAmount === order.amount
      );

      if (match) {
        // Manually verify and mark as paid
        await db.order.update({
          where: { id: order.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
            sepayTransactionId: match.id
          }
        });

        logger.info('Order verified via reconciliation', {
          orderId: order.id,
          sepayId: match.id
        });
      }
    } catch (error) {
      logger.error('Reconciliation error for order', { orderId: order.id, error });
    }
  }
}
```

#### API Client
```typescript
// src/services/sepay-api.ts
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

export class SePayAPI {
  private baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://api.sepay.vn'
    : 'https://pgapi-sandbox.sepay.vn';

  private merchantId = process.env.SEPAY_MERCHANT_ID;
  private secretKey = process.env.SEPAY_SECRET_KEY;

  private getAuthHeader() {
    const credentials = Buffer.from(`${this.merchantId}:${this.secretKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async getTransactions(filters: {
    accountNumber: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams({
      account_number: filters.accountNumber,
      page: String(filters.page || 1),
      per_page: String(filters.limit || 50)
    });

    if (filters.fromDate) {
      params.append('fromDate', filters.fromDate.toISOString().split('T')[0]);
    }
    if (filters.toDate) {
      params.append('toDate', filters.toDate.toISOString().split('T')[0]);
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/transactions?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`SePay API error: ${response.statusText}`);
    }

    return response.json();
  }

  generateVietQRUrl(params: {
    accountNumber: string;
    bankCode: string;
    amount: number;
    description: string;
  }) {
    const searchParams = new URLSearchParams({
      accountNo: params.accountNumber,
      bankCode: params.bankCode,
      amount: String(params.amount),
      addInfo: params.description
    });

    return `https://qr.sepay.vn/img?${searchParams.toString()}`;
  }
}

export const sepayApi = new SePayAPI();
```

---

## 5. SePay Pricing & Fees

### Pricing Tiers

| Package | Transactions/Month | Price | Target |
|---------|-------------------|-------|--------|
| Free | Limited | 0 VND | Testing, low volume |
| Startup | 180 | 1,008,000 VND (~$43 USD) | Small businesses |
| Enterprise | Custom | Negotiated | High volume |

### Cost Model
- **Transaction-based pricing**: Most common
- **Per-transaction fee**: Not publicly specified (contact sales)
- **Settlement fees**: Typically 0-1.5% per transaction (Vietnam banking standard)
- **Setup**: Unknown, likely free for existing business accounts

### Recommendation
- **Suitable for SaaS**: If monthly transaction volume under 1000
- **Cost-benefit**: Cheaper than Stripe (2.9% + $0.30 per transaction) for Vietnam-focused SaaS
- **Next step**: Contact SePay sales at my.sepay.vn for exact pricing quote

---

## 6. Security & Compliance Recommendations

### Webhook Security
1. **Use API Key authentication** (recommended over no-auth)
2. **HTTPS only**: All webhook URLs must be HTTPS
3. **Whitelist SePay IPs** if available (contact support)
4. **Rate limit** your webhook endpoint (prevent abuse)
5. **Input validation**: Validate all webhook fields before processing

### Data Storage
1. **Encrypt sensitive fields**: API keys, secret keys (use environment variables)
2. **PCI compliance**: Don't store full bank account numbers
3. **Audit trail**: Log all webhook events with raw payload
4. **Data retention**: Keep webhook logs 2+ years for disputes

### Testing & Monitoring
1. **Sandbox testing**: Always test with SePay sandbox first
2. **Webhook monitoring**: Track delivery success/failure rates
3. **Alert on**: Failed orders, webhook timeouts, amount mismatches
4. **Reconciliation**: Daily reconciliation job for safety

### Error Recovery
1. **Failed webhooks**: SePay retries automatically (7 times, 5-hour window)
2. **Missed webhooks**: Use reconciliation polling as backup
3. **Order expiration**: Set 24-48 hour expiration on pending orders
4. **Manual review**: Dashboard for investigating mismatches

---

## 7. Comparison with Alternatives

| Feature | SePay | Stripe | 2Checkout |
|---------|-------|--------|-----------|
| Vietnam Bank API | Yes | No | No |
| VietQR Support | Yes | No | No |
| Webhook | Yes | Yes | Yes |
| Rate Limit | 2/sec | 100/sec | N/A |
| Pricing (Vietnam) | Competitive | 2.9% + $0.30 | 3.5% + $0.45 |
| SDK Support | PHP, Node | Multiple | Multiple |
| Learning Curve | Low (simple) | Medium | Medium |
| Best for | Vietnam SaaS | Global SaaS | Global SaaS |

---

## 8. Implementation Checklist

- [ ] Register SePay merchant account at my.sepay.vn
- [ ] Obtain merchant ID, secret key, API key
- [ ] Set up sandbox environment for testing
- [ ] Create database schema for orders and webhook logs
- [ ] Implement webhook endpoint with API key verification
- [ ] Implement order creation with unique payment codes
- [ ] Implement VietQR QR code generation
- [ ] Test webhook delivery with "Simulate Transaction"
- [ ] Implement idempotency check for webhook deduplication
- [ ] Implement reconciliation job (optional but recommended)
- [ ] Set up error logging and alerting
- [ ] Test amount mismatch handling
- [ ] Test duplicate webhook handling
- [ ] Document webhook payload format in README
- [ ] Set up production webhook URL in SePay dashboard
- [ ] Configure webhook authentication (API Key)
- [ ] Load test webhook endpoint (simulate high volume)
- [ ] Set up daily reconciliation monitoring

---

## 9. Unresolved Questions & Next Steps

### Questions Requiring SePay Support Contact
1. **Webhook signature verification**: Does SePay support HMAC-SHA256 signatures? (Research found general best practices but not SePay-specific implementation)
2. **Exact fee structure**: Per-transaction fees, settlement timelines, chargeback fees
3. **VietQR rate limits**: Any limits on QR code generation calls?
4. **IP whitelist**: Does SePay provide IP addresses for webhook source verification?
5. **SLA/Uptime**: Service level agreement, expected webhook delivery time
6. **Partial payments**: How does SePay handle underpayments or overpayments?
7. **Refunds**: Refund API or manual process only?
8. **Chargeback handling**: Process for handling disputed transactions

### Next Steps for Implementation
1. Contact SePay sales (my.sepay.vn) for exact pricing and technical questions
2. Request sandbox API credentials
3. Review official SePay Node.js SDK if available
4. Implement and test webhook endpoint in sandbox
5. Load test with simulated high-volume transactions
6. Plan payment reconciliation strategy

---

## References & Documentation

- [SePay Official Website](https://sepay.vn)
- [SePay Developer Portal](https://developer.sepay.vn)
- [SePay API Documentation](https://docs.sepay.vn)
- [SePay Webhook Integration Guide](https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook)
- [SePay API Overview](https://developer.sepay.vn/en/cong-thanh-toan/API/tong-quan)
- [EzyPayment SePay Integration Docs](https://ezyplatform.com/market/items/ezypayment/docs/sepay-integration)
- [VietQR API Overview](https://api.vietqr.vn/en)

---

**Report Status**: Complete
**Research Depth**: High (primary sources + documentation fetches)
**Ready for Implementation**: Yes
**Confidence Level**: High (based on official SePay documentation)
