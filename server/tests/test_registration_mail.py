import os
import smtplib
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from server import auth_store, registration_mail, main, runtime_security


class RegistrationMailTests(unittest.TestCase):
  def setUp(self):
    self.data = tempfile.TemporaryDirectory()
    self.env = patch.dict(os.environ, {
      "ETHICAL_WORLD_DATA_DIR": self.data.name,
      "ETHICAL_WORLD_SMTP_USER": "",
      "ETHICAL_WORLD_SMTP_PASSWORD": "",
      "ETHICAL_WORLD_SMTP_PORT": "465",
    })
    self.env.start()
    auth_store.init_auth_store()

  def tearDown(self):
    self.env.stop()
    self.data.cleanup()

  def user(self):
    return auth_store.register_user("new@example.com", "private-test-password", "New User")

  def rows(self):
    with auth_store._connect() as connection:
      return [dict(row) for row in connection.execute("SELECT * FROM registration_mail")]

  def test_registration_and_event_are_atomic_and_duplicate_does_not_enqueue(self):
    self.user()
    with self.assertRaises(auth_store.AuthStoreError):
      self.user()
    self.assertEqual(len(self.rows()), 1)
    self.assertEqual(self.rows()[0]["recipient"], "rabbithollowczech@gmail.com")
    with auth_store._connect() as connection:
      connection.execute("CREATE TRIGGER fail_mail BEFORE INSERT ON registration_mail BEGIN SELECT RAISE(ABORT, 'test'); END")
    with self.assertRaises(auth_store.AuthStoreError):
      auth_store.register_user("other@example.com", "private-test-password", "Other")
    self.assertIsNone(auth_store.user_by_email("other@example.com"))

  def test_unconfigured_mail_remains_pending_and_is_sent_once_after_configuration(self):
    self.user()
    registration_mail.deliver_pending_mail()
    self.assertEqual(self.rows()[0]["attempts"], 0)
    with patch.object(registration_mail, "smtp_config", return_value={"configured": True}), patch.object(registration_mail, "send_mail") as send:
      registration_mail.deliver_pending_mail()
      registration_mail.deliver_pending_mail()
      self.assertEqual(send.call_count, 1)
    self.assertIsNotNone(self.rows()[0]["sent_at"])

  def test_delivery_failure_is_retained_for_retry_without_leaking_secret(self):
    self.user()
    with patch.object(registration_mail, "smtp_config", return_value={}), patch.object(registration_mail, "send_mail", side_effect=smtplib.SMTPException("private smtp credential")):
      registration_mail.deliver_pending_mail()
    row = self.rows()[0]
    self.assertIsNone(row["sent_at"])
    self.assertEqual(row["last_error"], "SMTPException")
    self.assertGreater(row["next_attempt"], 0)
    self.assertEqual(row["lease_until"], 0)
    with auth_store._connect() as connection:
      connection.execute("UPDATE registration_mail SET next_attempt = 0")
    with patch.object(registration_mail, "smtp_config", return_value={}), patch.object(registration_mail, "send_mail") as send:
      registration_mail.deliver_pending_mail()
      self.assertEqual(send.call_count, 1)

  def test_claim_survives_reconnection_and_excludes_another_worker(self):
    self.user()
    first = registration_mail.claim_mail()
    self.assertIsNotNone(first)
    self.assertIsNone(registration_mail.claim_mail())
    with auth_store._connect() as connection:
      connection.execute("UPDATE registration_mail SET lease_until = 0")
    self.assertEqual(registration_mail.claim_mail()["user_id"], first["user_id"])

  def test_tls_message_contains_registration_details_but_no_password(self):
    user = self.user()
    config = {"host": "smtp.gmail.com", "port": 465, "username": "sender@gmail.com", "password": "smtp-app-secret"}
    client = MagicMock()
    client.__enter__.return_value = client
    client.send_message.return_value = {}
    with patch.object(registration_mail.smtplib, "SMTP_SSL", return_value=client) as smtp:
      registration_mail.send_mail(config, registration_mail.claim_mail())
    self.assertEqual(smtp.call_args.kwargs["timeout"], 10)
    client.login.assert_called_once_with("sender@gmail.com", "smtp-app-secret")
    message = client.send_message.call_args.args[0]
    self.assertEqual(message["To"], "rabbithollowczech@gmail.com")
    self.assertIn(user["email"], message.get_content())
    self.assertIn(user["createdAt"], message.get_content())
    self.assertNotIn("private-test-password", message.as_string())
    self.assertNotIn("smtp-app-secret", message.as_string())

  def test_registration_endpoint_succeeds_while_mail_is_unavailable(self):
    with TestClient(main.app) as client, patch.object(registration_mail, "smtp_config", return_value={}), patch.object(registration_mail, "send_mail", side_effect=OSError("offline")):
      response = client.post("/api/auth/register", headers={"X-Ethical-Capability": runtime_security.runtime_token}, json={"email": "new@example.com", "password": "private-test-password", "displayName": "New"})
      self.assertEqual(response.status_code, 200)
      self.assertIsNotNone(auth_store.user_by_email("new@example.com"))
      self.assertIsNone(self.rows()[0]["sent_at"])
