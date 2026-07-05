/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "../../../src/redux/state";
import { SiteDataType } from "../../../src/typings/enums";
import CleanDataButton from "../../../src/ui/popup/components/CleanDataButton";

describe("CleanDataButton", () => {
  // animateFlash targets this element by id after every click.
  let flashTarget: HTMLElement;

  const renderButton = (ui: React.ReactElement) =>
    render(<Provider store={createStore(() => initialState)}>{ui}</Provider>);

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "4.0.0" });
    global.browser.browsingData.remove.mockResolvedValue(undefined);
    // jsdom has no crypto.randomUUID implementation; the cleanup
    // notifications generate their ids through it.
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => "test-uuid",
    });
    flashTarget = document.createElement("div");
    flashTarget.id = "cleanButtonContainer";
    document.body.appendChild(flashTarget);
  });

  afterEach(() => {
    flashTarget.remove();
  });

  it("renders the text prop as the button label", () => {
    const { getByRole } = renderButton(
      <CleanDataButton text="Custom Label" title="Custom Title" />
    );
    expect(getByRole("button").textContent).toBe("Custom Label");
  });

  it("falls back to the manualCleanSiteData<siteData> i18n label", () => {
    const { getByRole } = renderButton(
      <CleanDataButton siteData={SiteDataType.CACHE} hostname="example.com" />
    );
    expect(getByRole("button").textContent).toBe("manualCleanSiteDataCache");
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "manualCleanSiteDataCache"
    );
  });

  it("titles the button with the hostname-substituted domain message", () => {
    const { getByRole } = renderButton(
      <CleanDataButton siteData={SiteDataType.CACHE} hostname="example.com" />
    );
    expect(getByRole("button").getAttribute("title")).toBe(
      "manualCleanSiteDataCacheDomain"
    );
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "manualCleanSiteDataCacheDomain",
      ["example.com"]
    );
  });

  it("prefers an explicit title prop over the siteData message", () => {
    const { getByRole } = renderButton(
      <CleanDataButton
        siteData={SiteDataType.CACHE}
        hostname="example.com"
        title="Custom Title"
      />
    );
    expect(getByRole("button").getAttribute("title")).toBe("Custom Title");
  });

  it("uses an empty title when neither title nor siteData data is given", () => {
    const { getByRole } = renderButton(<CleanDataButton text="x" />);
    expect(getByRole("button").getAttribute("title")).toBe("");
  });

  it("wires the button into the cleanCollapse collapse group", () => {
    const { getByRole } = renderButton(<CleanDataButton text="x" />);
    const button = getByRole("button");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("data-target")).toBe("#cleanCollapse");
    expect(button.getAttribute("data-toggle")).toBe("collapse");
    expect(button.getAttribute("aria-controls")).toBe("cleanCollapse");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("defaults to the btn-primary color", () => {
    const { getByRole } = renderButton(<CleanDataButton text="x" />);
    expect(getByRole("button").className).toBe(
      "btn btn-primary btn-block mt-1 px-2"
    );
  });

  it("uses btn-secondary when altColor is set", () => {
    const { getByRole } = renderButton(<CleanDataButton altColor text="x" />);
    expect(getByRole("button").className).toBe(
      "btn btn-secondary btn-block mt-1 px-2"
    );
  });

  it("lets btnColor override both color defaults", () => {
    const { getByRole } = renderButton(
      <CleanDataButton altColor btnColor="btn-warning" text="x" />
    );
    expect(getByRole("button").className).toBe(
      "btn btn-warning btn-block mt-1 px-2"
    );
  });

  it("runs the onClick callback and flashes success when it resolves true", async () => {
    const onClick = jest.fn().mockResolvedValue(true);
    const { getByRole } = renderButton(
      <CleanDataButton onClick={onClick} text="x" />
    );
    fireEvent.click(getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(flashTarget.classList.contains("successAnimated")).toBe(true);
    });
    expect(flashTarget.classList.contains("failureAnimated")).toBe(false);
  });

  it("flashes failure when the onClick callback resolves false", async () => {
    const onClick = jest.fn().mockResolvedValue(false);
    const { getByRole } = renderButton(
      <CleanDataButton onClick={onClick} text="x" />
    );
    fireEvent.click(getByRole("button"));
    await waitFor(() => {
      expect(flashTarget.classList.contains("failureAnimated")).toBe(true);
    });
    expect(flashTarget.classList.contains("successAnimated")).toBe(false);
  });

  it("cleans the site data through browsingData when no onClick is given", async () => {
    const { getByRole } = renderButton(
      <CleanDataButton siteData={SiteDataType.CACHE} hostname="example.com" />
    );
    fireEvent.click(getByRole("button"));
    await waitFor(() => {
      expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          origins: expect.arrayContaining(["https://example.com"]),
        }),
        { cache: true }
      );
    });
    await waitFor(() => {
      expect(flashTarget.classList.contains("successAnimated")).toBe(true);
    });
  });
});
