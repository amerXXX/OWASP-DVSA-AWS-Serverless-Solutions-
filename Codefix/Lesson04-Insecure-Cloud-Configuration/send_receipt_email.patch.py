"""
LESSON 4 FIX: Insecure Cloud Configuration
File: send_receipt_email.py  (triggered by S3 upload events)

Changes:
  1. Strict filename validation with regex allowlist
  2. No more os.system() with unsanitized filenames
"""

import re
import urllib.parse
import boto3
import os

# Strict allowlist: only alphanumeric, hyphens, underscores, dots, and .raw extension
SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9_\-\.]+\.raw$')


def lambda_handler(event, context):
    # 1. Extract the raw filename from the S3 event
    raw_key = event['Records'][0]['s3']['object']['key']

    # 2. URL-decode the filename (S3 events often URL-encode special characters)
    parsed_key = urllib.parse.unquote_plus(raw_key)

    # 3. Extract just the filename portion (ignore the path prefix)
    filename = parsed_key.split('/')[-1]

    # 4. Apply strict allowlist validation BEFORE any processing
    if not SAFE_FILENAME.match(filename):
        print(f"SECURITY ALERT: Malicious filename blocked — {parsed_key}")
        # Stop execution immediately. Do NOT process the file.
        return {
            'statusCode': 400,
            'body': 'Invalid filename format.'
        }

    # 5. If we reach here, the filename is safe to use
    print(f"Filename validated successfully: {filename}")

    # ... rest of the secure email-sending logic goes here ...
    # Example: extract the UUID, look up the order, compose the email
    receipt_uuid = filename.replace('.raw', '')
    print(f"Processing receipt: {receipt_uuid}")

    return {
        'statusCode': 200,
        'body': 'Receipt email sent successfully.'
    }


# ============================================================
# BEFORE (vulnerable):
# ============================================================
# key = event['Records'][0]['s3']['object']['key']
# os.system(key)   <-- COMMAND INJECTION — attacker controls `key`
