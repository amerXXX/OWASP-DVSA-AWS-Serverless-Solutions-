// ============================================================
// LESSON 1 FIX: Event Injection — Unsafe Deserialization
// File: order-manager.js  (DVSA-ORDER-MANAGER Lambda)
// ============================================================

// REMOVE this line entirely:
// const serialize = require('node-serialize');  // DANGEROUS — enables RCE

// Keep these safe imports:
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const jose = require('node-jose');

// ============================================================
// BEFORE (vulnerable):
// ============================================================
/*
  var req = serialize.unserialize(event.body);
  var headers = serialize.unserialize(event.headers);
*/

// ============================================================
// AFTER (secure):
// ============================================================

exports.handler = (event, context, callback) => {

  // 1. Validate that a body exists
  if (!event.body || typeof event.body !== "string") {
    return callback(null, {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Missing request body" })
    });
  }

  // 2. Parse safely with JSON.parse — no code execution possible
  let req;
  try {
    req = JSON.parse(event.body);
  } catch (e) {
    return callback(null, {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Invalid JSON body" })
    });
  }

  // 3. Access headers directly from the Lambda event object — no deserialization
  const headers = event.headers;

  // 4. Allowlist of permitted action values — reject anything unexpected
  const allowedActions = [
    "new", "update", "cancel", "get", "orders", "account", "profile",
    "shipping", "billing", "complete", "inbox", "message", "delete",
    "upload", "feedback", "admin-orders"
  ];

  if (!req.action || !allowedActions.includes(req.action)) {
    return callback(null, {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Invalid request action" })
    });
  }

  // ... rest of your existing handler logic continues here unchanged ...
};
