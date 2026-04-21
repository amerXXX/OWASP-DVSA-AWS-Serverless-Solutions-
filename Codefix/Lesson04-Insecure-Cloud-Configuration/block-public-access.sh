#!/bin/bash
# LESSON 4 FIX: Block all public access on the DVSA receipts S3 bucket
# Replace ACCOUNT_ID with your actual AWS account ID before running.

ACCOUNT_ID="YOUR_ACCOUNT_ID"
BUCKET_NAME="dvsa-receipts-bucket-${ACCOUNT_ID}-us-east-1"

echo "Blocking public access on bucket: $BUCKET_NAME"

aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "Done. Verifying:"
aws s3api get-public-access-block --bucket "$BUCKET_NAME"
