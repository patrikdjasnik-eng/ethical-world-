from __future__ import annotations

import atexit
import asyncio
import hashlib
import hmac
import json
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
    with patch.object(main, "chat_ollama", AsyncMock(return_value=json.dumps({"notes": [{"operation": "create", "noteId": "", "title": "Test", "folder": "", "content": "# Test"}]}))) as model:
      response = self.client.post("/api/chat", json=payload, headers=self.capability)
      self.assertEqual(response.status_code, 200)
      self.assertEqual(response.json()["completeNoteIds"], ["full"])
      prompt = model.call_args.args[2][0]["content"]
      self.assertIn("JSON schema", prompt)
      data = json.loads(model.call_args.args[2][1]["content"].split("\n", 1)[1])
      self.assertIn("ČÁSTEČNÝ OBSAH", data["notes"][1]["content"])

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

  def test_prompt_budget_limits_old_context_and_keeps_the_latest_request(self):
    latest = {"role": "user", "content": "Vysvětli TLS"}
    request = main.ChatRequest(provider="ollama", model="demo", baseUrl="http://localhost:11434", permissionMode="read", activeNoteId="n0", vaultContext=[{"id": f"n{index}", "title": f"Note {index}", "content": "x" * 10000} for index in range(20)], messages=[{"role": "assistant", "content": "older" * 200} for _ in range(19)] + [latest])
    prepared = main.prepare_chat(request)
    self.assertEqual(prepared.messages[-1], latest)
    self.assertLess(sum(len(item["content"]) for item in prepared.messages), 10000)
    self.assertEqual(prepared.complete_note_ids, [])
    data = json.loads(prepared.messages[1]["content"].split("\n", 1)[1])
    self.assertIn("ČÁSTEČNÝ OBSAH", data["notes"][0]["content"])
    self.assertLessEqual(len(prepared.messages), 9)

  def test_document_budget_keeps_three_complete_notes_and_respects_depth_request(self):
    request = main.ChatRequest(provider="ollama", model="demo", baseUrl="http://localhost:11434", permissionMode="assist", vaultContext=[{"id": f"n{index}", "title": f"Note {index}", "content": "x" * 8000} for index in range(3)], messages=[{"role": "user", "content": "Doplň diagram do všech poznámek"}])
    prepared = main.prepare_chat(request)
    self.assertEqual(prepared.complete_note_ids, ["n0", "n1", "n2"])
    self.assertEqual(prepared.budget.output_tokens, 6144)
    request.messages[0].content = "Vysvětli podrobně TLS"
    self.assertEqual(main.prepare_chat(request).budget.output_tokens, 3072)

  def test_plain_chat_uses_compact_instructions_and_keeps_context_and_permissions(self):
    request = main.ChatRequest(provider="ollama", model="demo", baseUrl="http://localhost:11434", permissionMode="agent", agentScope="Lab", activeNoteId="n1", vaultFolders=["Lab"], vaultIndex=[{"id": "n1", "title": "TLS", "folder": "Lab"}], vaultContext=[{"id": "n1", "title": "TLS", "content": "Exact note body", "folder": "Lab"}], messages=[{"role": "user", "content": "Vysvětli TLS"}])
    prepared = main.prepare_chat(request)
    prompt = prepared.messages[0]["content"]
    self.assertEqual(prepared.workload, "chat")
    self.assertLess(len(prompt), 1900)
    data = json.loads(prepared.messages[1]["content"].split("\n", 1)[1])
    self.assertEqual(data["notes"][0]["content"], "Exact note body")
    self.assertEqual(data["index"][0]["id"], "n1")
    self.assertNotIn("Exact note body", prompt)
    self.assertIn('AGENT SCOPE pro create_note (JSON): "Lab"', prompt)
    self.assertIn("ASSIST vyžaduje potvrzení", prompt)
    self.assertIn("nedůvěryhodná data", prompt)
    self.assertEqual(prepared.complete_note_ids, ["n1"])
    request.permissionMode = "read"
    prompt = main.prepare_chat(request).messages[0]["content"]
    self.assertIn("REZIM READ", prompt)
    self.assertIn("bez automatického grantu", prompt)

  def test_document_instructions_keep_the_full_envelope_and_existing_targets(self):
    request = main.ChatRequest(provider="ollama", model="demo", baseUrl="http://localhost:11434", permissionMode="assist", vaultFolders=["Lab"], vaultIndex=[{"id": "n1", "title": "TLS", "folder": "Lab"}], vaultContext=[{"id": "n1", "title": "TLS", "content": "Exact note body", "folder": "Lab"}], messages=[{"role": "user", "content": "Doplň poznámku TLS o diagram"}])
    prepared = main.prepare_chat(request)
    prompt = prepared.messages[0]["content"]
    self.assertEqual(prepared.workload, "document")
    self.assertEqual(prepared.budget.output_tokens, 6144)
    self.assertIsNotNone(prepared.output_schema)
    self.assertIn("JSON schema", prompt)
    self.assertIn("zachovej původní obsah", prompt)
    request.provider = "openai-compatible"
    self.assertIn("<ethical-note>", main.prepare_chat(request).messages[0]["content"])
    data = json.loads(prepared.messages[1]["content"].split("\n", 1)[1])
    self.assertEqual(data["index"][0]["title"], "TLS")
    self.assertEqual(data["notes"][0]["content"], "Exact note body")
    self.assertEqual(prepared.complete_note_ids, ["n1"])

  def test_request_size_limit(self):
    response = self.client.post("/api/chat", headers={**self.capability, "Content-Type": "application/json"}, content=b"x" * (2 * 1024 * 1024 + 1))
    self.assertEqual(response.status_code, 413)


