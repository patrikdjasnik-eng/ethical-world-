export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!/^\/(?:api\/[a-z0-9/-]+|health)$/.test(path)) {
    throw new Error("Nepovolená gateway cesta.");
  }

  if (window.ethicalDesktop) {
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const result = await window.ethicalDesktop.gatewayRequest({
      path,
      method: init.method === "POST" ? "POST" : "GET",
      headers,
      body: typeof init.body === "string" ? init.body : undefined
    });
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": "application/json" }
    });
  }

  return fetch(path, { ...init, signal: init.signal ?? AbortSignal.timeout(15000) });
}
