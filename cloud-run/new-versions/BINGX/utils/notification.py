import os
import uuid
import logging
import json
from google.cloud import tasks_v2
from google.protobuf import duration_pb2

logger = logging.getLogger(__name__)


url = os.environ.get("notification_url")

endpoints = {
    "bulk_order": "/trade",
    "cancel_all_orders": "/action?type=emergencyClose",
    "cancel_order": "/action?type=cancelOrder",
    "replace_sl": "/action?type=replaceSl",
    "partial_close": "/action?type=PartialClose",
}

async def send_notification(payload, endpoint):
    try:
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
    except Exception as e:
        logger.error("An error occurred: %s", e, exc_info=True)