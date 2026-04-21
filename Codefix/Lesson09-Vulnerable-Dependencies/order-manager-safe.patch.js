// ============================================================
// LESSON 9 FIX: Vulnerable Dependencies
// File: order-manager.js  (DVSA-ORDER-MANAGER Lambda)
// ============================================================

// REMOVED: const serialize = require('node-serialize');
// REASON: node-serialize@0.0.4 has a Critical RCE vulnerability
//         via IIFE payloads — no patch is available for this package.
//         Advisory: https://nodesecurity.io/advisories/311

// KEPT (safe for JWT key verification):
const jose = require('node-jose');

// ADDED (AWS SDK for Lambda and Cognito):
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");

exports.handler = (event, context, callback) => {

  // BEFORE (vulnerable — RCE via user input):
  // var req = serialize.unserialize(event.body);
  // var headers = serialize.unserialize(event.headers);

  // AFTER (safe — treat input as data, never as code):
  if (!event.body || typeof event.body !== "string") {
    return callback(null, {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Missing request body" })
    });
  }

  let req;
  try {
    req = JSON.parse(event.body);
  } catch (e) {
    return callback(null, {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Invalid JSON" })
    });
  }

  // Access headers directly — no deserialization
  const headers = event.headers;

  // Strict action allowlist
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

  // ... rest of handler logic ...
};

// ============================================================
// HOW TO SCAN FOR VULNERABILITIES:
// ============================================================
// npm audit                    — scan current dependencies
// npm audit fix                — auto-fix where possible
// npm audit --audit-level=high — fail CI on high/critical only
