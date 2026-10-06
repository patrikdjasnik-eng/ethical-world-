from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from server import auth_store


class DatabaseConnectionTests(unittest.TestCase):
  def setUp(self):
    self.data = tempfile.TemporaryDirectory(prefix="ethical-db-test-")
    self.env = patch.dict(os.environ, {"ETHICAL_WORLD_DATA_DIR": self.data.name})
    self.env.start()
    self.connection = None

  def tearDown(self):
    if self.connection is not None:
      self.connection.close()
    self.env.stop()
    self.data.cleanup()

  def test_success_commits_and_closes_without_garbage_collection(self):
    with auth_store._connect() as connection:
      self.connection = connection
      connection.execute("CREATE TABLE probe (value TEXT)")
      connection.execute("INSERT INTO probe VALUES ('saved')")
    with self.assertRaises(sqlite3.ProgrammingError):
      self.connection.execute("SELECT 1")
    with auth_store._connect() as connection:
      self.assertEqual(connection.execute("SELECT value FROM probe").fetchone()[0], "saved")

  def test_error_rolls_back_and_closes_without_garbage_collection(self):
    with auth_store._connect() as connection:
      connection.execute("CREATE TABLE probe (value TEXT)")
    with self.assertRaisesRegex(RuntimeError, "intentional"):
      with auth_store._connect() as connection:
        self.connection = connection
        connection.execute("INSERT INTO probe VALUES ('not saved')")
        raise RuntimeError("intentional")
    with self.assertRaises(sqlite3.ProgrammingError):
      self.connection.execute("SELECT 1")
    with auth_store._connect() as connection:
      self.assertEqual(connection.execute("SELECT COUNT(*) FROM probe").fetchone()[0], 0)

  def test_configuration_failure_still_closes_connection(self):
    class BrokenConnection:
      row_factory = None
      closed = False
      def execute(self, query):
        raise sqlite3.OperationalError("PRAGMA failed")
      def close(self):
        self.closed = True
    connection = BrokenConnection()
    with patch.object(auth_store.sqlite3, "connect", return_value=connection):
      with self.assertRaises(sqlite3.OperationalError):
        with auth_store._connect():
          self.fail("Failed configuration must not enter the context.")
    self.assertTrue(connection.closed)


if __name__ == "__main__":
  unittest.main()
