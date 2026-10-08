export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!/^\/(?:api\/[a-z0-9/-]+|health)$/.test(path)) {
    throw new Error("Nepovolená gateway cesta.");
  }

  if (window.ethicalDesktop) {
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const desktop = window.ethicalDesktop;
    const id = crypto.randomUUID();
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const task = desktop.gatewayRequest({
      id,
      path,
      method: init.method === "POST" ? "POST" : "GET",
      headers,
      body: typeof init.body === "string" ? init.body : undefined
    });
    let cancel = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => {
        void desktop.cancelGatewayRequest?.(id).catch(() => undefined);
        reject(new DOMException("Aborted", "AbortError"));
      };
      init.signal?.addEventListener("abort", cancel, { once: true });
      if (init.signal?.aborted) cancel();
    });
    let result;
    try { result = await Promise.race([task, aborted]); }
    finally { init.signal?.removeEventListener("abort", cancel); }
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": "application/json" }
    });
  }

  return fetch(path, { ...init, signal: init.signal ?? AbortSignal.timeout(15000) });
}

export async function gatewayStream(body: string, onEvent: (event: unknown) => void, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const desktop = window.ethicalDesktop;
  if (desktop?.gatewayStreamRequest) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const task = desktop.gatewayStreamRequest(id, { path: "/api/chat/stream", method: "POST", body }, (event) => { if (!signal.aborted) onEvent(event); });
    const cancel = () => { void desktop.cancelGatewayStream?.(id).catch(() => undefined); };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    try {
      const result = await task;
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return result;
    } finally { signal.removeEventListener("abort", cancel); }
  }
  const response = await fetch("/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal, redirect: "error" });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? `AI request failed (${response.status})`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider nevrátil průběžnou odpověď.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let size = 0;
  let result: unknown;
  let completed = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (!event || !["start", "delta", "final", "error"].includes(event.type) || completed) throw new Error("Neplatná průběžná odpověď.");
    if (event.type === "error") throw new Error(typeof event.message === "string" ? event.message : "Provider selhal.");
    if (event.type === "final") { result = event.response; completed = true; }
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new Error("Odpověď je příliš velká.");
      pending += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        consume(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
    }
    consume(pending + decoder.decode());
    if (!completed) throw new Error("Spojení skončilo před dokončením odpovědi. Nic se neprovedlo.");
    return result;
  } finally { await reader.cancel(); }
}
