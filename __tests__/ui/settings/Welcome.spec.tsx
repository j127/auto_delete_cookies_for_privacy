/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ReduxConstants } from "@/typings/redux-constants";
import Welcome from "@/ui/settings/components/Welcome";

const FORK_BASE = "https://github.com/j127/auto_delete_cookies_for_privacy";

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

  it("renders the overview heading", () => {
    const { container } = renderWelcome();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "overviewText"
    );
  });

  it("shows the session and total counters as stat cards", () => {
    renderWelcome({
      cookieDeletedCounterSession: 5,
      cookieDeletedCounterTotal: 42,
    });
    expect(document.getElementById("statSession")?.textContent).toBe("5");
    expect(document.getElementById("statTotal")?.textContent).toBe("42");
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
    expect(getByText("1.0.0")).not.toBeNull();
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
