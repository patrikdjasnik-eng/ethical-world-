from __future__ import annotations

import atexit
import asyncio
import hashlib
import hmac
import os
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, patch

os.environ["ETHICAL_WORLD_RUNTIME_TOKEN"] = "test-capability-not-a-real-secret-0123456789"
_initial_data = tempfile.TemporaryDirectory(prefix="ethical-import-test-")
atexit.register(_initial_data.cleanup)
os.environ["ETHICAL_WORLD_DATA_DIR"] = _initial_data.name

import httpx
from fastapi.testclient import TestClient
from server import auth_store, main, notion_connector, providers, runtime_security


class SecurityTests(unittest.TestCase):
  def setUp(self):
    self.data = tempfile.TemporaryDirectory(prefix="ethical-test-")
    self.env = patch.dict(os.environ, {"ETHICAL_WORLD_DATA_DIR": self.data.name})
    self.env.start()
    auth_store.init_auth_store()
    runtime_security.bootstrap_claimed = False
    self.client = TestClient(main.app)
    self.capability = {"X-Ethical-Capability": runtime_security.runtime_token}

  def tearDown(self):
    self.client.close()
    self.env.stop()
    self.data.cleanup()

  def test_capability_and_owner_bootstrap_are_required_and_single_use(self):
    self.assertEqual(self.client.post("/api/auth/bootstrap-owner").status_code, 401)
    first = self.client.post("/api/auth/bootstrap-owner", headers=self.capability)
    self.assertEqual(first.status_code, 200)
    self.assertEqual(self.client.post("/api/auth/bootstrap-owner", headers=self.capability).status_code, 409)

  def test_fake_client_cannot_use_chat_or_provider_proxy(self):
    payload = {"provider": "ollama", "model": "demo", "baseUrl": "http://localhost:11434", "messages": [{"role": "user", "content": "demo"}]}
    with patch.object(main, "chat_ollama", AsyncMock(return_value="demo")) as model:
      self.assertEqual(self.client.post("/api/chat", json=payload).status_code, 401)
      self.assertEqual(self.client.post("/api/chat", json=payload, headers=self.capability).status_code, 200)
      self.assertEqual(model.await_count, 1)

  def test_agent_mode_receives_tools_and_complete_context_metadata(self):
    payload = {"provider": "ollama", "model": "demo", "baseUrl": "http://localhost:11434", "permissionMode": "agent", "messages": [{"role": "user", "content": "vytvor poznamku"}], "vaultContext": [{"id": "full", "title": "Full", "content": "complete"}, {"id": "partial", "title": "Partial", "content": "excerpt", "complete": False}]}
    with patch.object(main, "chat_ollama", AsyncMock(return_value="demo")) as model:
      response = self.client.post("/api/chat", json=payload, headers=self.capability)
      self.assertEqual(response.status_code, 200)
      self.assertEqual(response.json()["completeNoteIds"], ["full"])
      prompt = model.call_args.args[2][0]["content"]
      self.assertIn("KNOWLEDGE NOTE MODE", prompt)
      self.assertIn("ČÁSTEČNÝ OBSAH", prompt)

    payload["messages"] = [{"role": "user", "content": "presun"}]
    with patch.object(main, "chat_ollama", AsyncMock(return_value="demo")) as model:
      self.client.post("/api/chat", json=payload, headers=self.capability)
      self.assertIn("move_note", model.call_args.args[2][0]["content"])

  def test_health_uses_challenge_proof_without_exposing_capability(self):
    response = self.client.get("/health?challenge=unique").json()
    expected = hmac.new(runtime_security.runtime_token.encode(), b"unique", hashlib.sha256).hexdigest()
    self.assertEqual(response["proof"], expected)
    self.assertNotIn(runtime_security.runtime_token, str(response))

  def test_password_change_and_logout_revoke_other_sessions(self):
    owner = self.client.post("/api/auth/bootstrap-owner", headers=self.capability).json()
    with auth_store._connect() as connection:
      other_token, _ = auth_store._create_session(connection, owner["user"]["id"])
    headers = {**self.capability, "Authorization": "Bearer " + owner["sessionToken"]}
    self.assertEqual(self.client.post("/api/auth/change-password", headers=headers, json={"newPassword": "demo-password-12345"}).status_code, 200)
    self.assertIsNone(auth_store.user_from_session(other_token))
    self.assertEqual(self.client.post("/api/auth/logout", headers=headers).status_code, 200)
    self.assertIsNone(auth_store.user_from_session(owner["sessionToken"]))

  def test_cors_does_not_allow_null_origin(self):
    response = self.client.options("/api/chat", headers={"Origin": "null", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    self.assertEqual(response.status_code, 400)
    self.assertNotIn("access-control-allow-origin", response.headers)

  def test_request_size_limit(self):
    response = self.client.post("/api/chat", headers={**self.capability, "Content-Type": "application/json"}, content=b"x" * (2 * 1024 * 1024 + 1))
    self.assertEqual(response.status_code, 413)


class ProviderTests(unittest.IsolatedAsyncioTestCase):
  async def test_rejects_metadata_credentials_http_remote_and_dns_rebinding(self):
    for url in ["http://169.254.169.254", "file:///tmp", "https://user:pass@api.openai.com", "http://api.openai.com"]:
      with self.assertRaises(providers.ProviderError):
        await providers.provider_endpoint(url, "/models")
    loop = asyncio.get_running_loop()
    with patch.object(loop, "getaddrinfo", AsyncMock(return_value=[(2, 1, 6, "", ("127.0.0.1", 443))])):
      with self.assertRaises(providers.ProviderError):
        await providers.provider_endpoint("https://api.openai.com", "/models")

  async def test_pins_validated_ip_and_preserves_host_and_tls_identity(self):
    loop = asyncio.get_running_loop()
    with patch.object(loop, "getaddrinfo", AsyncMock(return_value=[(2, 1, 6, "", ("8.8.8.8", 443))])):
      endpoint, headers, extensions = await providers.provider_endpoint("https://api.openai.com/v1", "/models")
    self.assertEqual(endpoint, "https://8.8.8.8:443/v1/models")
    self.assertEqual(headers["Host"], "api.openai.com")
    self.assertEqual(extensions["sni_hostname"], b"api.openai.com")

  async def test_invalid_json_is_controlled_provider_error(self):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=b"not json"))
    with patch.object(providers.httpx, "AsyncClient", side_effect=lambda **kwargs: original(**kwargs, transport=transport)):
      with self.assertRaises(providers.ProviderError):
        await providers.request_json("http://127.0.0.1:11434", "/api/tags")


class NotionTests(unittest.IsolatedAsyncioTestCase):
  async def test_expired_state_is_rejected_before_network(self):
    notion_connector._oauth_states["old"] = ("user", time.monotonic() - 601)
    with self.assertRaises(notion_connector.NotionConnectorError):
      await notion_connector.finish_oauth("code", "old")
    self.assertNotIn("old", notion_connector._oauth_states)

  async def test_changed_remote_page_is_never_overwritten(self):
    notion_connector._notion_baselines[("user", "page")] = "baseline"
    with patch.object(notion_connector, "_request", AsyncMock(return_value={"markdown": "remote edit"})) as request:
      with self.assertRaises(notion_connector.NotionConnectorError):
        await notion_connector.write_markdown("user", "page", "local edit")
      self.assertEqual(request.await_count, 1)
      self.assertEqual(request.await_args.args[1], "GET")


if __name__ == "__main__":
  unittest.main()
