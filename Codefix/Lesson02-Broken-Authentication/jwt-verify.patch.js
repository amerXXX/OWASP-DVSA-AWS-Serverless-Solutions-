// ============================================================
// LESSON 2 FIX: Broken Authentication — JWT Signature Verification
// File: order-manager.js  (DVSA-ORDER-MANAGER Lambda)
// ============================================================

const jose = require('node-jose');

// ============================================================
// BEFORE (vulnerable):
// ============================================================
/*
  var auth_header = headers.Authorization || headers.authorization;
  var token_sections = auth_header.split('.');
  var auth_data = jose.util.base64url.decode(token_sections[1]);
  var token = JSON.parse(auth_data);
  var user = token.username;    // <-- trusted WITHOUT signature verification
*/

// ============================================================
// AFTER (secure): fetch Cognito JWKS and verify cryptographically
// ============================================================

var region = process.env.AWS_REGION || 'us-east-1';
var userPoolId = process.env.userpoolid;
var jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;

var auth_header = headers.Authorization || headers.authorization;

if (!auth_header) {
  return callback(null, {
    statusCode: 401,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ status: "err", message: "Missing token" })
  });
}

// Extract just the token string (strip "Bearer ")
var tokenString = auth_header.replace('Bearer ', '').trim();

// Fetch Cognito public keys and verify the signature cryptographically
fetch(jwksUrl)
  .then(res => res.json())
  .then(jwks => jose.JWK.asKeyStore(jwks))
  .then(keystore => jose.JWS.createVerify(keystore).verify(tokenString))
  .then(verified => {
    // Only after successful signature verification do we trust the claims
    var token = JSON.parse(verified.payload.toString());
    var user = token.username;
    var isAdmin = false;

    // >>> PASTE THE REST OF YOUR EXISTING TRY/CATCH LOGIC HERE <<<
    // (Starting from: var params = { UserPoolId: process.env.userpoolid ... })

  })
  .catch(err => {
    // Forged or tampered tokens will fail here
    console.error("JWT Verification Failed:", err.message);
    return callback(null, {
      statusCode: 401,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "err", message: "invalid token" })
    });
  });
