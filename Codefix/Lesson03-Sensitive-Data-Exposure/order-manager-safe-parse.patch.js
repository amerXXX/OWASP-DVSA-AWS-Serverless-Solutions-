// ============================================================
// LESSON 3 FIX: Sensitive Data Exposure
// Code-level fix: prevent injection that enables admin function invocation
// File: order-manager.js  (same fix as Lesson 1 — included here for completeness)
// ============================================================

// REMOVE: const serialize = require('node-serialize');

let req;
try {
  req = JSON.parse(event.body);
} catch (e) {
  return callback(null, {
    statusCode: 400,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ status: "err", message: "Invalid request body" })
  });
}

// Strict action allowlist — prevents any injected function from being routed
const allowedActions = ['get', 'complete', 'create', 'orders', 'shipping',
                        'billing', 'update', 'feedback', 'admin-orders'];

if (!req.action || !allowedActions.includes(req.action)) {
  return callback(null, {
    statusCode: 400,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ status: "err", message: "Invalid action requested" })
  });
}

// With this fix in place, the injection payload:
// {"action":"_$$ND_FUNC$$_function(){...}()","cart-id":""}
// will be rejected at the allowlist check — the admin Lambda is never invoked.
