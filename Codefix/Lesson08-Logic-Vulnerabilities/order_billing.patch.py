"""
LESSON 8 FIX: Logic Vulnerabilities — Race Condition
File: order_billing.py  (DVSA-ORDER-BILLING Lambda)

Key change: Atomically lock the order BEFORE reading itemList.
This ensures the billing function uses a frozen snapshot of the cart
that cannot be changed concurrently by an update request.
"""

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('DVSA-ORDERS-DB')

ORDER_STATUS_OPEN = 100
ORDER_STATUS_BILLING = 115
ORDER_STATUS_PAID = 120
ORDER_STATUS_FAILED = 110


def lambda_handler(event, context):
    order_id = event.get('order-id')
    user_id = event.get('user')
    key = {"orderId": order_id, "userId": user_id}

    # LESSON 8 FIX:
    # Atomically lock the order before doing any billing work.
    # Only an order in state 100 (open) may enter billing.
    # ReturnValues="ALL_OLD" gives us the pre-lock snapshot so billing
    # uses a stable itemList that cannot be changed mid-flight.
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
            return {"status": "err", "msg": "order is not open for billing"}
        raise

    # Use the OLD snapshot — immune to concurrent cart updates
    old_item = lock_response.get("Attributes", {})
    item_list = old_item.get("itemList", {})

    # Calculate total from the locked snapshot
    total = calculate_total(item_list)

    # Process payment
    payment_result = process_payment(event.get("data"), total)

    if payment_result['status'] == 'ok':
        table.update_item(
            Key=key,
            UpdateExpression="SET orderStatus = :paid, totalAmount = :total, confirmationToken = :token",
            ConditionExpression="orderStatus = :inprogress",
            ExpressionAttributeValues={
                ":paid": ORDER_STATUS_PAID,
                ":inprogress": ORDER_STATUS_BILLING,
                ":total": total,
                ":token": payment_result['token']
            }
        )
        return {"status": "ok", "amount": total, "token": payment_result['token']}
    else:
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


def calculate_total(item_list):
    # Stub — sum item prices from the locked snapshot
    return 0


def process_payment(payment_data, total):
    # Stub — replace with actual payment processor
    return {"status": "ok", "token": "TOKEN", "amount": total}
