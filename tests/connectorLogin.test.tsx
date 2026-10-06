// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectorPanel } from "../src/components/ConnectorPanel";
import type { EthicalDesktopApi } from "../src/types/desktop";

vi.mock("../src/lib/notionConnector", () => ({
  getNotionStatus: vi.fn(async () => ({ configured: false, connected: false, workspaceName: null }))
}));

function desktop(overrides: Partial<EthicalDesktopApi> = {}) {
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: {
    githubStatus: vi.fn(async () => ({ configured: true, connected: false, login: null })),
    githubStartLogin: vi.fn(async () => ({ configured: true, error: "GitHub aplikace nemá zapnutý Device Flow." })),
    githubConnectToken: vi.fn(async () => ({ connected: true, login: "fixture" })),
    githubListRepos: vi.fn(async () => [{ fullName: "fixture/notes", private: true, defaultBranch: "main", canPush: true }]),
    ...overrides
  } });
}

afterEach(() => { cleanup(); delete window.ethicalDesktop; });

describe("GitHub login feedback and native token fallback", () => {
  it("shows the device-flow error without polling a missing session", async () => {
    const poll = vi.fn();
    desktop({ githubPollLogin: poll });
    render(<ConnectorPanel notes={[]} onImportNotes={vi.fn(async () => {})} />);
    await screen.findByText("GitHub je připravený k přihlášení.");
    fireEvent.click(screen.getByRole("button", { name: "Připojit GitHub" }));
    await screen.findByText("GitHub aplikace nemá zapnutý Device Flow.");
    expect(poll).not.toHaveBeenCalled();
  });

  it("connects with a native token prompt even when device OAuth is unconfigured", async () => {
    desktop({ githubStatus: vi.fn(async () => ({ configured: false, connected: false, login: null })) });
    render(<ConnectorPanel notes={[]} onImportNotes={vi.fn(async () => {})} />);
    await screen.findByText("Device OAuth není nakonfigurovaný. GitHub lze připojit tokenem.");
    expect((screen.getByRole("button", { name: "Připojit GitHub" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Připojit tokenem" }));
    await screen.findByText("Připojeno · @fixture");
    await screen.findByRole("option", { name: "fixture/notes · private" });
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("shows an invalid token result and lets the connection be retried", async () => {
    const connect = vi.fn(async () => ({ connected: false, login: null, error: "GitHub token je neplatný nebo vypršel." }));
    desktop({ githubConnectToken: connect });
    render(<ConnectorPanel notes={[]} onImportNotes={vi.fn(async () => {})} />);
    fireEvent.click(await screen.findByRole("button", { name: "Připojit tokenem" }));
    await screen.findByText("GitHub token je neplatný nebo vypršel.");
    await waitFor(() => expect((screen.getByRole("button", { name: "Připojit tokenem" }) as HTMLButtonElement).disabled).toBe(false));
    expect(connect).toHaveBeenCalledOnce();
  });
});
