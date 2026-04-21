"""
LESSON 8 FIX: Logic Vulnerabilities — Prevent Updates During Billing
File: update_order.py  (DVSA-UPDATE-ORDER Lambda)

Key change: Only allow cart updates when orderStatus is exactly 100 (open).
If billing has already started and changed status to 115, this update
will fail atomically in DynamoDB — the race condition is eliminated.
"""

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('DVSA-ORDERS-DB')

ORDER_STATUS_OPEN = 100


def lambda_handler(event, context):
    order_id = event.get('order-id')
    user_id = event.get('user')
    items = event.get('items', {})

    key = {"orderId": order_id, "userId": user_id}

    # LESSON 8 FIX:
    # Remove the vulnerable read-then-write flow.
    # Only allow cart updates while orderStatus is exactly 100 (open).
    # If billing has already started and changed status to 115,
    # this update will fail atomically in DynamoDB.
    try:
        response = table.update_item(
            Key=key,
            UpdateExpression="SET itemList = :itemList",
            ConditionExpression="attribute_exists(orderId) AND orderStatus = :open",
            ExpressionAttributeValues={
                ":itemList": items,
                ":open": ORDER_STATUS_OPEN
            },
            ReturnValues="UPDATED_NEW"
        )

        if response['ResponseMetadata']['HTTPStatusCode'] == 200:
            return {"status": "ok", "msg": "cart updated"}

        return {"status": "err", "msg": "could not update cart"}

    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {"status": "err", "msg": "order can no longer be updated"}
        raise


# ============================================================
# BEFORE (vulnerable):
# ============================================================
# item = table.get_item(Key=key)['Item']   # Read current state
# item['itemList'] = items                 # Modify locally
# table.put_item(Item=item)               # Write back — race window here!
# No condition check — billing and update can run simultaneously
