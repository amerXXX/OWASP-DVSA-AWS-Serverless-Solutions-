// ============================================================
// LESSON 10 FIX: Unhandled Exceptions — Defensive Error Handling
// File: order-manager.js  (DVSA-ORDER-MANAGER Lambda)
// ============================================================

exports.handler = async (event, context, callback) => {

  // ============================================================
  // OUTER try/catch — catches any unexpected error anywhere in the handler.
  // The client always receives a clean, generic message.
  // Detailed errors go only to CloudWatch logs.
  // ============================================================
  try {

    // 1. Validate the event object itself
    if (!event || typeof event !== "object") {
      return callback(null, resp(400, { status: "err", msg: "invalid request" }));
    }

    // 2. Validate the request body
    if (!event.body || typeof event.body !== "string") {
      return callback(null, resp(400, { status: "err", msg: "missing request body" }));
    }

    // 3. Validate headers exist
    if (!event.headers || typeof event.headers !== "object") {
      return callback(null, resp(400, { status: "err", msg: "missing headers" }));
    }

    // 4. Parse body safely
    let req;
    try {
      req = JSON.parse(event.body);
    } catch (e) {
      console.log("Body parse failed:", e);
      return callback(null, resp(400, { status: "err", msg: "invalid request body" }));
    }

    // 5. Validate Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return callback(null, resp(401, { status: "err", msg: "missing or invalid token" }));
    }

    // 6. Validate JWT structure (must be 3 dot-separated parts)
    const tokenString = authHeader.replace("Bearer ", "").trim();
    const parts = tokenString.split(".");
    if (parts.length !== 3) {
      return callback(null, resp(401, { status: "err", msg: "invalid token format" }));
    }

    // 7. Validate action field
    const allowedActions = [
      "new", "update", "cancel", "get", "orders", "account", "profile",
      "shipping", "billing", "complete", "inbox", "message", "delete",
      "upload", "feedback", "admin-orders"
    ];
    if (!req.action || !allowedActions.includes(req.action)) {
      return callback(null, resp(400, { status: "err", msg: "invalid request action" }));
    }

    // ... rest of handler logic (JWT verification, DynamoDB calls, etc.) ...

  } catch (err) {
    // Catch-all: log full details internally, return safe generic message externally
    console.error("Unhandled error:", err);
    return callback(null, resp(500, { status: "err", msg: "Internal error" }));
  }
};

// Helper to build a consistent response shape
function resp(statusCode, body) {
  return {
    statusCode,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
}

// ============================================================
// BEFORE (vulnerable — no validation, no try/catch):
// ============================================================
/*
  exports.handler = (event, context, callback) => {
    var req = serialize.unserialize(event.body);         // crashes if body is null
    var headers = serialize.unserialize(event.headers);  // crashes if headers malformed
    var auth_header = headers.Authorization || headers.authorization;
    var token_sections = auth_header.split('.');         // crashes if auth_header is undefined
    var auth_data = jose.util.base64url.decode(token_sections[1]); // crashes if < 3 parts
    var token = JSON.parse(auth_data);
    var user = token.username;
    // No try/catch anywhere — any of the above = HTTP 500 + stack trace in CloudWatch
  }
*/
