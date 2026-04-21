// ============================================================
// LESSON 5 FIX: Broken Access Control — Add RBAC + Ownership Checks
// File: order-manager.js  (DVSA-ORDER-MANAGER Lambda)
// ============================================================
// Insert this block AFTER JWT signature verification (Lesson 2 fix),
// once `verifiedToken` is available.

// Extract identity from the verified JWT
const userIdentity = verifiedToken.username;
const userGroups = verifiedToken['cognito:groups'] || [];

// ============================================================
// ADMIN-ONLY ACTION GUARD
// Reject non-admin users attempting to invoke admin-reserved actions
// ============================================================
if (req.action === 'admin-orders') {
  if (!userGroups.includes('Admins')) {
    return callback(null, {
      statusCode: 403,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Access denied: admin only" })
    });
  }
}

// ============================================================
// OWNERSHIP CHECK FOR USER-SPECIFIC ACTIONS
// Ensure users can only access or modify their own orders
// ============================================================
async function enforceOwnership(orderId, requestingUser, callback) {
  const params = {
    TableName: process.env.orders_table,
    Key: { orderId: { S: orderId }, userId: { S: requestingUser } }
  };

  const result = await dynamodb.getItem(params).promise();

  if (!result.Item || result.Item.userId.S !== requestingUser) {
    return callback(null, {
      statusCode: 403,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Access denied: not your order" })
    });
  }
}

// Apply ownership check for actions that reference a specific order
if (['get', 'complete', 'shipping', 'billing'].includes(req.action)) {
  if (!req['order-id']) {
    return callback(null, {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "Missing order-id" })
    });
  }
  await enforceOwnership(req['order-id'], userIdentity, callback);
}

// ============================================================
// BEFORE (vulnerable):
// ============================================================
/*
  // No authorization check at all — any authenticated user could call any action:
  var user = token.username;
  // Immediately routes to action handler without checking role or ownership
  if (req.action === 'admin-orders') {
    // updates DynamoDB for ANY order with ANY status — no guards
  }
*/
