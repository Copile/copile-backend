from google.cloud import tasks_v2
from google.protobuf import duration_pb2, timestamp_pb2
import datetime
import json
import random
import time
import asyncio
import os

region = os.environ.get('region')
queue = os.environ.get('queue')
short = os.environ.get('short')

# Set the task target Cloud Run service URL
CLOUD_RUN_SERVICE_URL1 = 'https://' + region + '-user-track-handler-' + 'zvakwy7kgq-' + short + '.a.run.app'
CLOUD_RUN_SERVICE_URL2 = 'https://' + region + '-user-exec-handler-' + 'zvakwy7kgq-' + short + '.a.run.app'

# Create a Cloud Tasks client instance
client = tasks_v2.CloudTasksClient()

# Set the task parent queue path
parent = client.queue_path("copile", queue, 'track-queue')


async def create_task(account_id, trade_id, document_id, payload, endpoint, url):
    # Create a Cloud Task payload with the Cloud Run service URL and request body
    payload = {
        "account_id": account_id,
        "trade_id": trade_id,
        "tp_id" if endpoint == "/send_tp" else "sl_id": document_id,
        "payload": payload
    }

    # Create a Cloud Task object with the task payload and target URL
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": CLOUD_RUN_SERVICE_URL1,
            "oidc_token": tasks_v2.OidcToken(
                service_account_email="tasks-service-account@copile.iam.gserviceaccount.com"
            ),
            "body": json.dumps(payload).encode(),
            "headers": {
                "Content-type": "application/json"
            }
        }
    }

    # Convert "seconds from now" into an rfc3339 datetime string.
    d = datetime.datetime.utcnow() + datetime.timedelta(seconds=10)

    # Create Timestamp protobuf.
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(d)

    # Add the timestamp to the tasks.
    task["schedule_time"] = timestamp

    task["name"] = client.task_path("copile", queue, 'track-queue', f"{random.randint(0,1000000)}")

    duration = duration_pb2.Duration()
    duration.FromSeconds(900)
    task["dispatch_deadline"] = duration

    # Create the Cloud Task request with the parent queue, task and schedule time
    response = client.create_task(request={"parent": parent, "task": task})
    print("Created task {}".format(response.name))
