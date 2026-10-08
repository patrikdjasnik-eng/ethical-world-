from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
import threading
import time
from datetime import UTC, datetime
from email.message import EmailMessage
from starlette.concurrency import run_in_threadpool
from .auth_store import _connect

logger = logging.getLogger(__name__)
delivery_lock = threading.Lock()


def smtp_config() -> dict | None:
  username = os.getenv("ETHICAL_WORLD_SMTP_USER", "").strip()
  password = os.getenv("ETHICAL_WORLD_SMTP_PASSWORD", "")
  if not username or not password:
    return None
  port = int(os.getenv("ETHICAL_WORLD_SMTP_PORT", "465"))
  if not 1 <= port <= 65535:
    raise ValueError("Invalid SMTP port")
  return {
    "host": os.getenv("ETHICAL_WORLD_SMTP_HOST", "smtp.gmail.com").strip(),
    "port": port,
    "username": username,
    "password": password,
  }


def claim_mail() -> dict | None:
  now = time.time()
  with _connect() as connection:
    connection.execute("BEGIN IMMEDIATE")
    row = connection.execute(
      """SELECT m.*, u.email, u.display_name, u.created_at FROM registration_mail m
      JOIN users u ON u.id = m.user_id WHERE m.sent_at IS NULL AND m.next_attempt <= ?
      AND m.lease_until <= ? ORDER BY u.created_at LIMIT 1""", (now, now),
    ).fetchone()
    if row is None:
      return None
    connection.execute("UPDATE registration_mail SET lease_until = ?, attempts = attempts + 1 WHERE user_id = ?", (now + 120, row["user_id"]))
    return dict(row)


def send_mail(config: dict, event: dict) -> None:
  message = EmailMessage()
  message["Subject"] = "Ethical World — nová registrace"
  message["From"] = config["username"]
  message["To"] = event["recipient"]
  message["Message-ID"] = "<registration-" + event["user_id"] + "@ethical-world.local>"
  message.set_content(
    "V Ethical World vznikl nový účet.\n\n"
    + "Jméno: " + event["display_name"] + "\n"
    + "E-mail: " + event["email"] + "\n"
    + "Registrace (UTC): " + event["created_at"] + "\n"
    + "ID účtu: " + event["user_id"] + "\n\n"
    + "Upozornění z lokálního registračního backendu Ethical World.\n"
  )
  context = ssl.create_default_context()
  if config["port"] == 465:
    client = smtplib.SMTP_SSL(config["host"], config["port"], timeout=10, context=context)
  else:
    client = smtplib.SMTP(config["host"], config["port"], timeout=10)
  with client:
    if config["port"] != 465:
      client.ehlo()
      client.starttls(context=context)
      client.ehlo()
    client.login(config["username"], config["password"])
    refused = client.send_message(message)
    if refused:
      raise smtplib.SMTPException("Recipient refused")


def deliver_pending_mail() -> None:
  # The SQLite lease also prevents simultaneous workers in separate processes.
  if not delivery_lock.acquire(blocking=False):
    return
  try:
    config = smtp_config()
    if config is None:
      return
    for _ in range(10):
      event = claim_mail()
      if event is None:
        break
      try:
        send_mail(config, event)
      except Exception as error:
        error_type = type(error).__name__
        delay = min(3600, 30 * 2 ** min(event["attempts"], 7))
        with _connect() as connection:
          connection.execute("UPDATE registration_mail SET lease_until = 0, next_attempt = ?, last_error = ? WHERE user_id = ?", (time.time() + delay, error_type, event["user_id"]))
        logger.warning("Registration notification deferred (%s).", error_type)
      else:
        with _connect() as connection:
          connection.execute("UPDATE registration_mail SET sent_at = ?, lease_until = 0, last_error = NULL WHERE user_id = ?", (datetime.now(UTC).isoformat(), event["user_id"]))
  except Exception as error:
    logger.warning("Registration notification worker unavailable (%s).", type(error).__name__)
  finally:
    delivery_lock.release()


async def mail_worker() -> None:
  while True:
    await run_in_threadpool(deliver_pending_mail)
    await asyncio.sleep(30)
