/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ReduxConstants } from "@/typings/redux-constants";
import {
  FilterOptions,
  OpenTabStatus,
  ReasonClean,
  SiteDataType,
} from "@/typings/enums";
import fontAwesomeImports from "@/ui/font-awesome-imports";
import ActivityTable from "@/ui/common-components/ActivityTable";

// Register the FontAwesome icons the entrypoints normally provide.
fontAwesomeImports();

const makeCookie = (
  hostname: string,
  name: string,
  overrides: Partial<CookiePropertiesCleanup> = {}
): CookiePropertiesCleanup => ({
  domain: hostname,
  expirationDate: 9999999999,
  hostOnly: false,
  hostname,
  httpOnly: false,
  mainDomain: hostname,
  name,
  path: "/",
  preparedCookieDomain: `https://${hostname}/`,
  sameSite: "no_restriction",
  secure: true,
  session: false,
  storeId: "default",
  value: "value",
  ...overrides,
});

const makeCleanReason = (
  cookie: CookiePropertiesCleanup
): CleanReasonObject => ({
  cached: false,
  cleanCookie: true,
  cookie,
  openTabStatus: OpenTabStatus.TabsWasNotIgnored,
  reason: ReasonClean.NoMatchedExpression,
});

const makeLog = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
  dateTime: "2026-01-15T12:30:45.000Z",
  recentlyCleaned: 2,
  siteDataCleaned: false,
  storeIds: {
    default: [
      makeCleanReason(makeCookie("example.com", "cookieA")),
      makeCleanReason(makeCookie("example.com", "cookieB")),
    ],
  },
  browsingDataCleanup: { [SiteDataType.LOCALSTORAGE]: ["example.org"] },
  ...overrides,
});

