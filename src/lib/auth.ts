import type { AuthSession, UserProfile } from "../types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const browserSessionKey = "ethical-world-session-token";

async function readStoredToken(): Promise<string | null> {
  if (window.ethicalDesktop) {
    return window.ethicalDesktop.authLoadSessionToken();
  }

  return window.sessionStorage.getItem(browserSessionKey);
}

async function writeStoredToken(token: string): Promise<void> {
  if (window.ethicalDesktop) {
    await window.ethicalDesktop.authStoreSessionToken(token);
    return;
  }

  window.sessionStorage.setItem(browserSessionKey, token);
}

export async function clearStoredSession(): Promise<void> {
  if (window.ethicalDesktop) {
    await window.ethicalDesktop.authClearSessionToken();
    return;
  }

  window.sessionStorage.removeItem(browserSessionKey);
}

async function parseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { detail?: string } | null;
  return payload?.detail ?? "Požadavek se nepodařilo dokončit.";
}

export async function registerAccount(
  email: string,
  password: string,
  displayName: string
): Promise<UserProfile> {
  const response = await fetch(apiUrl + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName })
  });

  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<UserProfile>;
}

export async function loginAccount(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(apiUrl + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) throw new Error(await parseError(response));

  const session = await response.json() as AuthSession;
  await writeStoredToken(session.sessionToken);
  return session;
}

export async function restoreAccount(): Promise<UserProfile | null> {
  const token = await readStoredToken();
  if (!token) return null;

  const response = await fetch(apiUrl + "/api/auth/me", {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(5000)
  }).catch(() => null);

  if (!response?.ok) {
    await clearStoredSession();
    return null;
  }

  return response.json() as Promise<UserProfile>;
}
