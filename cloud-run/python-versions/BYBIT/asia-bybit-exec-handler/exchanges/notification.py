import os
import uuid
from google.cloud import tasks_v2
from google.protobuf import duration_pb2, timestamp_pb2
import json

url = os.environ.get("notification_url")

async def send_notification(payload, endpoint):
    client = tasks_v2.CloudTasksAsyncClient()

    parent = client.queue_path("copile", "asia-southeast1", "notification-queue")

    # Create a Cloud Task object with the task payload and target URL
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": url + endpoint,
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
    response = await client.create_task(request={"parent": parent, "task": task})
    print("Created task {}".format(response.name))
    return