describe("ActivityTable", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  const renderTable = (
    stateOverrides: Partial<State> = {},
    ownProps: { numberToShow?: number } = {}
  ) => {
    const state: State = { ...initialState, ...stateOverrides };
    const reducer = jest.fn<State, [State | undefined, any]>(() => state);
    const store = createStore(reducer);
    const view = render(
      <Provider store={store}>
        <ActivityTable decisionFilter={FilterOptions.NONE} {...ownProps} />
      </Provider>
    );
    const dispatchedActions = () =>
      reducer.mock.calls.map(([, action]) => action);
    return { ...view, dispatchedActions };
  };

  it("renders an informational alert when the activity log is empty", () => {
    const { getByRole } = renderTable();
    const alert = getByRole("alert");
    expect(alert.className).toBe("alert alert-primary");
    expect(alert.textContent).toContain("noCleanupLogText");
    expect(alert.textContent).toContain("noPrivateLogging");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("renders one card per entry, capped by numberToShow", () => {
    const logs = [makeLog(), makeLog({ dateTime: "2026-01-16T08:00:00.000Z" })];
    const capped = renderTable({ activityLog: logs }, { numberToShow: 1 });
    expect(capped.container.querySelectorAll(".card")).toHaveLength(1);

    const uncapped = renderTable({ activityLog: logs });
    expect(uncapped.container.querySelectorAll(".card")).toHaveLength(2);
  });

  it("renders the card header with restore/remove buttons and a summary toggle", () => {
    const { container, getByTitle } = renderTable({
      activityLog: [makeLog()],
    });
    getByTitle("restoreText");
    getByTitle("removeActivityLogEntryText");
    const toggle = container.querySelector(
      "button.btn-link"
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("data-toggle")).toBe("collapse");
    expect(toggle.getAttribute("data-target")).toBe("#collapse0");
    expect(toggle.getAttribute("aria-controls")).toBe("collapse0");
    expect(toggle.textContent).toContain("notificationContent");
    expect(toggle.textContent!.endsWith("...")).toBe(true);
    // The summary counts unique domains across cookies and site data.
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "notificationContent",
      ["2", "2", "example.com, example.org"]
    );
    expect(container.querySelector("#heading0")).not.toBeNull();
    expect(container.querySelector("#collapse0")).not.toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("hides the restore button when nothing was recently cleaned", () => {
    const { queryByTitle } = renderTable({
      activityLog: [makeLog({ recentlyCleaned: 0 })],
    });
    expect(queryByTitle("restoreText")).toBeNull();
  });

  it("groups the cleaned cookies by domain in the detailed summary", () => {
    const { container } = renderTable({ activityLog: [makeLog()] });
    const dangers = container.querySelectorAll(".alert.alert-danger");
    expect(dangers).toHaveLength(1);
    expect(dangers[0].textContent).toBe(
      "example.com (cookieA, cookieB): reasonCleanNoList"
    );
  });

  it("renders a site-data alert only for entries that still have domains", () => {
    const { container } = renderTable({
      activityLog: [
        makeLog({
          browsingDataCleanup: {
            [SiteDataType.LOCALSTORAGE]: ["example.org"],
            [SiteDataType.CACHE]: [],
            [SiteDataType.INDEXEDDB]: undefined,
          },
        }),
      ],
    });
    const infos = container.querySelectorAll(".alert.alert-info");
    expect(infos).toHaveLength(1);
    expect(infos[0].textContent).toBe("activityLogSiteDataDomainsText");
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "activityLogSiteDataDomainsText",
      ["localStorageText", "example.org"]
    );
  });

  it("renders an entry without browsingDataCleanup data", () => {
    const { container } = renderTable({
      activityLog: [makeLog({ browsingDataCleanup: undefined })],
    });
    expect(container.querySelectorAll(".card")).toHaveLength(1);
    expect(container.querySelectorAll(".alert.alert-info")).toHaveLength(0);
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "notificationContent",
      ["2", "1", "example.com"]
    );
  });

  it("shows per-container headings only when multiple cookie stores exist", () => {
    const multi = renderTable({
      activityLog: [
        makeLog({
          browsingDataCleanup: undefined,
          storeIds: {
            default: [makeCleanReason(makeCookie("example.com", "cookieA"))],
            "container-1": [
              makeCleanReason(makeCookie("example.org", "cookieC")),
            ],
          },
        }),
      ],
      cache: { "container-1": "Personal" },
    });
    const headings = Array.from(multi.container.querySelectorAll("h6")).map(
      (h) => h.textContent
    );
    expect(headings).toEqual(["(default)", "Personal (container-1)"]);

    const single = renderTable({ activityLog: [makeLog()] });
    expect(single.container.querySelectorAll("h6")).toHaveLength(0);
  });

  it("dispatches the remove action for the entry when trash is clicked", () => {
    const log = makeLog();
    const { getByTitle, dispatchedActions } = renderTable({
      activityLog: [log],
    });
    fireEvent.click(getByTitle("removeActivityLogEntryText"));
    expect(dispatchedActions()).toContainEqual({
      payload: log,
      type: ReduxConstants.REMOVE_ACTIVITY_LOG,
    });
  });

  it("restores the cookies then removes the entry when restore is clicked", async () => {
    const log = makeLog({
      storeIds: {
        default: [
          makeCleanReason(makeCookie("example.com", "cookieA")),
          makeCleanReason(
            makeCookie("example.com", "cookieB", { hostOnly: true })
          ),
        ],
      },
    });
    const { getByTitle, dispatchedActions } = renderTable({
      activityLog: [log],
    });
    fireEvent.click(getByTitle("restoreText"));
    await waitFor(() => {
      expect(dispatchedActions()).toContainEqual({
        payload: log,
        type: ReduxConstants.REMOVE_ACTIVITY_LOG,
      });
    });
    expect(global.browser.cookies.set).toHaveBeenCalledTimes(2);
    expect(global.browser.cookies.set).toHaveBeenCalledWith({
      domain: "example.com",
      expirationDate: 9999999999,
      httpOnly: false,
      name: "cookieA",
      sameSite: "no_restriction",
      secure: true,
      storeId: "default",
      url: "https://example.com/",
      value: "value",
    });
    // Host-only cookies are restored without an explicit domain.
    expect(global.browser.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cookieB", domain: undefined })
    );
  });

  it("skips file: and domain-less cookies during restore", async () => {
    const log = makeLog({
      storeIds: {
        default: [
          makeCleanReason(
            makeCookie("local", "fileCookie", {
              preparedCookieDomain: "file:///home/user/index.html",
            })
          ),
          makeCleanReason(
            makeCookie("nowhere", "emptyCookie", { preparedCookieDomain: "" })
          ),
          makeCleanReason(makeCookie("example.com", "cookieA")),
        ],
      },
    });
    const { getByTitle, dispatchedActions } = renderTable({
      activityLog: [log],
    });
    fireEvent.click(getByTitle("restoreText"));
    await waitFor(() => {
      expect(dispatchedActions()).toContainEqual({
        payload: log,
        type: ReduxConstants.REMOVE_ACTIVITY_LOG,
      });
    });
    expect(global.browser.cookies.set).toHaveBeenCalledTimes(1);
    expect(global.browser.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cookieA" })
    );
  });
});
