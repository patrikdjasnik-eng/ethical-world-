from __future__ import annotations
import json
import unittest
from unittest.mock import AsyncMock, patch
from server.tests import test_security
from server import main, providers
from server.note_output import note_actions
from server.chat_safety import RepetitionGuard


def proposal(**overrides):
    return {"operation": "create", "noteId": "", "title": "TLS", "folder": "Lab", "content": '# TLS\n\n```mermaid\nflowchart TD\n A[Client] --> B[Server]\n```\n\nLiteral </content> stays in the note.', **overrides}


def request(**overrides):
    return main.ChatRequest(**{"provider": "ollama", "model": "fixture", "baseUrl": "http://127.0.0.1:11434", "permissionMode": "assist", "vaultFolders": ["Lab"], "messages": [{"role": "user", "content": "Vytvoř poznámku o TLS ve složce Lab"}], **overrides})


class NoteOutputTests(unittest.TestCase):
    def test_markdown_is_preserved_and_batch_is_validated_before_any_action(self):
        raw = json.dumps({"notes": [proposal(), proposal(title="Other", operation="update", noteId="n1")]})
        actions = note_actions(raw, ["n1"], ["Lab"], None)
        self.assertEqual(actions[0]["content"], proposal()["content"])
        self.assertEqual(actions[1]["type"], "update_note")
        for changed in (proposal(folder="Unknown"), proposal(content="  "), proposal(noteId="n1"), proposal(operation="update", noteId="partial"), proposal(user_confirmed=True)):
            with self.subTest(changed=changed), self.assertRaises(providers.ProviderError):
                note_actions(json.dumps({"notes": [proposal(), changed]}), ["n1"], ["Lab"], None)
        with self.assertRaises(providers.ProviderError):
            note_actions(json.dumps({"notes": [proposal(operation="update", noteId="n1")] * 2}), ["n1"], ["Lab"], None)

    def test_missing_folders_are_validated_and_proposed_before_notes(self):
        raw = json.dumps({"folders": [{"name": "Cybersecurity", "parentPath": ""}, {"name": "Malware", "parentPath": "Cybersecurity"}], "notes": [proposal(folder="Cybersecurity/Malware")]})
        actions = note_actions(raw, [], [], None)
        self.assertEqual([a["type"] for a in actions], ["create_folder", "create_folder", "create_note"])
        for folder in ({"name": "../Other", "parentPath": ""}, {"name": "New", "parentPath": "Missing"}, {"name": "Lab", "parentPath": ""}):
            with self.subTest(folder=folder), self.assertRaises(providers.ProviderError):
                note_actions(json.dumps({"folders": [folder], "notes": [proposal()]}), [], ["Lab"], None)

    def test_malformed_truncated_and_oversized_outputs_fail_closed(self):
        for raw in ('{"notes":[', '{"notes":[]}', json.dumps({"notes": [proposal()] * 9}), json.dumps({"notes": [proposal(content="x" * 60001)]})):
            with self.subTest(raw=raw[:50]), self.assertRaises(providers.ProviderError):
                note_actions(raw, [], ["Lab"], None)

    def test_document_schema_is_not_used_for_read_or_ordinary_chat(self):
        self.assertIsNotNone(main.prepare_chat(request()).output_schema)
        for payload in (request(permissionMode="read"), request(messages=[{"role": "user", "content": "Co je malware?"}]), request(provider="openai-compatible")):
            self.assertIsNone(main.prepare_chat(payload).output_schema)

    def test_exact_prose_loop_is_stopped_across_chunks_but_short_repetitions_are_allowed(self):
        block = "LinkedIn je profesní sociální síť pro kontakty pracovní nabídky firmy a sdílení zkušeností. "
        guard = RepetitionGuard()
        with self.assertRaisesRegex(providers.ProviderError, "opakovat"):
            for char in block * 5:
                guard.feed(char)
        RepetitionGuard().check("ano " * 100)
        RepetitionGuard().check(block * 3)


