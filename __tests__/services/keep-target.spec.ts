/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The rule the popup's Keep buttons add, which the keyboard shortcuts
 * (#588) share.
 */
import { keepTargetFor } from "@/services/keep-target";

describe("keepTargetFor", () => {
  it("keeps the whole site from a subdomain", () => {
    expect(keepTargetFor("https://shop.example.com/page")).toEqual({
      addableHostnames: [
        "*.example.com",
        "shop.example.com",
        "*.shop.example.com",
      ],
      domain: "example.com",
      hostname: "shop.example.com",
      keepExpression: "*.example.com",
    });
  });

  it("keeps the site and its subdomains from the main domain", () => {
    expect(keepTargetFor("https://example.com/")).toEqual({
      addableHostnames: ["example.com", "*.example.com"],
      domain: "example.com",
      hostname: "example.com",
      keepExpression: "*.example.com",
    });
  });

  it("keeps an IP address as it is", () => {
    const target = keepTargetFor("http://192.168.1.10:8080/");
    expect(target.hostname).toBe("192.168.1.10");
    expect(target.addableHostnames).toEqual(["192.168.1.10"]);
    expect(target.keepExpression).toBe("192.168.1.10");
  });

  it("finds no site on a tab without one", () => {
    expect(keepTargetFor("about:newtab").hostname).toBe("");
    expect(keepTargetFor(undefined)).toEqual({
      addableHostnames: [],
      domain: "",
      hostname: "",
      keepExpression: "",
    });
  });
});
