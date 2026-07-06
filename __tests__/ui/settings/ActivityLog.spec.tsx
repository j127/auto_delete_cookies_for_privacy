/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { OpenTabStatus, ReasonClean } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import fontAwesomeImports from "@/ui/font-awesome-imports";
import ActivityLog from "@/ui/settings/components/ActivityLog";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

const mockCookie: CookiePropertiesCleanup = {
  domain: "example.com",
  hostOnly: true,
  hostname: "example.com",
  httpOnly: false,
  mainDomain: "example.com",
  name: "sessionid",
  path: "/",
  preparedCookieDomain: "https://example.com/",
  sameSite: "no_restriction",
  secure: true,
  session: true,
  storeId: "0",
  value: "value",
};

const makeLog = (
  dateTime: string,
  hostname: string,
  cookieName: string,
  recentlyCleaned = 1
): ActivityLog => ({
  dateTime,
  recentlyCleaned,
  siteDataCleaned: false,
  storeIds: {
    default: [
      {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
          domain: hostname,
          hostname,
          mainDomain: hostname,
          name: cookieName,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      },
    ],
  },
});

describe("ActivityLog", () => {
  const renderActivityLog = (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    return {
      dispatchSpy,
      ...render(
        <Provider store={store}>
          <ActivityLog />
        </Provider>
      ),
    };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the cleanup log heading and the clear logs button", () => {
    const { container, getByText } = renderActivityLog();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "cleanupLogText"
    );
    expect(getByText("clearLogsText")).not.toBeNull();
  });

  it("shows the empty log notice when there are no activity entries", () => {
    const { container } = renderActivityLog();
    const notice = container.querySelector(".alert-info") as HTMLElement;
    expect(notice.textContent).toContain("noCleanupLogText");
    expect(notice.textContent).toContain("noPrivateLogging");
  });

  it("dispatches CLEAR_ACTIVITY_LOG when the clear logs button is clicked", () => {
    const { dispatchSpy, getByText } = renderActivityLog();
    fireEvent.click(getByText("clearLogsText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: ReduxConstants.CLEAR_ACTIVITY_LOG,
    });
  });

  it("renders a collapsible entry per log with the notification summary", () => {
    const logA = makeLog("2026-01-10T08:00:00", "example.com", "sessionid");
    const logB = makeLog("2026-01-11T09:30:00", "sub.example.org", "tracker");
    const { container } = renderActivityLog({ activityLog: [logA, logB] });

    // Entries are native details/summary pairs since the #40 rebuild.
    const entries = container.querySelectorAll("details");
    expect(entries).toHaveLength(2);
    const summary = entries[0].querySelector("summary") as HTMLElement;
    expect(summary.textContent).toContain("notificationContent");
  });

  it("lists the cleaned domain, cookie name and reason in the entry details", () => {
    const log = makeLog("2026-01-10T08:00:00", "example.com", "sessionid");
    const { container } = renderActivityLog({ activityLog: [log] });

    const detail = container.querySelector(
      ".collapse-content .alert-error"
    ) as HTMLElement;
    expect(detail.textContent).toBe(
      "example.com (sessionid): reasonCleanNoList"
    );
  });

  it("only offers cookie restore for entries that cleaned cookies", () => {
    const cleaned = makeLog("2026-01-10T08:00:00", "example.com", "sessionid");
    const { container: withRestore } = renderActivityLog({
      activityLog: [cleaned],
    });
    expect(withRestore.querySelector('[title="restoreText"]')).not.toBeNull();

    const nothingCleaned = makeLog(
      "2026-01-10T08:00:00",
      "example.com",
      "sessionid",
      0
    );
    const { container: withoutRestore } = renderActivityLog({
      activityLog: [nothingCleaned],
    });
    expect(withoutRestore.querySelector('[title="restoreText"]')).toBeNull();
  });

  it("dispatches REMOVE_ACTIVITY_LOG with the entry when its trash button is clicked", () => {
    const log = makeLog("2026-01-10T08:00:00", "example.com", "sessionid");
    const { container, dispatchSpy } = renderActivityLog({
      activityLog: [log],
    });

    fireEvent.click(
      container.querySelector(
        '[title="removeActivityLogEntryText"]'
      ) as HTMLElement
    );
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: log,
      type: ReduxConstants.REMOVE_ACTIVITY_LOG,
    });
  });

  it("renders without console errors", () => {
    renderActivityLog({
      activityLog: [makeLog("2026-01-10T08:00:00", "example.com", "sessionid")],
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});
