"""Quick test to verify Modal GPU dispatch from VPS container."""
import os, sys
sys.path.insert(0, "/app")

from compute.app import health_check
result = health_check.remote()
print("RESULT:", result)
print("Token:", bool(os.environ.get("MODAL_API_TOKEN")))
print("App name:", os.environ.get("MODAL_APP_NAME"))