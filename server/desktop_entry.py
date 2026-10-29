from __future__ import annotations

import multiprocessing
import os
import sys
from threading import Thread
from typing import BinaryIO


def watch_parent_pipe(stream: BinaryIO, server) -> None:
  try:
    while stream.read(1):
      pass
  finally:
    server.should_exit = True


def main() -> None:
  import uvicorn
  from server.main import app

  server = uvicorn.Server(uvicorn.Config(
    app,
    host="127.0.0.1",
    port=int(os.getenv("ETHICAL_WORLD_PORT", "8787")),
    log_level="warning",
    timeout_graceful_shutdown=2,
  ))
  if os.getenv("ETHICAL_WORLD_PARENT_PIPE") == "1":
    if sys.stdin is None:
      raise RuntimeError("Desktop backend requires its parent stdin pipe.")
    Thread(target=watch_parent_pipe, args=(sys.stdin.buffer, server), daemon=True).start()
  server.run()


if __name__ == "__main__":
  multiprocessing.freeze_support()
  main()
