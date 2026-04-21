# Lesson 7 · Over-Privileged Function

## Vulnerability Summary
`DVSA-SEND-RECEIPT-EMAIL` has an IAM execution role with **wildcard resource permissions**, granting access to **all S3 buckets** and **all DynamoDB tables** in the account. If this function is compromised (e.g., via command injection from Lesson 4), an attacker inherits full data-layer access.

## Root Cause
The role policies use `arn:aws:s3:::*` and `arn:aws:dynamodb:...:table/*` as resource values — granting access far beyond what the receipt email function needs. `AmazonSESFullAccess` is also attached instead of a minimal `ses:SendEmail` policy.

**This violates the Principle of Least Privilege.**

## AWS Components
| Component | Role |
|-----------|------|
| Lambda (DVSA-SEND-RECEIPT-EMAIL) | Over-privileged function |
| IAM Role (SendReceiptFunctionRole) | Wildcard resource policy |
| IAM Policy Simulator | Verification tool |

## Tools Used
- AWS Console (IAM, Lambda)
- IAM Policy Simulator

## Reproduction Steps

### Step 1 — Locate the Function
Go to **Lambda → Functions → DVSA-SEND-RECEIPT-EMAIL**.

### Step 2 — Open the Execution Role
Go to **Configuration → Permissions** and click the role name to open it in IAM.

Observe:
```json
"Resource": [
  "arn:aws:s3:::*",
  "arn:aws:s3:::*/*"
]
```
This grants access to **every S3 bucket** in the account.

### Step 3 — Confirm via IAM Policy Simulator

**S3 Test:**
1. Go to **IAM → Policy Simulator**
2. Select Identity Type: **Roles** → `serverlessrepo-OWASP-DVSA-SendReceipt...`
3. Service: **Amazon S3** | Actions: `GetObject`, `PutObject`
4. Simulation Resource: `arn:aws:s3:::random-bucket/test.txt`
5. Click **Run Simulation** → Result: **Allowed**

**DynamoDB Test:**
1. Service: **Amazon DynamoDB** | Actions: `Scan`, `GetItem`, `PutItem`
2. Simulation Resource: `arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/random-table`
3. Click **Run Simulation** → Result: **Allowed**

Both confirmations show the function can access resources it should never touch.

## Evidence
IAM Policy Simulator returns **Allowed** for arbitrary S3 buckets and DynamoDB tables outside the function's scope.

## Fix Summary
Replace wildcard resources with exact ARNs:

**S3 Policy:**
```json
"Resource": [
  "arn:aws:s3:::dvsa-receipts-bucket-<ACCOUNT_ID>-us-east-1",
  "arn:aws:s3:::dvsa-receipts-bucket-<ACCOUNT_ID>-us-east-1/*"
]
```

**DynamoDB Policy:**
```json
"Resource": [
  "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/DVSA-ORDERS-DB"
]
```

**SES — replace AmazonSESFullAccess:**
```json
"Action": ["ses:SendEmail"],
"Resource": ["arn:aws:ses:us-east-1:<ACCOUNT_ID>:identity/*"]
```

See [`/Codefix/Lesson07-Over-Privileged-Function/`](../../Codefix/Lesson07-Over-Privileged-Function/) for the full IAM policy files.

## Verification After Fix
Policy Simulator returns **Denied** for `random-bucket` and `random-table`, while the function's designated resources continue to work normally.

## Lessons Learned
In serverless systems, the **IAM role is the real security boundary** — not the network perimeter. Over-privileged roles dramatically increase the **blast radius** of any compromise. Always apply **Least Privilege**, **Resource-Level Restrictions**, and **Minimal Actions** to every Lambda execution role.
