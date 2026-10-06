from __future__ import annotations

import multiprocessing
import os

import uvicorn

from server.main import app


if __name__ == "__main__":
    multiprocessing.freeze_support()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.getenv("ETHICAL_WORLD_PORT", "8787")),
        log_level="warning",
    )
