import os
import uuid
import json
from google.cloud import tasks_v2
from google.protobuf import duration_pb2

url = os.environ.get("notification_url")

endpoints = {
    "bulk_order": "/trade",
    "bulk_tp": "/action?type=bulkTp",
    "cancel_all_orders": "/action?type=emergencyClose",
    "cancel_order": "/action?type=cancelOrder",
    "replace_sl": "/action?type=replaceSl",
    "partial_close": "/action?type=PartialClose",
}

async def send_notification(payload, endpoint):
    client = tasks_v2.CloudTasksAsyncClient()

    parent = client.queue_path("copile", "asia-southeast1", "notification-queue")

    # Create a Cloud Task object with the task payload and target URL
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": url + endpoints[endpoint],
            "oidc_token": tasks_v2.OidcToken(
                service_account_email="tasks-service-account@copile.iam.gserviceaccount.com"
            ),
            "body": json.dumps(payload).encode(),
            "headers": {
                "Content-type": "application/json"
            }
        }
    }

    task_name = str(uuid.uuid4())
    task["name"] = client.task_path("copile", "asia-southeast1", 'notification-queue', task_name)

    duration = duration_pb2.Duration()
    duration.FromSeconds(900)
    task["dispatch_deadline"] = duration

    # Create the Cloud Task request with the parent queue, task and schedule time
    await client.create_task(request={"parent": parent, "task": task})
    return

async def notification_bulk_order(trader_id, trade_id, trade_info, take_profits, stop_losses):
    notification = {
        "data": {
            "order": trade_info,
            "take_profits": take_profits,
            "stop_losses": stop_losses
        },
        "trade_id": trade_id,
        "user_id": trader_id
    }
    await send_notification(notification, "bulk_order")

async def notification_bulk_tp(trader_id, trade_id, take_profits):
    notification = {
        "data": {
            "take_profits": take_profits
        },
        "trade_id": trade_id,
        "user_id": trader_id
    }

    await send_notification(notification, "bulk_tp")

async def notification_cancel_all_orders(trader_id, trade_id):
    notification = {
        "trade_id": trade_id,
        "user_id": trader_id,
    }

    await send_notification(notification, "cancel_all_orders")

async def notification_cancel_order(trader_id, trade_id, document_id):
    notification = {
        "data": {
            "document_id": document_id
        },
        "trade_id": trade_id,
        "user_id": trader_id
    }

    await send_notification(notification, "cancel_order")

async def notification_partial_close(trader_id, trade_id, percentage):
    notification = {
        "data": {
            "value": percentage
        },
        "trade_id": trade_id,
        "user_id": trader_id
    }

    await send_notification(notification, "partial_close")

async def notification_replace_sl(trader_id, trade_id, sl_id, sl_value, sl_percentage):
    notification = {
        "data": {
            "document_id": sl_id,
            "sl_value": sl_value,
            "sl_percentage": sl_percentage
        },
        "trade_id": trade_id,
        "user_id": trader_id
    }

    await send_notification(notification, "replace_sl")