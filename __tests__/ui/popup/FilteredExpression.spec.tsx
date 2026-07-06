/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType } from "@/typings/enums";
import FilteredExpression from "@/ui/popup/components/FilteredExpression";

const whiteExpression: Expression = {
  expression: "example.com",
  id: "exp-1",
  listType: ListType.WHITE,
  storeId: "default",
};

const greyExpression: Expression = {
  expression: "*.example.org",
  id: "exp-2",
  listType: ListType.GREY,
  storeId: "default",
};

describe("FilteredExpression", () => {
  const renderFiltered = (
    lists: StoreIdToExpressionList,
    url: string,
    storeId = "default"
  ) =>
    render(
      <Provider store={createStore(() => ({ ...initialState, lists }))}>
        <FilteredExpression url={url} storeId={storeId} />
      </Provider>
    );

  const expressionValues = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("textarea")).map(
      (textarea) => textarea.value
    );

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("shows the noRulesText fallback when the store has no expressions", () => {
    const { getByRole, container } = renderFiltered({}, "example.com");
    const alert = getByRole("alert");
    expect(alert.classList.contains("alert-info")).toBe(true);
    expect(alert.textContent).toBe("noRulesText");
    expect(container.querySelector("table")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows the fallback when no expression matches the current domain", () => {
    const { getByRole } = renderFiltered(
      { default: [whiteExpression, greyExpression] },
      "unrelated.net"
    );
    expect(getByRole("alert").textContent).toBe("noRulesText");
  });

  it("shows the fallback when the expressions live in another store", () => {
    const { getByRole } = renderFiltered(
      { default: [whiteExpression] },
      "example.com",
      "work-container"
    );
    expect(getByRole("alert").textContent).toBe("noRulesText");
  });

  it("renders only the expressions matching the domain", () => {
    const { container, getByText } = renderFiltered(
      { default: [whiteExpression, greyExpression] },
      "example.com"
    );
    expect(expressionValues(container)).toEqual(["example.com"]);
    expect(getByText("matchedDomainExpressionText")).toBeTruthy();
    expect(getByText("whiteListWordText")).toBeTruthy();
  });

  it("matches subdomains against wildcard expressions", () => {
    const { container, getByText } = renderFiltered(
      { default: [whiteExpression, greyExpression] },
      "sub.example.org"
    );
    expect(expressionValues(container)).toEqual(["*.example.org"]);
    expect(getByText("greyListWordText")).toBeTruthy();
  });

  it("lists every expression of the store when the url is empty", () => {
    const { container } = renderFiltered(
      { default: [whiteExpression, greyExpression] },
      ""
    );
    expect(expressionValues(container)).toEqual([
      "example.com",
      "*.example.org",
    ]);
  });
});