class ProviderTests(unittest.IsolatedAsyncioTestCase):
  async def test_localhost_prefers_validated_ipv4_for_the_managed_ollama_listener(self):
    loop = asyncio.get_running_loop()
    with patch.object(loop, "getaddrinfo", AsyncMock(return_value=[(10, 1, 6, "", ("::1", 11434, 0, 0)), (2, 1, 6, "", ("127.0.0.1", 11434))])):
      endpoint, _, _ = await providers.provider_endpoint("http://localhost:11434", "/api/chat")
    self.assertEqual(endpoint, "http://127.0.0.1:11434/api/chat")
  async def test_actual_ollama_stats_are_converted_and_model_stays_warm(self):
    metrics = {}
    payload = {"message": {"content": "answer"}, "prompt_eval_count": 120, "eval_count": 40, "load_duration": 500000000, "prompt_eval_duration": 250000000, "eval_duration": 2000000000}
    with patch.object(providers, "request_json", AsyncMock(return_value=payload)) as request:
      self.assertEqual(await providers.chat_ollama("http://localhost:11434", "demo", [], 768, metrics=metrics), "answer")
      self.assertEqual(request.call_args.kwargs["body"]["keep_alive"], "15m")
      self.assertEqual(request.call_args.kwargs["body"]["options"]["num_predict"], 768)
      self.assertFalse(request.call_args.kwargs["body"]["truncate"])
      self.assertFalse(request.call_args.kwargs["body"]["shift"])
    self.assertEqual(metrics, {"inputTokens": 120, "outputTokens": 40, "loadMs": 500, "promptMs": 250, "generationMs": 2000, "tokensPerSecond": 20, "truncated": False})

  async def test_bad_or_missing_stats_are_not_fabricated(self):
    self.assertEqual(providers.ollama_metrics({}), {"truncated": False})
    metrics = providers.ollama_metrics({"prompt_eval_count": True, "eval_count": -1, "load_duration": float("nan"), "prompt_eval_duration": float("inf"), "eval_duration": 0, "done_reason": "length"})
    self.assertEqual(metrics, {"generationMs": 0, "truncated": True})
    self.assertNotIn("tokensPerSecond", providers.ollama_metrics({"eval_count": 1, "eval_duration": 0}))
    self.assertNotIn("inputTokens", providers.ollama_metrics({"prompt_eval_count": 10 ** 400}))

  async def test_stream_handles_split_utf8_chunks_and_requires_a_done_event(self):
    original = httpx.AsyncClient
    body = (json.dumps({"message": {"content": "Máša"}, "done": False}, ensure_ascii=False) + "\n" + json.dumps({"message": {"content": ""}, "done": True, "eval_count": 4, "eval_duration": 1000000000})).encode()
    class Chunks(httpx.AsyncByteStream):
      async def __aiter__(self):
        for index in range(0, len(body), 2):
          yield body[index:index + 2]
    transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=Chunks()))
    with patch.object(providers.httpx, "AsyncClient", side_effect=lambda **kwargs: original(**kwargs, transport=transport)):
      events = [event async for event in providers.stream_ollama("http://127.0.0.1:11434", "demo", [], 768)]
    self.assertEqual(events[0], {"type": "delta", "content": "Máša"})
    self.assertEqual(events[-1]["metrics"]["tokensPerSecond"], 4)
    body = json.dumps({"message": {"content": "partial"}}).encode()
    with patch.object(providers.httpx, "AsyncClient", side_effect=lambda **kwargs: original(**kwargs, transport=transport)):
      with self.assertRaises(providers.ProviderError):
        _ = [event async for event in providers.stream_ollama("http://127.0.0.1:11434", "demo", [], 768)]

  async def test_context_overflow_has_a_useful_error_without_echoing_provider_data(self):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(400, json={"error": "input exceeds context length; secret-provider-text"}))
    with patch.object(providers.httpx, "AsyncClient", side_effect=lambda **kwargs: original(**kwargs, transport=transport)):
      with self.assertRaisesRegex(providers.ProviderError, "překračuje kontext"):
        await providers.chat_ollama("http://127.0.0.1:11434", "demo", [])

  async def test_openai_usage_has_counts_but_no_invented_generation_speed(self):
    metrics = {}
    payload = {"choices": [{"message": {"content": "answer"}, "finish_reason": "length"}], "usage": {"prompt_tokens": 12, "completion_tokens": 3}}
    with patch.object(providers, "request_json", AsyncMock(return_value=payload)):
      await providers.chat_openai_compatible("http://localhost:8080", "demo", [], None, metrics=metrics)
    self.assertEqual(metrics, {"inputTokens": 12, "outputTokens": 3, "truncated": True})

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
