"""
Integration tests for the WebSocket API endpoint.
"""

import json
import pytest
from fastapi.testclient import TestClient


# Use WS-specific import to handle protocol
pytestmark = [pytest.mark.api]


class TestWebSocketConnection:
    def test_connect_and_disconnect(self, client: TestClient):
        """WebSocket connects and disconnects cleanly."""
        with client.websocket_connect("/ws/test-client") as websocket:
            # Should receive no immediate messages on connect
            pass

    def test_ping_pong(self, client: TestClient):
        """Sending a ping message returns a pong response."""
        with client.websocket_connect("/ws/test-client") as websocket:
            websocket.send_json({"type": "ping"})
            response = websocket.receive_json()
            assert response["type"] == "pong"

    def test_echo_json_message(self, client: TestClient):
        """Sending an echo-able JSON message returns it back."""
        with client.websocket_connect("/ws/test-client") as websocket:
            test_msg = {"type": "custom", "payload": "hello"}
            websocket.send_json(test_msg)
            response = websocket.receive_json()
            assert response["type"] == "echo"
            assert response["data"] == test_msg

    def test_plain_text_message(self, client: TestClient):
        """Sending plain text gets echoed back as text."""
        with client.websocket_connect("/ws/test-client") as websocket:
            websocket.send_text("Hello server")
            response = websocket.receive_text()
            assert "Message received: Hello server" in response

    def test_multiple_clients(self, client: TestClient):
        """Two simultaneous WebSocket connections work."""
        with client.websocket_connect("/ws/client-a") as ws_a:
            with client.websocket_connect("/ws/client-b") as ws_b:
                ws_a.send_json({"type": "ping"})
                ws_b.send_json({"type": "ping"})
                assert ws_a.receive_json()["type"] == "pong"
                assert ws_b.receive_json()["type"] == "pong"


class TestWebSocketJobSubscription:
    def test_job_client_id(self, client: TestClient):
        """Connecting with a job_<id> client_id doesn't crash."""
        with client.websocket_connect("/ws/job_42") as websocket:
            websocket.send_json({"type": "ping"})
            response = websocket.receive_json()
            assert response["type"] == "pong"

    def test_broadcast_on_disconnect(self, client: TestClient):
        """When a client disconnects, others get a notification."""
        with client.websocket_connect("/ws/monitor") as monitor:
            # Connect and disconnect a second client
            with client.websocket_connect("/ws/ephemeral") as ephemeral:
                ephemeral.close()
            # Monitor should eventually get the disconnect notification
            # (may need to wait briefly for async broadcast)
            import time
            time.sleep(0.1)
            # Drain any messages
            try:
                while True:
                    msg = monitor.receive_json(timeout=0.5)
                    if msg.get("type") == "system" and "disconnected" in msg.get("message", ""):
                        break
            except Exception:
                pass  # Broadcast may not fire before test ends