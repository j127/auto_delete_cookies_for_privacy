/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "../../../src/redux/state";
import { ListType } from "../../../src/typings/enums";
import { ReduxConstants } from "../../../src/typings/redux-constants";
import fontAwesomeImports from "../../../src/ui/font-awesome-imports";
import Expressions from "../../../src/ui/settings/components/Expressions";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

const sampleLists: StoreIdToExpressionList = {
  default: [
    {
      expression: "example.com",
      id: "1",
      listType: ListType.WHITE,
      storeId: "default",
    },
    {
      expression: "*.example.org",
      id: "2",
      listType: ListType.GREY,
      storeId: "default",
    },
  ],
};

describe("Expressions", () => {
  const renderExpressions = (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const rendered = render(
      <Provider store={store}>
        <Expressions />
      </Provider>
    );
    const input = rendered.container.querySelector(
      "#formText"
    ) as HTMLInputElement;
    return { dispatchSpy, input, ...rendered };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the heading, the add input and the empty list message", () => {
    const { container, getByText, input } = renderExpressions();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "expressionListText"
    );
    expect(input.getAttribute("placeholder")).toBe("domainPlaceholderText");
    expect(getByText("noExpressionsText")).not.toBeNull();
  });

  it("renders the expressions help link with the tooltip as its sibling, not child", () => {
    const { getByText } = renderExpressions();
    const helpLink = getByText("questionExpression") as HTMLAnchorElement;
    expect(helpLink.tagName).toBe("A");
    expect(helpLink.getAttribute("href")).toBe(
      "https://github.com/j127/autodelete_cookies_for_privacy/blob/main/documentation/src/expressions.md"
    );
    // Regression guard (PR #91): the tooltip anchor must not be nested
    // inside the help link.
    expect(helpLink.querySelector("a")).toBeNull();
    const tooltip = helpLink.nextElementSibling as HTMLAnchorElement;
    expect(tooltip.tagName).toBe("A");
    expect(tooltip.classList.contains("tooltipCustom")).toBe(true);
  });

  it("adds a whitelist expression when Enter is pressed in the input", () => {
    const { container, dispatchSpy, input } = renderExpressions();
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyUp(input, { key: "Enter" });

    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "example.com",
        listType: ListType.WHITE,
        storeId: "default",
      },
      type: ReduxConstants.ADD_EXPRESSION,
    });
    // The input is cleared and a success alert is shown.
    expect(input.value).toBe("");
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toContain("inputAddSuccess");
  });

  it("adds a greylist expression when Shift+Enter is pressed in the input", () => {
    const { dispatchSpy, input } = renderExpressions();
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyUp(input, { key: "Enter", shiftKey: true });

    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "example.com",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: ReduxConstants.ADD_EXPRESSION,
    });
  });

  it("adds to the greylist through the grey plus button", () => {
    const { dispatchSpy, getByText, input } = renderExpressions();
    fireEvent.change(input, { target: { value: "example.net" } });
    fireEvent.click(getByText("greyListWordText"));

    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "example.net",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: ReduxConstants.ADD_EXPRESSION,
    });
  });

  it("rejects invalid expressions with an error alert and no dispatch", () => {
    const { container, dispatchSpy, input } = renderExpressions();
    fireEvent.change(input, { target: { value: "bad domain" } });
    fireEvent.keyUp(input, { key: "Enter" });

    expect(dispatchSpy).not.toHaveBeenCalled();
    const error = container.querySelector(".alert-danger") as HTMLElement;
    expect(error.textContent).toContain("invalidNewExpressions");
    expect(error.textContent).toContain("bad domain -> inputErrorSpace");
    // The invalid value stays in the input for correction.
    expect(input.value).toBe("bad domain");
  });

  it("renders a table row per stored expression with its list type", () => {
    const { container } = renderExpressions({ lists: sampleLists });
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(
      (rows[0].querySelector("textarea") as HTMLTextAreaElement).value
    ).toBe("example.com");
    expect(rows[0].textContent).toContain("whiteListWordText");
    expect(
      (rows[1].querySelector("textarea") as HTMLTextAreaElement).value
    ).toBe("*.example.org");
    expect(rows[1].textContent).toContain("greyListWordText");
  });

  it("shows an error when removing all expressions while none exist", () => {
    const { container, dispatchSpy, getByText } = renderExpressions();
    fireEvent.click(getByText("removeAllExpressions"));

    expect(dispatchSpy).not.toHaveBeenCalled();
    const error = container.querySelector(".alert-danger") as HTMLElement;
    expect(error.textContent).toBe("removeAllExpressionsNoneFound");
  });

  it("renders without console errors when the list is empty", () => {
    renderExpressions();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("renders without console errors when expression rows are shown", () => {
    renderExpressions({ lists: sampleLists });
    expect(console.error).not.toHaveBeenCalled();
  });
});
