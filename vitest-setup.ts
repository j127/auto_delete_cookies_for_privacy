import { vi } from "vitest";
// The jest-style mock tree in __tests__/setup.js calls bare jest.* APIs;
// vi is API-compatible for everything it uses, so the alias must exist
// before the setup module loads.
(globalThis as any).jest = vi;
// Mirrors the Bun.build define from scripts/build.ts: bundles get the
// browser identity at build time, tests at runtime. Chrome is the default
// flavor; Firefox-flavored suites stub this per file (vi.stubGlobal +
// vi.resetModules) before importing src modules.
(globalThis as any).__BROWSER__ = "chrome";
// Plain JS with no declaration file; typed as any on purpose.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
await import("./__tests__/setup.js");
