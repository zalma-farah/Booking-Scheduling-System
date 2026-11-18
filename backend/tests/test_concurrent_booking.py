import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import httpx
import pytest


API_URL = os.getenv("LIVE_API_URL", "http://127.0.0.1:5000").rstrip("/")
USER_ONE_TOKEN = os.getenv("LIVE_USER_ONE_TOKEN")
USER_TWO_TOKEN = os.getenv("LIVE_USER_TWO_TOKEN")
TIME_SLOT_ID = os.getenv("LIVE_TIME_SLOT_ID")


@pytest.mark.skipif(
    not all([USER_ONE_TOKEN, USER_TWO_TOKEN, TIME_SLOT_ID]),
    reason="Live concurrency credentials/slot are not configured.",
)
def test_two_users_cannot_book_same_slot_concurrently():
    """
    Live integration test.

    Two different authenticated users attempt to reserve the exact same
    fresh time slot at nearly the same time.

    Expected:
        one request -> 201
        one request -> 409
    """

    slot_id = int(TIME_SLOT_ID)
    barrier = Barrier(2)

    def make_booking(token):
        barrier.wait()

        return httpx.post(
            f"{API_URL}/api/bookings",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"time_slot_id": slot_id},
            timeout=15.0,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_one = executor.submit(make_booking, USER_ONE_TOKEN)
        future_two = executor.submit(make_booking, USER_TWO_TOKEN)

        response_one = future_one.result()
        response_two = future_two.result()

    statuses = sorted(
        [
            response_one.status_code,
            response_two.status_code,
        ]
    )

    assert statuses == [201, 409], (
        "Expected exactly one successful booking and one conflict, "
        f"but received {response_one.status_code} and "
        f"{response_two.status_code}.\n"
        f"Response 1: {response_one.text}\n"
        f"Response 2: {response_two.text}"
    )