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

  it("has no documentation, FAQ, or earlier-releases links (About owns the links)", () => {
    const { container, queryByText } = renderWelcome();
    expect(queryByText("documentationText")).toBeNull();
    expect(queryByText("faqText")).toBeNull();
    expect(queryByText("oldReleasesText")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders the release notes section with the initial release note", () => {
    const { container, getByText } = renderWelcome();
    expect((container.querySelector("h2") as HTMLElement).textContent).toBe(
      "releaseNotesText"
    );
    expect(getByText("1.0.0")).not.toBeNull();
    expect(
      getByText("Initial release of Auto-Delete Cookies for Privacy.")
    ).not.toBeNull();
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
