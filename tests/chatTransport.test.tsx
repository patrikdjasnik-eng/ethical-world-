// @vitest-environment jsdom
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiPanel from "../src/components/AiPanel";
import type { EthicalDesktopApi } from "../src/types/desktop";

const require = createRequire(import.meta.url);
const { gatewayRequest } = require("../electron/backend-runtime.cjs") as {
  gatewayRequest: (baseUrl: string, token: string, request: Parameters<EthicalDesktopApi["gatewayRequest"]>[0]) => ReturnType<EthicalDesktopApi["gatewayRequest"]>;
};
const capability = "test-runtime-capability";
let server: Server;
let requests: { messages: { role: string; content: string }[]; model: string }[];
let rejectChat = false;

beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  requests = [];
  rejectChat = false;
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/health") {
      response.end(JSON.stringify({ status: "ok", proof: createHmac("sha256", capability).update(url.searchParams.get("challenge") ?? "").digest("hex") }));
      return;
    }
    if (request.headers["x-ethical-capability"] !== capability) {
      response.writeHead(401).end(JSON.stringify({ detail: "Unauthorized fixture" }));
      return;
    }
    if (url.pathname === "/api/chat") {
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      const payload = JSON.parse(body) as typeof requests[number];
      requests.push(payload);
      if (rejectChat) response.writeHead(502).end(JSON.stringify({ detail: "Provider dočasně nedostupný" }));
      else response.end(JSON.stringify({ content: "Odpověď přes desktop gateway", provider: "ollama", model: payload.model, completeNoteIds: [] }));
      return;
    }
    response.end(JSON.stringify({ online: true, provider: "ollama", model: "fixture", models: ["fixture"], baseUrl: "http://localhost:11434" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind a TCP port");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  window.ethicalDesktop = { gatewayRequest: (request) => gatewayRequest(baseUrl, capability, request) } as EthicalDesktopApi;
});

afterEach(async () => {
  cleanup();
  delete window.ethicalDesktop;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function setup() {
  render(<AiPanel notes={[]} activeNote={null} folders={[]} visible onRequestHide={() => {}} onApplyAgentAction={async () => "fixture"} />);
  await screen.findByText(/Online · fixture/);
  return screen.getByRole("textbox", { name: "Zpráva Máše" }) as HTMLTextAreaElement;
}

it.each(["Enter", "button"])("%s sends one draft through the real client and capability-verified gateway", async (trigger) => {
  const input = await setup();
  fireEvent.change(input, { target: { value: "Zpráva přes skutečné HTTP" } });
  if (trigger === "Enter") fireEvent.keyDown(input, { key: "Enter" });
  else fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Odpověď přes desktop gateway");
  expect(requests).toHaveLength(1);
  expect(requests[0].messages.at(-1)).toEqual({ role: "user", content: "Zpráva přes skutečné HTTP" });
  expect(input.value).toBe("");
});

it("a failed HTTP response preserves the draft and retry does not duplicate the user message", async () => {
  const input = await setup();
  rejectChat = true;
  fireEvent.change(input, { target: { value: "Text zachovat" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toBe("Provider dočasně nedostupný");
  expect(input.value).toBe("Text zachovat");
  rejectChat = false;
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Odpověď přes desktop gateway");
  expect(requests).toHaveLength(2);
  expect(requests[1].messages.filter((message) => message.role === "user")).toHaveLength(1);
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
});
