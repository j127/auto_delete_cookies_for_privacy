/**
 * @jest-environment jsdom
 */
import { animateFlash } from "../../../src/ui/popup/popup-lib";

describe("animateFlash", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds the successAnimated class when success is true", () => {
    const node = document.createElement("div");
    animateFlash(node, true);
    expect(node.classList.contains("successAnimated")).toBe(true);
    expect(node.classList.contains("failureAnimated")).toBe(false);
  });

  it("adds the failureAnimated class when success is false", () => {
    const node = document.createElement("div");
    animateFlash(node, false);
    expect(node.classList.contains("failureAnimated")).toBe(true);
    expect(node.classList.contains("successAnimated")).toBe(false);
  });

  it("removes the flash class 1500ms later", () => {
    const node = document.createElement("div");
    animateFlash(node, true);
    jest.advanceTimersByTime(1499);
    expect(node.classList.contains("successAnimated")).toBe(true);
    jest.advanceTimersByTime(1);
    expect(node.classList.contains("successAnimated")).toBe(false);
  });

  it("leaves pre-existing classes on the node untouched", () => {
    const node = document.createElement("div");
    node.classList.add("btn-group");
    animateFlash(node, false);
    expect(node.classList.contains("btn-group")).toBe(true);
    jest.advanceTimersByTime(1500);
    expect(node.className).toBe("btn-group");
  });

  it("does nothing when the node is null", () => {
    expect(() => animateFlash(null, true)).not.toThrow();
    expect(jest.getTimerCount()).toBe(0);
  });
});
