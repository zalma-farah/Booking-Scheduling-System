import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import httpx
import pytest


API_URL = os.getenv("LIVE_API_URL", "http://127.0.0.1:5000").rstrip("/")
USER_ONE_TOKEN = os.getenv("LIVE_USER_ONE_TOKEN")
USER_TWO_TOKEN = os.getenv("LIVE_USER_TWO_TOKEN")
TIME_SLOT_ID = os.getenv("LIVE_TIME_SLOT_ID")


@pytest.mark.live
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
        f"{response_two.status_code}."
    )

    # Verify persisted state through each user's own protected history, then
    # clean up only the winning booking created by this test.
    winner = response_one if response_one.status_code == 201 else response_two
    token = USER_ONE_TOKEN if response_one.status_code == 201 else USER_TWO_TOKEN
    winning_id = winner.json()['booking']['id']
    try:
        active = []
        users = []
        for current_token in (USER_ONE_TOKEN, USER_TWO_TOKEN):
            me = httpx.get(f'{API_URL}/api/me', headers={'Authorization': f'Bearer {current_token}'}, timeout=35)
            me.raise_for_status()
            users.append(me.json()['profile']['id'])
            history = httpx.get(f'{API_URL}/api/bookings', headers={'Authorization': f'Bearer {current_token}'}, timeout=35)
            history.raise_for_status()
            active.extend(b for b in history.json()['bookings'] if b['time_slot_id'] == slot_id and b['status'] == 'active')
        assert users[0] != users[1], 'Configure two different test accounts'
        assert len(active) == 1
    finally:
        cleanup = httpx.post(f'{API_URL}/api/bookings/{winning_id}/cancel', headers={'Authorization': f'Bearer {token}'}, timeout=35)
        assert cleanup.status_code == 200, 'Test reservation cleanup failed; inspect the disposable slot'
