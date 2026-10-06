from __future__ import annotations

import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
import unittest
from types import SimpleNamespace

from server.desktop_entry import watch_parent_pipe


class ParentPipeTests(unittest.TestCase):
  def test_closed_parent_pipe_requests_server_shutdown(self):
    server = SimpleNamespace(should_exit=False)
    watch_parent_pipe(io.BytesIO(b""), server)
    self.assertTrue(server.should_exit)

  def test_parent_stream_failure_also_requests_shutdown(self):
    class BrokenStream:
      def read(self, size):
        raise OSError("closed")
    server = SimpleNamespace(should_exit=False)
    with self.assertRaises(OSError):
      watch_parent_pipe(BrokenStream(), server)
    self.assertTrue(server.should_exit)


class DesktopEntryIntegrationTests(unittest.TestCase):
  def test_live_server_exits_when_its_parent_pipe_closes(self):
    root = Path(__file__).resolve().parents[2]
    with socket.socket() as listener:
      listener.bind(("127.0.0.1", 0))
      port = listener.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="ethical-parent-pipe-") as temporary:
      environment = {**os.environ, "ETHICAL_WORLD_PORT": str(port), "ETHICAL_WORLD_DATA_DIR": temporary, "ETHICAL_WORLD_PARENT_PIPE": "1", "ETHICAL_WORLD_RUNTIME_TOKEN": "parent-pipe-fixture", "ETHICAL_WORLD_ADMIN_EMAIL": "", "ETHICAL_WORLD_ADMIN_PASSWORD": ""}
      process = subprocess.Popen([sys.executable, "-m", "server.desktop_entry"], cwd=root, env=environment, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
      try:
        client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        deadline = time.monotonic() + 15
        ready = False
        while time.monotonic() < deadline:
          if process.poll() is not None:
            self.fail("Desktop backend exited before health became ready.")
          try:
            with client.open(f"http://127.0.0.1:{port}/health", timeout=0.5) as response:
              ready = json.load(response)["status"] == "ok"
              if ready:
                break
          except (urllib.error.URLError, TimeoutError):
            time.sleep(0.1)
        self.assertTrue(ready, "Desktop backend did not become healthy.")
        process.stdin.close()
        self.assertEqual(process.wait(timeout=8), 0)
      finally:
        if process.poll() is None:
          process.terminate()
          process.wait(timeout=8)
        if process.stdin and not process.stdin.closed:
          process.stdin.close()
