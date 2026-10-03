import { memo, useCallback, useEffect, useState } from "react";
import {
  changeAccountPassword,
  clearStoredSession,
  loginAccount,
  registerAccount,
  restoreAccount
} from "../lib/auth";
import type { UserProfile } from "../types";

interface AccountPanelProps {
  onSecurityStateChange?: (locked: boolean) => void;
  onUserChange?: (user: UserProfile | null) => void;
}

export const AccountPanel = memo(function AccountPanel({
  onSecurityStateChange,
  onUserChange
}: AccountPanelProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("Načítám účet…");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    void restoreAccount().then((profile) => {
      if (cancelled) return;
      setUser(profile);
      onUserChange?.(profile);
      onSecurityStateChange?.(Boolean(profile?.mustChangePassword));
      setStatus(
        profile?.mustChangePassword
          ? "Owner účet čeká na nastavení vlastního hesla."
          : profile
            ? "Session obnovena."
            : "Přihlas se nebo vytvoř lokální účet."
      );
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
  }, [onSecurityStateChange, onUserChange]);

  const submit = useCallback(async () => {
    setBusy(true);

    try {
      if (mode === "register") {
        await registerAccount(email, password, displayName);
      }

      const session = await loginAccount(email, password);
      setUser(session.user);
      onUserChange?.(session.user);
      onSecurityStateChange?.(session.user.mustChangePassword);
      setPassword("");
      setStatus("Přihlášeno jako " + session.user.displayName + ".");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Přihlášení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }, [displayName, email, mode, onSecurityStateChange, onUserChange, password]);

  const submitPasswordChange = useCallback(async () => {
    if (newPassword.length < 12 || newPassword !== confirmPassword) return;

    setBusy(true);

    try {
      const updated = await changeAccountPassword(newPassword);
      setUser(updated);
      onUserChange?.(updated);
      setNewPassword("");
      setConfirmPassword("");
      onSecurityStateChange?.(false);
      setStatus("Heslo změněno. Owner účet je aktivní.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Změna hesla selhala.");
    } finally {
      setBusy(false);
    }
  }, [confirmPassword, newPassword, onSecurityStateChange, onUserChange]);

  const logout = useCallback(async () => {
    await clearStoredSession();
    setUser(null);
    onUserChange?.(null);
    setPassword("");
    onSecurityStateChange?.(false);
    setStatus("Odhlášeno.");
  }, [onSecurityStateChange, onUserChange]);

  return (
    <main className="account-pane">
      <section className="account-shell">
        <header className="account-heading">
          <span>IDENTITY</span>
          <h1>Ethical World account</h1>
          <p>Účet je základ pro budoucí sync, team workspaces a E2E messaging.</p>
        </header>

        {user?.mustChangePassword ? (
          <div className="account-form account-password-required">
            <div className="account-lock-badge">OWNER · FIRST LOGIN</div>
            <h2>Nastav vlastní heslo</h2>
            <p>
              Bootstrap přístup je jednorázový. Dokud heslo nezměníš,
              ostatní části Ethical World zůstanou zamčené.
            </p>

            <label>
              Nové heslo
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <label>
              Potvrzení hesla
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void submitPasswordChange();
                  }
                }}
                autoComplete="new-password"
              />
            </label>

            <button
              type="button"
              className="account-submit"
              disabled={busy || newPassword.length < 12 || newPassword !== confirmPassword}
              onClick={() => void submitPasswordChange()}
            >
              {busy ? "Ukládám…" : "Nastavit heslo a odemknout"}
            </button>
          </div>
        ) : user ? (
          <div className="account-profile">
            <div className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.email}</span>
              <small>{user.role.toUpperCase()} · {user.id}</small>
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
