/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ReduxConstants } from "@/typings/redux-constants";
import { SettingID } from "@/typings/enums";
import Welcome from "@/ui/settings/components/Welcome";
import ReleaseNotes from "@/ui/settings/release-notes.json";

describe("Welcome", () => {
  const renderWelcome = (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const switchTabs = jest.fn();
    return {
      dispatchSpy,
      switchTabs,
      ...render(
        <Provider store={store}>
          <Welcome switchTabs={switchTabs} />
        </Provider>
      ),
    };
  };

  const withActiveMode = (value: boolean): Partial<State> => ({
    settings: {
      ...initialState.settings,
      [SettingID.ACTIVE_MODE]: { name: SettingID.ACTIVE_MODE, value },
    },
  });

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

  it("has unique versions and unique notes per release, because both serve as React keys", () => {
    const versions = ReleaseNotes.releases.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const release of ReleaseNotes.releases) {
      expect(new Set(release.notes).size).toBe(release.notes.length);
    }
  });

  // The page renders the newest five entries (Welcome.tsx). These two tests
  // read the data rather than naming versions: hardcoded ones meant a new
  // release broke the specs by pushing the oldest entry off the page, which
  // is what 1.0.0 did when 1.2.0 was added. release_check.sh is what ties
  // the newest entry to the version being shipped.
  const RENDERED_RELEASES = 5;

  const versionBadges = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("span.badge")).map(
      (badge) => badge.textContent
    );

  it("renders the release notes section, newest release first", () => {
    const { container, getByText } = renderWelcome();
    const newest = ReleaseNotes.releases[0];
    expect(getByText("releaseNotesText")).not.toBeNull();
    expect(versionBadges(container)[0]).toBe(newest.version);
    for (const note of newest.notes) {
      expect(getByText(note)).not.toBeNull();
    }
  });

  it("dispatches the reset counter action when the reset button is clicked", () => {
    const { dispatchSpy, getByRole } = renderWelcome();
    fireEvent.click(getByRole("button", { name: "resetCookieCounterText" }));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: ReduxConstants.RESET_COOKIE_DELETED_COUNTER,
    });
  });

  it("shows the activation steps while automatic cleaning is off", () => {
    const { getByText } = renderWelcome();
    expect(getByText("setupStepsTitle")).not.toBeNull();
    expect(getByText("setupStepProtectionText")).not.toBeNull();
    expect(getByText("setupStepActiveModeText")).not.toBeNull();
    expect(getByText("setupStepPinText")).not.toBeNull();
  });

  it("jumps to the Protection tab from the activation card button", () => {
    const { getByRole, switchTabs } = renderWelcome();
    fireEvent.click(getByRole("button", { name: "setupOpenProtectionText" }));
    expect(switchTabs).toHaveBeenCalledWith("tabSettings");
  });

  it("hides the activation steps once automatic cleaning is on", () => {
    const { queryByText } = renderWelcome(withActiveMode(true));
    expect(queryByText("setupStepsTitle")).toBeNull();
    expect(document.getElementById("setupSteps")).toBeNull();
  });

  it("renders without console errors", () => {
    renderWelcome();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("lists the newest five releases and stops there", () => {
    const { container, getByText, queryByText } = renderWelcome();
    const shown = ReleaseNotes.releases.slice(0, RENDERED_RELEASES);
    expect(versionBadges(container)).toEqual(shown.map((r) => r.version));
    // Older releases are listed as well, not just the newest one.
    const oldestShown = shown[shown.length - 1];
    expect(getByText(oldestShown.notes[0])).not.toBeNull();
    const dropped = ReleaseNotes.releases[RENDERED_RELEASES];
    if (dropped) {
      expect(queryByText(dropped.version)).toBeNull();
      expect(queryByText(dropped.notes[0])).toBeNull();
    }
  });
});
