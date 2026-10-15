/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ReduxConstants } from "@/typings/redux-constants";
import { ListType, SiteDataType } from "@/typings/enums";
import ExpressionOptions from "@/ui/common-components/ExpressionOptions";

const baseExpression: Expression = {
  expression: "example.com",
  id: "exp1",
  listType: ListType.WHITE,
  storeId: "default",
};

const siteDataKeepKeys = [
  "keepCacheText",
  "keepIndexedDBText",
  "keepLocalStorageText",
  "keepPluginDataText",
  "keepServiceWorkersText",
];

describe("ExpressionOptions", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.cookies.getAll.mockResolvedValue([]);
  });

  const renderOptions = (expression: Expression) => {
    const reducer = jest.fn<(state: State | undefined, action: any) => State>(
      () => initialState
    );
    const store = createStore(reducer);
    const view = render(
      <Provider store={store}>
        <ExpressionOptions expression={expression} />
      </Provider>
    );
    const dispatchedActions = () =>
      reducer.mock.calls.map(([, action]) => action);
    return { ...view, dispatchedActions };
  };

  // Real checkbox inputs since #40; checked state lives on the element.
  const isChecked = (container: HTMLElement, id: string) =>
    (container.querySelector(`[id="${id}"]`) as HTMLInputElement).checked;

  it("renders a keep checkbox per site-data type plus keep-all-cookies", () => {
    const { getByText } = renderOptions(baseExpression);
    siteDataKeepKeys.forEach((key) => getByText(key));
    getByText("keepAllCookiesText");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("uses the grey-list wording for greylisted expressions", () => {
    const { getByText } = renderOptions({
      ...baseExpression,
      listType: ListType.GREY,
    });
    siteDataKeepKeys.forEach((key) => getByText(`${key.slice(0, -4)}GreyText`));
    getByText("keepAllCookiesGreyText");
  });

  it("shows site-data types listed in cleanSiteData as unchecked keeps", () => {
    const { container } = renderOptions({
      ...baseExpression,
      cleanSiteData: [SiteDataType.CACHE],
    });
    // The keep-checkbox is inverted: a cleaned type renders unchecked.
    expect(isChecked(container, "exp1-cleanCache")).toBe(false);
    expect(isChecked(container, "exp1-cleanIndexedDB")).toBe(true);
    expect(isChecked(container, "exp1-cleanLocalStorage")).toBe(true);
  });

  it("hides the site-data checkboxes for file: expressions", () => {
    const { getByText, queryByText } = renderOptions({
      ...baseExpression,
      expression: "file:///home/user/",
    });
    getByText("keepAllCookiesText");
    siteDataKeepKeys.forEach((key) => {
      expect(queryByText(key)).toBeNull();
    });
  });

  it("toggling a site-data keep checkbox dispatches the updated expression", () => {
    const addRender = renderOptions(baseExpression);
    fireEvent.click(addRender.getByText("keepCacheText"));
    expect(addRender.dispatchedActions()).toContainEqual({
      payload: { ...baseExpression, cleanSiteData: [SiteDataType.CACHE] },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
    addRender.unmount();

    const removeRender = renderOptions({
      ...baseExpression,
      cleanSiteData: [SiteDataType.CACHE],
    });
    fireEvent.click(removeRender.getByText("keepCacheText"));
    expect(removeRender.dispatchedActions()).toContainEqual({
      payload: { ...baseExpression, cleanSiteData: [] },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
  });

  it("unchecking keep-all-cookies dispatches cleanAllCookies=false and fetches cookies", async () => {
    const { getByText, dispatchedActions } = renderOptions(baseExpression);
    fireEvent.click(getByText("keepAllCookiesText"));
    expect(dispatchedActions()).toContainEqual({
      payload: { ...baseExpression, cleanAllCookies: false },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
    await waitFor(() => {
      // "default" is translated to the raw Chrome store id "0";
      // partitionKey: {} keeps TCP/CHIPS partitioned cookies visible in
      // the name list (#317).
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        domain: "example.com",
        partitionKey: {},
        storeId: "0",
      });
    });
  });

  it("maps a private-list expression to the raw incognito store id", async () => {
    const { getByText } = renderOptions({
      ...baseExpression,
      storeId: "private",
    });
    fireEvent.click(getByText("keepAllCookiesText"));
    await waitFor(() => {
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        domain: "example.com",
        partitionKey: {},
        storeId: "1",
      });
    });
  });

  it("keep-all-cookies mirrors cleanAllCookies (undefined counts as kept)", () => {
    const keptRender = renderOptions(baseExpression);
    expect(isChecked(keptRender.container, "exp1-cleanAllCookies")).toBe(true);

    const dropRender = renderOptions({
      ...baseExpression,
      cleanAllCookies: false,
    });
    expect(isChecked(dropRender.container, "exp1-cleanAllCookies")).toBe(false);
  });

  it("lists kept and browser cookie names when cleanAllCookies is false", async () => {
    global.browser.cookies.getAll.mockResolvedValue([
      { domain: "example.com", name: "sessionid", path: "/", storeId: "0" },
    ]);
    const expression: Expression = {
      ...baseExpression,
      cleanAllCookies: false,
      cookieNames: ["keepme"],
    };
    const { findByText, getByText, container, dispatchedActions } =
      renderOptions(expression);
    await findByText("sessionid");
    getByText("keepme");
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
      domain: "example.com",
      partitionKey: {},
      storeId: "0",
    });
    expect(isChecked(container, "true-exp1-keepme")).toBe(true);
    expect(isChecked(container, "false-exp1-sessionid")).toBe(false);

    fireEvent.click(getByText("sessionid"));
    expect(dispatchedActions()).toContainEqual({
      payload: { ...expression, cookieNames: ["keepme", "sessionid"] },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });

    fireEvent.click(getByText("keepme"));
    expect(dispatchedActions()).toContainEqual({
      payload: { ...expression, cookieNames: [] },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
  });
});

// Cleanup keeps a cookie partitioned under ANOTHER site only while a rule
// also keeps that site (#511), so the editor lists only the cookie names a
// rule can keep.
describe("ExpressionOptions partitioned cookies", () => {
  const youtube: Expression = {
    expression: "youtube.com",
    id: "yt",
    listType: ListType.WHITE,
    storeId: "default",
  };
  const lenovo: Expression = {
    expression: "lenovo.com",
    id: "lv",
    listType: ListType.WHITE,
    storeId: "default",
  };

  const cookie = (
    name: string,
    partitionTopLevelSite?: string
  ): browser.cookies.Cookie =>
    ({
      domain: ".youtube.com",
      hostOnly: false,
      httpOnly: false,
      name,
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "0",
      value: "v",
      ...(partitionTopLevelSite && {
        partitionKey: { topLevelSite: partitionTopLevelSite },
      }),
    }) as browser.cookies.Cookie;

  const renderWithRules = (expression: Expression, rules: Expression[]) => {
    const state: State = { ...initialState, lists: { default: rules } };
    return render(
      <Provider store={createStore(() => state)}>
        <ExpressionOptions
          expression={{ ...expression, cleanAllCookies: false }}
        />
      </Provider>
    );
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.cookies.getAll.mockResolvedValue([
      cookie("unpartitioned"),
      cookie("ownSite", "https://youtube.com"),
      cookie("underLenovo", "https://lenovo.com"),
    ]);
  });

  it("lists cookies unpartitioned or partitioned under their own site, and hides ones under a site no rule keeps", async () => {
    const { findByText, queryByText } = renderWithRules(youtube, [youtube]);
    await findByText("unpartitioned");
    await findByText("ownSite");
    expect(queryByText("underLenovo")).toBeNull();
  });

  it("lists cookies partitioned under a site another rule keeps", async () => {
    const { findByText } = renderWithRules(youtube, [youtube, lenovo]);
    await findByText("unpartitioned");
    await findByText("ownSite");
    await findByText("underLenovo");
  });

  it("still lists a name the rule already keeps", async () => {
    const { findByText } = renderWithRules(
      { ...youtube, cookieNames: ["underLenovo"] },
      [youtube]
    );
    await findByText("underLenovo");
  });

  it("filters the regex, file: and CIDR branches too", async () => {
    global.browser.cookies.getAll.mockResolvedValue([
      cookie("unpartitioned"),
      cookie("underLenovo", "https://lenovo.com"),
      {
        ...cookie("ipCookie"),
        domain: "192.168.1.5",
      },
      {
        ...cookie("ipUnderLenovo", "https://lenovo.com"),
        domain: "192.168.1.5",
      },
      {
        ...cookie("localFile"),
        domain: "",
        path: "/home/user/a",
      },
    ]);
    const regex = renderWithRules({ ...youtube, expression: "/youtube/" }, [
      { ...youtube, expression: "/youtube/" },
    ]);
    await regex.findByText("unpartitioned");
    expect(regex.queryByText("underLenovo")).toBeNull();
    regex.unmount();

    const cidr = renderWithRules({ ...youtube, expression: "192.168.0.0/16" }, [
      { ...youtube, expression: "192.168.0.0/16" },
    ]);
    await cidr.findByText("ipCookie");
    expect(cidr.queryByText("ipUnderLenovo")).toBeNull();
    cidr.unmount();

    const file = renderWithRules(
      { ...youtube, expression: "file:///home/user/" },
      [{ ...youtube, expression: "file:///home/user/" }]
    );
    await file.findByText("localFile");
  });
});