class NoteOutputApiTests(unittest.TestCase):
    setUp = test_security.SecurityTests.setUp
    tearDown = test_security.SecurityTests.tearDown

    def test_json_proposals_return_actions_without_showing_machine_data(self):
        payload = request().model_dump()
        with patch.object(main, "chat_ollama", AsyncMock(return_value=json.dumps({"notes": [proposal()]}))) as model:
            response = self.client.post("/api/chat", headers=self.capability, json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["actions"][0]["type"], "create_note")
        self.assertNotIn("flowchart", response.json()["content"])
        self.assertIn("output_schema", model.call_args.kwargs)

    def test_stream_hides_json_until_validated_and_rejects_incomplete_updates(self):
        payload = request().model_dump()
        async def stream(*_args, **kwargs):
            self.assertIn("output_schema", kwargs)
            for part in json.dumps({"notes": [proposal()]}):
                yield {"type": "delta", "content": part}
            yield {"type": "done", "metrics": {"outputTokens": 120}}
        with patch.object(main, "stream_ollama", stream):
            response = self.client.post("/api/chat/stream", headers=self.capability, json=payload)
        events = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual([e["type"] for e in events], ["start", "final"])
        self.assertEqual(events[-1]["response"]["actions"][0]["content"], proposal()["content"])
        self.assertIn("firstTokenMs", events[-1]["response"]["metrics"])
        for raw in ('{"notes":[', json.dumps({"notes": [proposal(operation="update", noteId="unknown")]})):
            with patch.object(main, "chat_ollama", AsyncMock(return_value=raw)):
                failed = self.client.post("/api/chat", headers=self.capability, json=payload)
            self.assertEqual(failed.status_code, 502)

    def test_repeated_chat_stream_is_closed_before_final_response(self):
        closed = []
        block = "LinkedIn je profesní sociální síť pro kontakty pracovní nabídky firmy a sdílení zkušeností. "
        async def stream(*_args):
            try:
                for part in [block] * 20:
                    yield {"type": "delta", "content": part}
                yield {"type": "done", "metrics": {}}
            finally:
                closed.append(True)
        with patch.object(main, "stream_ollama", stream):
            response = self.client.post("/api/chat/stream", headers=self.capability, json=request(messages=[{"role": "user", "content": "Co je LinkedIn?"}]).model_dump())
        events = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual(events[-1]["type"], "error")
        self.assertIn("opakovat", events[-1]["message"])
        self.assertFalse(any(event["type"] == "final" for event in events))
        self.assertEqual(closed, [True])

    def test_token_limit_cannot_release_a_complete_looking_partial_batch(self):
        async def model(*_args, metrics, **_kwargs):
            metrics["truncated"] = True
            return json.dumps({"notes": [proposal()]})
        with patch.object(main, "chat_ollama", model):
            response = self.client.post("/api/chat", headers=self.capability, json=request().model_dump())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["actions"], [])
        self.assertTrue(response.json()["metrics"]["truncated"])


class StructuredProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_schema_reaches_the_actual_ollama_request_and_stream(self):
        schema = main.prepare_chat(request()).output_schema
        with patch.object(providers, "request_json", AsyncMock(return_value={"message": {"content": '{"notes":[]}'}})) as send:
            await providers.chat_ollama("http://localhost:11434", "fixture", [], output_schema=schema)
        self.assertEqual(send.call_args.kwargs["body"]["format"], schema)
        self.assertEqual(send.call_args.kwargs["body"]["options"]["temperature"], 0)
        captured = []
        async def lines(_url, _suffix, body):
            captured.append(body)
            yield {"message": {"content": '{}'}, "done": True}
        with patch.object(providers, "provider_json_lines", lines):
            events = [event async for event in providers.stream_ollama("http://localhost:11434", "fixture", [], 100, output_schema=schema)]
        self.assertEqual(captured[0]["format"], schema)
        self.assertEqual(events[-1]["type"], "done")
