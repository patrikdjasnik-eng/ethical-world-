// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RemoteImage } from "../src/components/RemoteImage";

afterEach(cleanup);

it("binds network consent to the exact image URL, including its query", () => {
  const original = "https://example.test/image?public=1";
  const injected = "https://example.test/image?stolen=note-content";
  const { rerender } = render(<RemoteImage src={original} alt="diagram" />);
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("img").getAttribute("src")).toBe(original);
  rerender(<RemoteImage src={injected} alt="diagram" />);
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("img").getAttribute("src")).toBe(injected);
  expect(screen.getByRole("img").getAttribute("referrerpolicy")).toBe("no-referrer");
});

it.each(["javascript:alert(1)", "file:///private", "http://127.0.0.1:11434/api/chat", "data:image/svg+xml,<svg></svg>"])("does not fetch an unapproved scheme: %s", (src) => {
  render(<RemoteImage src={src} alt="blocked" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
