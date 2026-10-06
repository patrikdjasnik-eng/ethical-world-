from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server import test_runner


class TestRunnerTests(unittest.TestCase):
  def test_failure_is_logged_in_utf8_even_with_ascii_console(self):
    def fail():
      raise RuntimeError("diagnostická chyba žluťoučký")
    suite = unittest.TestSuite([unittest.FunctionTestCase(fail)])
    console_bytes = io.BytesIO()
    console = io.TextIOWrapper(console_bytes, encoding="ascii")
    try:
      with tempfile.TemporaryDirectory() as temporary:
        logfile = Path(temporary) / "diagnostics" / "tests.log"
        with patch.object(unittest.defaultTestLoader, "discover", return_value=suite), patch.object(test_runner.sys, "stdout", console):
          exit_code = test_runner.run_tests(logfile)
        self.assertEqual(exit_code, 1)
        text = logfile.read_text(encoding="utf-8")
        self.assertIn("Traceback", text)
        self.assertIn("diagnostická chyba žluťoučký", text)
        self.assertIn("FAILED (errors=1)", text)
        self.assertIn(b"FAILED", console_bytes.getvalue())
    finally:
      console.close()

  def test_success_returns_zero_and_records_summary(self):
    suite = unittest.TestSuite([unittest.FunctionTestCase(lambda: None)])
    with tempfile.TemporaryDirectory() as temporary:
      logfile = Path(temporary) / "tests.log"
      with patch.object(unittest.defaultTestLoader, "discover", return_value=suite), patch.object(test_runner.sys, "stdout", io.StringIO()):
        self.assertEqual(test_runner.run_tests(logfile), 0)
      self.assertIn("OK", logfile.read_text(encoding="utf-8"))


if __name__ == "__main__":
  unittest.main()
