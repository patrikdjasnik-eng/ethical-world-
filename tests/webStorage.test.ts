// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import type {} from "vitest/jsdom";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it("shares browser storage between page code and the current DOM without a Node storage file", () => {
  localStorage.setItem("settings", "chosen-model");
  expect(jsdom.window.localStorage.getItem("settings")).toBe("chosen-model");
  jsdom.window.localStorage.setItem("settings", "updated-model");
  expect(window.localStorage.getItem("settings")).toBe("updated-model");
  expect(localStorage.length).toBe(1);
  expect(localStorage.key(0)).toBe("settings");
  expect(localStorage.getItem("missing")).toBeNull();
  localStorage.removeItem("settings");
  expect(jsdom.window.localStorage.length).toBe(0);
});

it("keeps session storage separate and supports the page's browser storage semantics", () => {
  localStorage.setItem("draft", "saved");
  sessionStorage.setItem("draft", "session-only");
  expect(jsdom.window.sessionStorage.getItem("draft")).toBe("session-only");
  expect(jsdom.window.localStorage.getItem("draft")).toBe("saved");
  jsdom.window.sessionStorage.clear();
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.getItem("draft")).toBe("saved");
});
