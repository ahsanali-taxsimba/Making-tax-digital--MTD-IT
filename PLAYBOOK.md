# Accountant playbook

Typical first-week workflow for a practice onboarding onto Making Tax Digital IT.

## 1. Create the firm workspace

The seed firm **Northbridge Accountants LLP** is created automatically. In production an onboarding job would insert the firm, then the first admin would sign in.

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marco.r@example.org","password":"PracticeAdmin123!"}'
```

Store `accessToken` as `TOKEN`.

Confirm the firm:

```bash
curl -s http://localhost:3000/firms/me -H "Authorization: Bearer $TOKEN"
```

## 2. Add colleagues and clients

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alex Reed","email":"ethan.b@example.com","role":"ACCOUNTANT","password":"PracticeAdmin123!"}'

curl -s -X POST http://localhost:3000/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"INDIVIDUAL","name":"Samira Khan","utr":"1122334455","vatRegistrationNumber":"777777777","nino":"BB123456B","niNumber":"BB123456B"}'
```

## 2b. Chart of accounts

A new client gets the matching UK chart automatically:

| Client type | Profile |
| --- | --- |
| `INDIVIDUAL` / `PARTNERSHIP` | `sole_trader` |
| `LANDLORD` | `landlord` |
| `COMPANY` | `company` |

```bash
curl -s http://localhost:3000/chart-of-accounts -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/clients/$CLIENT_ID/chart-of-accounts -H "Authorization: Bearer $TOKEN"
```

Apply a second profile when the same person has a property business:

```bash
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/chart-of-accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"profile":"landlord"}'
```

Post bookkeeping against a numbered account via `POST /clients/:id/transactions` with that account's `ledgerId`, or use the double-entry engine at `/bookkeeping/*`.

```bash
curl -s "http://localhost:3000/bookkeeping/chart-of-accounts?clientId=$CLIENT_ID" -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/bookkeeping/journals \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"'"$CLIENT_ID"'","date":"2026-04-20","description":"Studio receipt","lines":[{"ledgerAccountId":"BANK_LEDGER_ID","debit":5000,"credit":0},{"ledgerAccountId":"SALES_LEDGER_ID","debit":0,"credit":5000,"taxCodeId":"77777777-7777-4777-8777-777777777701"}]}'
curl -s "http://localhost:3000/bookkeeping/ledger/trial-balance?clientId=$CLIENT_ID&periodStart=2026-04-06&periodEnd=2026-07-05" \
  -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/bookkeeping/vat/summary?clientId=$CLIENT_ID&periodStart=2026-01-01&periodEnd=2026-03-31" \
  -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/bookkeeping/itsa/summary?clientId=$CLIENT_ID&businessType=sole_trader&periodStart=2026-04-06&periodEnd=2026-07-05" \
  -H "Authorization: Bearer $TOKEN"
```

Seeded Amelia Hartley already has a Q1 VAT invoice/bill and Q1 2025-26 ITSA journals, plus bank account `88888888-8888-4888-8888-888888888888`. Unmatched Yapily lines `MATCH-INV-1001` (£7,200 credit) and `MATCH-BILL-88` (£1,200 debit) are ready for invoice/bill matching.

```bash
curl -s -X POST http://localhost:3000/yapily/transactions/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"'"$CLIENT_ID"'","from":"2026-01-01","to":"2026-06-30","autoPost":true}'
curl -s "http://localhost:3000/yapily/pipeline?clientId=$CLIENT_ID" -H "Authorization: Bearer $TOKEN"
```

```bash
curl -s "http://localhost:3000/matching/suggestions?clientId=$CLIENT_ID" -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/matching/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"suggestionId":"SUGGESTION_ID"}'
curl -s -X POST http://localhost:3000/matching/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"suggestionId":"SUGGESTION_ID"}'
```

Ledger codes roll into HMRC ITSA boxes. Capital spend and disallowable entertainment stay off the quarterly update.

```bash
curl -s http://localhost:3000/itsa/mapping -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/itsa/validate?clientId=$CLIENT_ID&businessId=44444444-4444-4444-8444-444444444444&fromLedger=true&periodStart=2026-04-06&periodEnd=2026-07-05" \
  -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/itsa/updates/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"businessId":"44444444-4444-4444-8444-444444444444","periodStart":"2026-04-06","periodEnd":"2026-07-05"}'
```

Submit from the ledger instead of typing boxes:

```bash
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/itsa/updates \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"businessId":"...","taxYear":"2025-26","periodId":"2026-04-06_2026-07-05","periodStart":"2026-04-06","periodEnd":"2026-07-05","fromLedger":true}'
```

VAT and ITSA both talk to HMRC only through `HmrcClientService`. Tokens are refreshed automatically before a call and retried once after a 401. Failures use the shared `HMRC_ERR_*` codes.

The connection UI at http://localhost:2327 walks accountants and clients through Connect → HMRC callback → status → obligations for both VAT (`/vat`) and ITSA (`/itsa`). Live HMRC returns to `/hmrc/callback`; mock mode completes the grant locally on `/vat/callback` or `/itsa/callback` with the stored OAuth `state`. HMRC tokens never appear in the browser.

