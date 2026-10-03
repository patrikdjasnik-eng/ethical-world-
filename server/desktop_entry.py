from __future__ import annotations

import multiprocessing

import uvicorn


if __name__ == "__main__":
    multiprocessing.freeze_support()
    uvicorn.run(
        "server.main:app",
        host="127.0.0.1",
        port=8787,
        log_level="warning",
    )
