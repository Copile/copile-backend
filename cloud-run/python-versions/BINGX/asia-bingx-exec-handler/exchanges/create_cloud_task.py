from google.cloud import tasks_v2
from google.protobuf import duration_pb2, timestamp_pb2
import json
import os
import uuid
import datetime

exchange = os.environ.get('exchange')
queue = os.environ.get('queue')
short = os.environ.get('short')

CLOUD_RUN_SERVICE_URL = f'https://asia-{exchange}-track-handler-zvakwy7kgq-{short}.a.run.app'


async def create_task(account_id, trade_id, document_id, payload, endpoint, user_type):
    # Create a Cloud Task payload with the Cloud Run service URL and request body
    
    client = tasks_v2.CloudTasksAsyncClient()

    parent = client.queue_path("copile", queue, "track-queue")
    
    if endpoint == "/send_tp" or endpoint == "/send_sl":
        payload = {
            "account_id": account_id,
            "trade_id": trade_id,
            "tp_id" if endpoint == "/send_tp" else "sl_id": document_id,
            "payload": payload,
            "user_type": user_type
        }
    else:
        payload = {
            "account_id": account_id,
            "trade_id": trade_id,
            "take_profits": payload,
            "user_type": user_type
        }

    # Create a Cloud Task object with the task payload and target URL
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": CLOUD_RUN_SERVICE_URL + endpoint,
            "oidc_token": tasks_v2.OidcToken(
                service_account_email="tasks-service-account@copile.iam.gserviceaccount.com"
            ),
            "body": json.dumps(payload).encode(),
            "headers": {
                "Content-type": "application/json"
            }
        }
    }

    d = datetime.datetime.utcnow() + datetime.timedelta(seconds=6)
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(d)
    task["schedule_time"] = timestamp

    task_name = str(uuid.uuid4())
    task["name"] = client.task_path("copile", queue, 'track-queue', task_name)

    duration = duration_pb2.Duration()
    duration.FromSeconds(900)
    task["dispatch_deadline"] = duration

    # Create the Cloud Task request with the parent queue, task and schedule time
    response = await client.create_task(request={"parent": parent, "task": task})
    print("Created task {}".format(response.name))
    return