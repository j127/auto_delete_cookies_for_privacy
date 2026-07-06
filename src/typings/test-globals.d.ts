/// <reference types="vitest/globals" />

/**
 * Test-only globals. Vitest's globals mode types describe/it/expect/vi via
 * the reference above; everything below covers what the suite layers on top:
 *
 * - vitest-setup.ts aliases `jest` to `vi`, so the hundreds of existing
 *   jest.fn()/jest.spyOn() call sites keep working. The namespace mirrors
 *   the jest type names specs use in TYPE positions (jest.Mock etc.).
 * - __tests__/setup.js installs the WebExtension mock tree on global.browser
 *   / global.chrome and a spy factory on global.generateSpies. @types/node
 *   is pinned to 14.11.2 (see package.json overrides), where augmenting
 *   NodeJS.Global is the supported way to type `global.*` members.
 */

declare const jest: (typeof import("vitest"))["vi"];

declare namespace jest {
  type Mock = import("vitest").Mock;
  type SpyInstance = import("vitest").MockInstance;
}

declare namespace NodeJS {
  interface Global {
    browser: any;
    chrome: any;
    generateSpies: (parent: object) => JestSpyObject;
  }
}
