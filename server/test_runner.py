from __future__ import annotations

import platform
import sqlite3
import sys
import unittest
from pathlib import Path
from typing import TextIO


class TestOutput:
  def __init__(self, console: TextIO, logfile: TextIO):
    self.console = console
    self.logfile = logfile

  def write(self, value: str) -> int:
    self.logfile.write(value)
    self.logfile.flush()
    try:
      self.console.write(value)
      self.console.flush()
    except UnicodeEncodeError:
      encoding = self.console.encoding or "ascii"
      self.console.write(value.encode(encoding, errors="backslashreplace").decode(encoding))
      self.console.flush()
    return len(value)

  def flush(self) -> None:
    self.logfile.flush()
    self.console.flush()


def run_tests(log_path: Path | None = None) -> int:
  project_root = Path(__file__).resolve().parent.parent
  target = log_path if log_path is not None else project_root / "out" / "diagnostics" / "backend-tests.log"
  target.parent.mkdir(parents=True, exist_ok=True)
  with target.open("w", encoding="utf-8") as logfile:
    output = TestOutput(sys.stdout, logfile)
    output.write(f"Python: {sys.version}\nPlatform: {platform.platform()}\nSQLite: {sqlite3.sqlite_version}\n\n")
    suite = unittest.defaultTestLoader.discover(str(project_root / "server" / "tests"))
    result = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
    output.write(f"\nFull backend test log: {target}\n")
  return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
  raise SystemExit(run_tests())
