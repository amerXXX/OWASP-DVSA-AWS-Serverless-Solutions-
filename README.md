# OWASP DVSA — AWS Serverless Vulnerability Discovery and Remediation

**Course:** ICS-344 Information Security  
**Student:** AMER AZIZ ALMUTAIRI · S202169770  
**Date:** 2026/03/14  
**Target:** DVSA (Damn Vulnerable Serverless Application) on AWS  

A practical experience in discovering, exploiting, documenting, and fixing security weaknesses in a realistic cloud application using DVSA (OWASP Damn Vulnerable Serverless Application) deployed on AWS — including S3, API Gateway, Lambda, DynamoDB, IAM, and Cognito.

---

## Repository Structure

```
├── Lessons/        ← Step-by-step walkthroughs for each vulnerability
│   ├── Lesson01-Event-Injection/
│   ├── Lesson02-Broken-Authentication/
│   ├── Lesson03-Sensitive-Data-Exposure/
│   ├── Lesson04-Insecure-Cloud-Configuration/
│   ├── Lesson05-Broken-Access-Control/
│   ├── Lesson06-Denial-of-Service/
│   ├── Lesson07-Over-Privileged-Function/
│   ├── Lesson08-Logic-Vulnerabilities/
│   ├── Lesson09-Vulnerable-Dependencies/
│   └── Lesson10-Unhandled-Exceptions/
│
└── Codefix/        ← Patched source files and config changes for each lesson
    ├── Lesson01-Event-Injection/
    ├── Lesson02-Broken-Authentication/
    ├── Lesson03-Sensitive-Data-Exposure/
    ├── Lesson04-Insecure-Cloud-Configuration/
    ├── Lesson05-Broken-Access-Control/
    ├── Lesson06-Denial-of-Service/
    ├── Lesson07-Over-Privileged-Function/
    ├── Lesson08-Logic-Vulnerabilities/
    ├── Lesson09-Vulnerable-Dependencies/
    └── Lesson10-Unhandled-Exceptions/
```

---

## Lessons Overview

| # | Vulnerability | Affected Component | Fix Type |
|---|---------------|--------------------|----------|
| 1 | [Event Injection](Lessons/Lesson01-Event-Injection/) | DVSA-ORDER-MANAGER | Remove `node-serialize`; use `JSON.parse()` |
| 2 | [Broken Authentication](Lessons/Lesson02-Broken-Authentication/) | DVSA-ORDER-MANAGER | Verify JWT signature via Cognito JWKS |
| 3 | [Sensitive Data Exposure](Lessons/Lesson03-Sensitive-Data-Exposure/) | DVSA-ADMIN-GET-RECEIPT + IAM | Action allowlist + restrict IAM role |
| 4 | [Insecure Cloud Configuration](Lessons/Lesson04-Insecure-Cloud-Configuration/) | S3 + Lambda | Block Public Access + filename validation |
| 5 | [Broken Access Control](Lessons/Lesson05-Broken-Access-Control/) | DVSA-ORDER-MANAGER | RBAC + order ownership checks |
| 6 | [Denial of Service](Lessons/Lesson06-Denial-of-Service/) | DVSA-ORDER-BILLING | Atomic DynamoDB state lock |
| 7 | [Over-Privileged Function](Lessons/Lesson07-Over-Privileged-Function/) | IAM Role | Restrict to exact resource ARNs |
| 8 | [Logic Vulnerabilities](Lessons/Lesson08-Logic-Vulnerabilities/) | Billing + Update Lambda | DynamoDB ConditionExpression locking |
| 9 | [Vulnerable Dependencies](Lessons/Lesson09-Vulnerable-Dependencies/) | DVSA-ORDER-MANAGER | Remove `node-serialize`; `npm audit` |
| 10 | [Unhandled Exceptions](Lessons/Lesson10-Unhandled-Exceptions/) | DVSA-ORDER-MANAGER | Input validation + centralized try/catch |

---

## Prerequisites

To replicate this project you need:
- An AWS account with the [DVSA CloudFormation stack](https://github.com/OWASP/DVSA) deployed
- AWS CLI configured (`aws configure`)
- `curl`, `python3`, `jq` installed locally
- A secondary AWS account (for Lesson 4 cross-account upload test)
- A [Webhook.site](https://webhook.site) listener URL (for Lessons 3 and 4)

---

## How to Use This Repository

1. **Read the Lesson README** in `Lessons/LessonXX-Name/README.md` to understand the vulnerability, reproduction steps, and evidence.
2. **Apply the fix** from `Codefix/LessonXX-Name/` by deploying the patched file to the corresponding Lambda function in the AWS Console.
3. **Verify** by re-running the attack — the fix should block or reject the malicious request.

> **Note:** All API endpoints, tokens, account IDs, and credentials are redacted or anonymized. Replace placeholders like `<API-ID>`, `<YOUR_TOKEN>`, and `ACCOUNT_ID` with your own values.

---

## Security Notice

This repository was created for **educational purposes** in the context of the ICS-344 Information Security course. All testing was performed against a **deliberately vulnerable application** (OWASP DVSA) in a **personal AWS environment**. No real systems were targeted.
