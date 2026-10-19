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

Post bookkeeping against a numbered account via `POST /clients/:id/transactions` with that account's `ledgerId`.

Ledger codes roll into HMRC ITSA boxes. Capital spend and disallowable entertainment stay off the quarterly update.

```bash
curl -s http://localhost:3000/itsa/mapping -H "Authorization: Bearer $TOKEN"
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

## 3. Connect HMRC

```bash
curl -s -X POST http://localhost:3000/clients/$CLIENT_ID/mtd/start-auth \
  -H "Authorization: Bearer $TOKEN"
```

Open `redirectUrl` in a browser. In `HMRC_MODE=mock` you can complete the grant by calling the callback yourself:

```bash
curl -s "http://localhost:3000/mtd/callback?code=sandbox-code&state=$STATE"
```

Check status:

```bash
curl -s http://localhost:3000/clients/$CLIENT_ID/mtd/status \
  -H "Authorization: Bearer $TOKEN"
```

## 4. Fetch obligations and work the task list

```bash
curl -s http://localhost:3000/clients/$CLIENT_ID/vat/obligations -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/clients/$CLIENT_ID/itsa/obligations -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/tasks -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/notifications -H "Authorization: Bearer $TOKEN"
```

Open obligations automatically create tasks (`MTD_VAT_RETURN`, `MTD_ITSA_UPDATE`, and so on).

## 5. Submit VAT

```bash
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
    "expenses":{"adminCosts":800}
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
