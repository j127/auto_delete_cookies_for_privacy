/** @jest-environment jsdom */
import { initPageDirection } from "@/ui/page-direction";

describe("page-direction", () => {
  const messages: { [key: string]: string } = {};

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string) => messages[key] ?? ""
    );
    delete messages["@@bidi_dir"];
    delete messages["@@ui_locale"];
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
  });

  it("sets dir=rtl for right-to-left UI locales", () => {
    messages["@@bidi_dir"] = "rtl";
    initPageDirection();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("sets dir=ltr for left-to-right UI locales", () => {
    messages["@@bidi_dir"] = "ltr";
    initPageDirection();
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("sets lang from @@ui_locale with BCP 47 dashes", () => {
    messages["@@bidi_dir"] = "ltr";
    messages["@@ui_locale"] = "pt_BR";
    initPageDirection();
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("ignores unexpected direction values", () => {
    messages["@@bidi_dir"] = "sideways";
    initPageDirection();
    expect(document.documentElement.getAttribute("dir")).toBeNull();
  });

  it("leaves the document untouched when i18n is unavailable", () => {
    global.browser.i18n.getMessage.mockImplementation(() => {
      throw new Error("no i18n here");
    });
    expect(() => initPageDirection()).not.toThrow();
    expect(document.documentElement.getAttribute("dir")).toBeNull();
    expect(document.documentElement.getAttribute("lang")).toBeNull();
  });
});
