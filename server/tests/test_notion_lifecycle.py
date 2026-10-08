from __future__ import annotations

import asyncio
import os
import unittest
from urllib.parse import parse_qs, urlparse
from unittest.mock import AsyncMock, MagicMock, patch
from server import notion_connector as connector


class NotionLifecycleTests(unittest.IsolatedAsyncioTestCase):
  async def test_disconnect_invalidates_waiting_state_and_inflight_exchange(self):
    with patch.dict(os.environ, {"ETHICAL_NOTION_CLIENT_ID": "fixture", "ETHICAL_NOTION_CLIENT_SECRET": "fixture"}):
      waiting = parse_qs(urlparse(connector.start_oauth("waiting-user")).query)["state"][0]
      with patch.object(connector, "delete_connector_secret"):
        connector.disconnect("waiting-user")
      with self.assertRaises(connector.NotionConnectorError):
        await connector.finish_oauth("code", waiting)

      state = parse_qs(urlparse(connector.start_oauth("inflight-user")).query)["state"][0]
      entered, release = asyncio.Event(), asyncio.Event()
      response = MagicMock(is_success=True)
      response.json.return_value = {"access_token": "fixture-token"}
      async def exchange(*args, **kwargs):
        entered.set()
        await release.wait()
        return response
      client = MagicMock()
      client.__aenter__ = AsyncMock(return_value=client)
      client.__aexit__ = AsyncMock(return_value=None)
      client.post = exchange
      with patch.object(connector.httpx, "AsyncClient", return_value=client), patch.object(connector, "save_connector_secret") as saved, patch.object(connector, "delete_connector_secret"), patch.object(connector, "_fernet") as fernet:
        fernet.return_value.encrypt.return_value = b"encrypted"
        task = asyncio.create_task(connector.finish_oauth("code", state))
        await entered.wait()
        connector.disconnect("inflight-user")
        release.set()
        with self.assertRaisesRegex(connector.NotionConnectorError, "zrušená"):
          await task
        saved.assert_not_called()

  async def test_a_new_login_rejects_the_previous_state(self):
    with patch.dict(os.environ, {"ETHICAL_NOTION_CLIENT_ID": "fixture", "ETHICAL_NOTION_CLIENT_SECRET": "fixture"}):
      old = parse_qs(urlparse(connector.start_oauth("replace-user")).query)["state"][0]
      connector.start_oauth("replace-user")
      response = MagicMock(is_success=True)
      response.json.return_value = {"access_token": "fixture-token"}
      client = MagicMock()
      client.__aenter__ = AsyncMock(return_value=client)
      client.__aexit__ = AsyncMock(return_value=None)
      client.post = AsyncMock(return_value=response)
      with patch.object(connector.httpx, "AsyncClient", return_value=client), patch.object(connector, "save_connector_secret") as saved, patch.object(connector, "_fernet") as fernet:
        fernet.return_value.encrypt.return_value = b"encrypted"
        with self.assertRaisesRegex(connector.NotionConnectorError, "Neplatný|nahrazená"):
          await connector.finish_oauth("code", old)
        client.post.assert_not_awaited()
        saved.assert_not_called()