Clients sign in at the same URL and land on `/portal` to see due dates, VAT boxes, ITSA updates, documents, and a notes thread. They can confirm records and approve a draft without seeing HMRC tokens.

## 3. Connect HMRC

```bash
curl -s "http://localhost:3000/hmrc/oauth/start?clientId=$CLIENT_ID&environment=sandbox" \
  -H "Authorization: Bearer $TOKEN"
```

Open `authorizationUrl` in a browser. In `HMRC_MODE=mock` you can complete the grant by calling the callback yourself:

```bash
curl -s "http://localhost:3000/hmrc/oauth/callback?code=sandbox-code&state=$STATE&environment=sandbox"
```

Check status or disconnect:

```bash
curl -s "http://localhost:3000/hmrc/oauth/status?clientId=$CLIENT_ID&environment=sandbox" \
  -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/hmrc/oauth/disconnect \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"'"$CLIENT_ID"'","environment":"sandbox"}'
```

Legacy aliases `POST /clients/:id/mtd/start-auth`, `GET /mtd/callback`, and `GET /clients/:id/mtd/status` still work.

For the real HMRC sandbox, set `HMRC_MODE=sandbox` (or `HMRC_SANDBOX=true`). `GET /hmrc/environment` shows the gateway flag; `POST /hmrc/environment` `{ "sandbox": true }` switches hosts. Create a test user with `POST /hmrc/sandbox/test-users` (`organisation` for VAT, `individual` for ITSA), then `POST /hmrc/sandbox/test-users/:id/login` to get the grant URL and password. ITSA quarterly updates and EOPS are submitted with PUT.

## 4. Fetch obligations and work the task list

```bash
curl -s http://localhost:3000/clients/$CLIENT_ID/vat/obligations -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/clients/$CLIENT_ID/itsa/obligations -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/tasks -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/notifications -H "Authorization: Bearer $TOKEN"
```

Open obligations automatically create tasks (`MTD_VAT_RETURN`, `MTD_ITSA_UPDATE`, and so on).

## 5. Submit VAT

The VAT engine exposes firm-scoped routes plus the original client-scoped aliases. Box 3 must equal Box 1 + Box 2. Box 5 must equal Box 3 − Box 4 (HMRC stores the absolute net). `GET /vat/validate` runs arithmetic, negative-box, 20% VAT, EU/NI, zero-return, and obligation-period checks. Errors block `POST /vat/returns/submit`; warnings do not.

```bash
curl -s http://localhost:3000/vat/mapping -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/vat/obligations?clientId=$CLIENT_ID" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/vat/validate?clientId=$CLIENT_ID&fromLedger=true&periodStart=2026-01-01&periodEnd=2026-03-31&periodKey=26A1" \
  -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/vat/returns/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"periodStart":"2026-01-01","periodEnd":"2026-03-31","periodKey":"26A1"}'
```

Submit from the ledger, or type the boxes yourself:

```bash
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/vat/returns \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"periodKey":"26A1","fromLedger":true,"finalised":true}'

curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/vat/returns \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "periodKey":"26A1",
    "vatDueSales":1200,
    "vatDueAcquisitions":0,
    "totalVatDue":1200,
    "vatReclaimedCurrPeriod":200,
    "netVatDue":1000,
    "totalValueSalesExVAT":6000,
    "totalValuePurchasesExVAT":1000,
    "totalValueGoodsSuppliedExVAT":0,
    "totalAcquisitionsExVAT":0,
    "finalised":true
  }'
```

Then review payments and the audit trail:

```bash
curl -s http://localhost:3000/clients/$CLIENT_ID/vat/payments -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/audit/logs?clientId=$CLIENT_ID" -H "Authorization: Bearer $TOKEN"
```

## 6. Submit ITSA

The ITSA engine validates period dates, HMRC categories, capital exclusion, zero updates, and EOPS/Final Declaration completeness. Use `POST /itsa/quarterly-update`, `POST /itsa/eops`, and `POST /itsa/final-declaration` with a `clientId`, or the client-scoped aliases below.

Quarterly update (one per business — sole trader and property are separate):

```bash
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/itsa/updates \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "businessId":"44444444-4444-4444-8444-444444444444",
    "taxYear":"2025-26",
    "periodId":"2026-04-06_2026-07-05",
    "periodStart":"2026-04-06",
    "periodEnd":"2026-07-05",
    "incomes":{"turnover":12500},
    "expenses":{"officeCosts":800}
  }'
```

End of Period Statement and Final Declaration follow the same pattern on `/itsa/eops` and `/itsa/final-declaration`.

## 7. Client portal and outbound webhooks

A client user can view obligations and upload supporting document metadata:

```bash
curl -s http://localhost:3000/portal/obligations -H "Authorization: Bearer $CLIENT_TOKEN"
curl -s -X POST http://localhost:3000/portal/documents \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"q1-invoices.pdf","mimeType":"application/pdf","sizeBytes":20480}'
```

Practice-management tools subscribe with a signed webhook:

```bash
curl -s -X POST http://localhost:3000/webhooks/endpoints \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://practice.example/hooks/mtd","events":["CLIENT_CREATED","VAT_RETURN_SUBMITTED"]}'
```

Payloads are HMAC-SHA256 signed with the firm `webhookSecret` using `timestamp.body`.
