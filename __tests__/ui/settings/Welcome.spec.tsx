/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "../../../src/redux/state";
import { ReduxConstants } from "../../../src/typings/redux-constants";
import fontAwesomeImports from "../../../src/ui/font-awesome-imports";
import Welcome from "../../../src/ui/settings/components/Welcome";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

const FORK_BASE = "https://github.com/j127/autodelete_cookies_for_privacy";

describe("Welcome", () => {
  const renderWelcome = (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    return {
      dispatchSpy,
      ...render(
        <Provider store={store}>
          <Welcome />
        </Provider>
      ),
    };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the welcome heading", () => {
    const { container } = renderWelcome();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "welcomeText"
    );
  });

  it("passes the session and total cleanup counters to the welcome message", () => {
    renderWelcome({
      cookieDeletedCounterSession: 5,
      cookieDeletedCounterTotal: 42,
    });
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "welcomeMessage",
      ["extensionName", "5", "42"]
    );
  });

  it("links to the fork documentation and FAQ pages", () => {
    const { getByText } = renderWelcome();
    const docLink = getByText("documentationText").closest(
      "a"
    ) as HTMLAnchorElement;
    expect(docLink.getAttribute("href")).toBe(
      `${FORK_BASE}/blob/main/documentation/src/introduction.md`
    );
    const faqLink = getByText("faqText").closest("a") as HTMLAnchorElement;
    expect(faqLink.getAttribute("href")).toBe(
      `${FORK_BASE}/blob/main/documentation/src/faq.md`
    );
  });

  it("links to the fork releases page for older release notes", () => {
    const { getByText } = renderWelcome();
    const releasesLink = getByText("GitHub") as HTMLAnchorElement;
    expect(releasesLink.getAttribute("href")).toBe(`${FORK_BASE}/releases`);
    expect(releasesLink.getAttribute("target")).toBe("_blank");
    expect(releasesLink.getAttribute("rel")).toBe("noreferrer");
  });

  it("renders the release notes section with at least one release", () => {
    const { container, getByText } = renderWelcome();
    expect((container.querySelector("h2") as HTMLElement).textContent).toBe(
      "releaseNotesText"
    );
    expect(getByText("4.0.0")).not.toBeNull();
    expect(container.querySelectorAll("ul li").length).toBeGreaterThan(0);
  });

  it("dispatches the reset counter action when the reset button is clicked", () => {
    const { dispatchSpy, getByRole } = renderWelcome();
    fireEvent.click(getByRole("button"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: ReduxConstants.RESET_COOKIE_DELETED_COUNTER,
    });
  });

  it("renders without console errors", () => {
    renderWelcome();
    expect(console.error).not.toHaveBeenCalled();
  });
});
