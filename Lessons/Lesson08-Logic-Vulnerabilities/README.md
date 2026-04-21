# Lesson 8 · Logic Vulnerabilities (Race Condition)

## Vulnerability Summary
A race condition in the DVSA order-processing workflow allows an attacker to send concurrent billing and update requests to the same order, causing the application to bill the original price while applying a larger quantity — effectively getting more items for free.

## Root Cause
The billing Lambda and update Lambda both perform separate **read-then-write** operations on the same DynamoDB record **without atomic guarantees**. Since neither function locks the record before operating, concurrent requests can both pass validation simultaneously and write conflicting data.

## AWS Components
| Component | Role |
|-----------|------|
| Lambda (DVSA-ORDER-BILLING) | Reads order total and charges |
| Lambda (DVSA-UPDATE-ORDER) | Updates item quantity |
| Amazon DynamoDB (DVSA-ORDERS-DB) | Shared state — no locking |

## Tools Used
- `curl` with `&` (parallel background requests)
- AWS Console (DynamoDB Explorer)

## Reproduction Steps

### Step 1 — Create a Cheap Order
Place an order for 1 unit of a $28 item. Note the `order-id`.

### Step 2 — Send Concurrent Billing + Update
```bash
# Terminal 1 — billing request (charges $28 for 1 item)
curl -s $API \
  -H "content-type: application/json" \
  -H "authorization: $TOKEN" \
  --data '{"action":"billing","order-id":"<ORDER_ID>","data":{"ccn":"4242424242424242","exp":"11/29","cvv":"123"}}' &

# Terminal 2 — concurrent update (changes quantity to 5)
curl -s $API \
  -H "content-type: application/json" \
  -H "authorization: $TOKEN" \
  --data '{"action":"update","order-id":"<ORDER_ID>","items":{"11":5}}' &

wait
```

### Step 3 — Verify in DynamoDB
1. Go to **DynamoDB → Explore Items → DVSA-ORDERS-DB**
2. Find the item by `order-id`
3. Check `itemList` — quantity is now 5
4. Check `totalAmount` — still shows $28 (billed at 1-item price)

The attacker received 5 items but was only charged for 1.

## Evidence
DynamoDB shows `itemList: {"11": {"N": "5"}}` but `confirmationToken` reflects a $28 payment — inconsistent state caused by the race condition.

## Fix Summary
Two Lambda functions were patched with **DynamoDB ConditionExpression locking**:

**order_billing.py — atomic billing lock:**
```python
lock_response = table.update_item(
    Key=key,
    UpdateExpression="SET orderStatus = :billing",
    ConditionExpression="attribute_exists(orderId) AND orderStatus = :open",
    ExpressionAttributeValues={":open": 100, ":billing": 115},
    ReturnValues="ALL_OLD"
)
```

**update_order.py — block updates during billing:**
```python
response = table.update_item(
    Key=key,
    UpdateExpression="SET itemList = :itemList",
    ConditionExpression="attribute_exists(orderId) AND orderStatus = :open",
    ExpressionAttributeValues={":itemList": itemList, ":open": 100}
)
```

See [`/Codefix/Lesson08-Logic-Vulnerabilities/`](../../Codefix/Lesson08-Logic-Vulnerabilities/) for the full patched files.

## Verification After Fix
Running the same concurrent attack returns:
```json
{"status":"err","msg":"order can no longer be updated"}
```
The billing proceeds correctly and the order total remains accurate.

## Lessons Learned
Security vulnerabilities can arise from **incorrect business logic**, not just injection or auth flaws. In serverless architectures, concurrent Lambda executions can race. Always enforce **atomic operations** and **state transitions** — assume any two requests can arrive simultaneously.
