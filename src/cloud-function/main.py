import functions_framework

from flask import jsonify
from google.cloud import pubsub_v1

import os
import json
from typing import Callable
from concurrent import futures

project_id = os.environ.get("PROJECT_ID", "next-data-hive-2023")


def send_message(topic_id, payload):
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, topic_id)
    publish_futures = []

    def get_callback(
        publish_future: pubsub_v1.publisher.futures.Future, data: str
    ) -> Callable[[pubsub_v1.publisher.futures.Future], None]:
        def callback(publish_future: pubsub_v1.publisher.futures.Future) -> None:
            try:
                # Wait 60 seconds for the publish call to succeed.
                print(publish_future.result(timeout=60))
            except futures.TimeoutError:
                print(f"Publishing {data} timed out.")

        return callback

    data = json.dumps(payload)
    publish_future = publisher.publish(
        topic_path, data.encode("utf-8"), train=payload["train"]
    )
    # Non-blocking. Publish failures are handled in the callback function.
    publish_future.add_done_callback(get_callback(publish_future, data))
    publish_futures.append(publish_future)

    # Wait for all the publish futures to resolve before exiting.
    futures.wait(publish_futures, return_when=futures.ALL_COMPLETED)


@functions_framework.http
def send_command(request):
    try:
        # Empty array to send back
        return_value = []

        # Get values from BigQuery
        request_json = request.get_json()
        calls = request_json["calls"]

        # Take action on each line
        for call in calls:
            train = call[0] if call else None
            state = call[1] if call else None
            value = call[2] if call else None
            print(state, value)

            send_message(
                f"train-actions", {"train": train, "state": state, "value": value}
            )  # train-actions-{train}

            return_value.append(
                f"Call Initiated: Train: {train} State: {state} Value: {value}"
            )

        # Return values
        replies = return_value

        return_json = jsonify({"replies": replies})
        return return_json

    except Exception as e:
        return jsonify({"errorMessage": str(e)}), 400
