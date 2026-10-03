import { memo, useCallback, useEffect, useState } from "react";
import {
  clearStoredSession,
  loginAccount,
  registerAccount,
  restoreAccount
} from "../lib/auth";
import type { UserProfile } from "../types";

export const AccountPanel = memo(function AccountPanel() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("Načítám účet…");

  useEffect(() => {
    let cancelled = false;

    void restoreAccount().then((profile) => {
      if (cancelled) return;
      setUser(profile);
      setStatus(profile ? "Session obnovena." : "Přihlas se nebo vytvoř lokální účet.");
      setBusy(false);
    }).catch(() => {
      if (!cancelled) {
        setStatus("Account backend není dostupný.");
        setBusy(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);

    try {
      if (mode === "register") {
        await registerAccount(email, password, displayName);
      }

      const session = await loginAccount(email, password);
      setUser(session.user);
      setPassword("");
      setStatus("Přihlášeno jako " + session.user.displayName + ".");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Přihlášení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }, [displayName, email, mode, password]);

  const logout = useCallback(async () => {
    await clearStoredSession();
    setUser(null);
    setPassword("");
    setStatus("Odhlášeno.");
  }, []);

  return (
    <main className="account-pane">
      <section className="account-shell">
        <header className="account-heading">
          <span>IDENTITY</span>
          <h1>Ethical World account</h1>
          <p>Účet je základ pro budoucí sync, team workspaces a E2E messaging.</p>
        </header>

        {user ? (
          <div className="account-profile">
            <div className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.email}</span>
              <small>User ID · {user.id}</small>
            </div>
            <button type="button" onClick={() => void logout()}>Odhlásit</button>
          </div>
        ) : (
          <div className="account-form">
            <div className="account-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => setMode("login")}
              >
                Přihlášení
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => setMode("register")}
              >
                Nový účet
              </button>
            </div>

            {mode === "register" && (
              <label>
                Jméno
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                />
              </label>
            )}

            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label>
              Heslo
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </label>

            <button
              type="button"
              className="account-submit"
              onClick={() => void submit()}
              disabled={
                busy ||
                !email.trim() ||
                password.length < (mode === "register" ? 12 : 1) ||
                (mode === "register" && !displayName.trim())
              }
            >
              {busy ? "Pracuju…" : mode === "register" ? "Vytvořit účet" : "Přihlásit"}
            </button>
          </div>
        )}

        <div className="account-security">
          <strong>Security foundation</strong>
          <span>Heslo → scrypt + unique salt</span>
          <span>Session v DB → pouze SHA-256 hash</span>
          <span>Desktop session → OS secure storage</span>
          <span>Budoucí private messages → server pouze ciphertext</span>
        </div>

        <p className="account-status">{status}</p>
      </section>
    </main>
  );
});

export default AccountPanel;
