import { vi } from "vitest";
// The jest-style mock tree in __tests__/setup.js calls bare jest.* APIs;
// vi is API-compatible for everything it uses, so the alias must exist
// before the setup module loads.
(globalThis as any).jest = vi;
// Plain JS with no declaration file; typed as any on purpose.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
await import("./__tests__/setup.js");
