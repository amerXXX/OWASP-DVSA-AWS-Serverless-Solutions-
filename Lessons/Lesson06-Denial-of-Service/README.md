# Lesson 6 · Denial of Service (DoS)

## Vulnerability Summary
The billing Lambda (`DVSA-ORDER-BILLING`) processes each request synchronously and takes 2–4 seconds per call (simulated payment processor delay). With no rate limiting or idempotency protection, flooding the endpoint with concurrent requests consumes Lambda concurrency slots and degrades service for legitimate users.

## Root Cause
- Billing is handled **synchronously** with a slow downstream path (~2–4 s per request)
- No **per-user throttling** or **queue-based isolation**
- No **idempotency check** — the same order can be billed multiple times concurrently
- Missing **atomic state transitions** in DynamoDB allow parallel executions

## AWS Components
| Component | Role |
|-----------|------|
| API Gateway `/order` | Entry point |
| Lambda (DVSA-ORDER-BILLING) | Slow synchronous billing handler |
| Amazon DynamoDB | Order state store |
| CloudWatch Metrics | Throttle evidence |

## Tools Used
- `curl` (parallel requests with `&`)
- `time` utility
- CloudWatch Metrics

## Reproduction Steps

### Step 1 — Baseline a Single Request
```bash
time curl -s $API \
  -H "content-type: application/json" \
  -H "authorization: $TOKEN" \
  --data '{"action":"pay","order-id":"<ORDER_ID>"}' | jq
```
Note the real time (~8–10 seconds including Lambda overhead).

### Step 2 — Send 20 Concurrent Billing Requests
```bash
for i in $(seq 1 20); do
  curl -s $API \
    -H "content-type: application/json" \
    -H "authorization: $TOKEN" \
    --data '{"action":"pay","order-id":"<ORDER_ID>"}' &
done; wait
```

### Step 3 — Observe Degradation
In a second terminal, run a legitimate billing request during the burst and measure how much slower it has become.

### Step 4 — Check CloudWatch
- Go to **Lambda → DVSA-ORDER-BILLING → Monitor**
- View the **Throttles** metric during the burst window
- Expect ~30 throttle events at peak

## Evidence
- Single request: ~8–10 seconds
- Concurrent burst: legitimate requests see increased latency or `Internal server error`
- CloudWatch shows throttle spikes between 13:50–14:10

## Fix Summary
Add an **atomic DynamoDB state lock** before contacting the payment processor:

```python
# Atomically claim the order — only one concurrent request can succeed
response = dynamodb.update_item(
    TableName=ORDERS_TABLE,
    Key={"orderId": {"S": order_id}},
    UpdateExpression="SET orderStatus = :inprogress",
    ConditionExpression="orderStatus = :open",
    ExpressionAttributeValues={
        ":inprogress": {"S": "billing-in-progress"},
        ":open": {"S": "open"}
    }
)
```

Additionally:
- Enable **API Gateway Usage Plans** with per-user rate limits
- Enable **stage-level throttling**

See [`/Codefix/Lesson06-Denial-of-Service/`](../../Codefix/Lesson06-Denial-of-Service/) for the full patched `order_billing.py`.

## Verification After Fix
- First request: ~4.9 s — succeeds (order locked)
- Second concurrent request: ~4.3 s — blocked (`"order is not eligible for billing"`)

## Lessons Learned
Availability vulnerabilities can arise from **race conditions in business logic**, not just injection or auth flaws. In serverless environments, Lambda auto-scales — so slow handlers amplify the impact. Always enforce **atomic operations**, **idempotency**, and **rate limiting**.
