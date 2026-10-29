import { afterAll } from "vitest";
import type {} from "vitest/jsdom";

if (typeof jsdom !== "undefined") {
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, storageName);

    // Node může vystavit vlastní Web Storage; DOM testy potřebují úložiště své stránky.
    Object.defineProperty(globalThis, storageName, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: jsdom.window[storageName]
    });

    afterAll(() => {
      if (originalDescriptor) Object.defineProperty(globalThis, storageName, originalDescriptor);
      else Reflect.deleteProperty(globalThis, storageName);
    });
  }
}
