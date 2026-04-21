"""
LESSON 6 FIX: Denial of Service — Atomic Billing Lock
File: order_billing.py  (DVSA-ORDER-BILLING Lambda)

Key change: Atomically claim the order for billing using DynamoDB
ConditionExpression BEFORE contacting the payment processor.
Only ONE concurrent request can succeed — all others are rejected immediately.
"""

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('DVSA-ORDERS-DB')

ORDER_STATUS_OPEN = 100           # Order is open and eligible for billing
ORDER_STATUS_BILLING = 115        # Billing in progress (lock state)
ORDER_STATUS_PAID = 120           # Successfully paid
ORDER_STATUS_FAILED = 110         # Payment failed


def lambda_handler(event, context):
    order_id = event.get('order-id')
    user_id = event.get('user')

    key = {
        "orderId": order_id,
        "userId": user_id
    }

    # ============================================================
    # LESSON 6 FIX: Atomically lock the order before billing work.
    # Only an order in state 100 (open) may enter billing.
    # ReturnValues="ALL_OLD" gives us the pre-lock snapshot so billing
    # uses a stable itemList that cannot be changed mid-flight.
    # ============================================================
    try:
        lock_response = table.update_item(
            Key=key,
            UpdateExpression="SET orderStatus = :billing",
            ConditionExpression="attribute_exists(orderId) AND orderStatus = :open",
            ExpressionAttributeValues={
                ":open": ORDER_STATUS_OPEN,
                ":billing": ORDER_STATUS_BILLING
            },
            ReturnValues="ALL_OLD"
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {"status": "err", "msg": "billing already in progress or order not eligible"}
        raise

    # Use the snapshot captured at lock time — not a fresh read
    old_item = lock_response.get("Attributes")
    item_list = old_item.get("itemList", {})

    # ... call payment processor with item_list ...
    payment_result = call_payment_processor(event.get("data"), item_list)

    if payment_result['status'] == 'ok':
        # Move billing-in-progress → paid
        table.update_item(
            Key=key,
            UpdateExpression="SET orderStatus = :paid, confirmationToken = :token",
            ConditionExpression="orderStatus = :inprogress",
            ExpressionAttributeValues={
                ":paid": ORDER_STATUS_PAID,
                ":inprogress": ORDER_STATUS_BILLING,
                ":token": payment_result['token']
            }
        )
        return {"status": "ok", "amount": payment_result['amount'], "token": payment_result['token']}

    else:
        # Move billing-in-progress → failed
        table.update_item(
            Key=key,
            UpdateExpression="SET orderStatus = :failed",
            ConditionExpression="orderStatus = :inprogress",
            ExpressionAttributeValues={
                ":failed": ORDER_STATUS_FAILED,
                ":inprogress": ORDER_STATUS_BILLING
            }
        )
        return {"status": "err", "msg": "invalid payment details"}


def call_payment_processor(payment_data, item_list):
    # Stub — replace with actual payment processor call
    pass
