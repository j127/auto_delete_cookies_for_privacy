/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 *
 * Firefox-flavored ExpressionOptions specs (#317): the cookie-name list
 * must query raw Firefox store ids (not Chrome's "0"/"1") and must carry
 * both enumeration wrappers, or the list rejects outright / silently
 * omits partitioned cookies.
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType } from "@/typings/enums";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { default: ExpressionOptions } =
  await import("@/ui/common-components/ExpressionOptions");
const libsFirefox = await import("@/services/libs");

const baseExpression: Expression = {
  expression: "example.com",
  id: "exp1",
  listType: ListType.WHITE,
  storeId: "default",
};

const renderOptions = (expression: Expression) => {
  const store = createStore(() => initialState);
  return render(
    <Provider store={store}>
      <ExpressionOptions expression={expression} />
    </Provider>
  );
};

describe("toRawStoreId() on Firefox", () => {
  it("maps the unified keys to raw firefox store ids", () => {
    expect(libsFirefox.toRawStoreId("default")).toEqual("firefox-default");
    expect(libsFirefox.toRawStoreId("private")).toEqual("firefox-private");
  });

  it("passes container keys through (already raw ids)", () => {
    expect(libsFirefox.toRawStoreId("firefox-container-3")).toEqual(
      "firefox-container-3"
    );
  });
});

describe("ExpressionOptions on Firefox", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string) => key as never
    );
    global.browser.cookies.getAll.mockResolvedValue([] as never);
  });

  it("queries the raw firefox-default store with both enumeration wrappers", async () => {
    const { getByText } = renderOptions(baseExpression);
    fireEvent.click(getByText("keepAllCookiesText"));
    await waitFor(() => {
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        domain: "example.com",
        firstPartyDomain: null,
        partitionKey: {},
        storeId: "firefox-default",
      });
    });
  });

  it("queries the raw firefox-private store for private-list expressions", async () => {
    const { getByText } = renderOptions({
      ...baseExpression,
      storeId: "private",
    });
    fireEvent.click(getByText("keepAllCookiesText"));
    await waitFor(() => {
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        domain: "example.com",
        firstPartyDomain: null,
        partitionKey: {},
        storeId: "firefox-private",
      });
    });
  });
});
