/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import Expressions from "@/ui/settings/components/Expressions";

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
      "savedSitesText"
    );
    expect(input.getAttribute("placeholder")).toBe("domainPlaceholderText");
    expect(getByText("noExpressionsText")).not.toBeNull();
  });

  it("explains pattern syntax in a self-contained collapsed accordion", () => {
    const { container, getByText, queryByText } = renderExpressions();
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(
      (details.querySelector("summary") as HTMLElement).textContent
    ).toContain("questionExpression");
    // The syntax table covers all six pattern forms.
    expect(getByText("*.example.com")).not.toBeNull();
    expect(getByText("192.168.1.0/24")).not.toBeNull();
    expect(getByText("/^mail\\.example\\.com$/")).not.toBeNull();
    expect(getByText("file:///home/user/")).not.toBeNull();
    expect(getByText("patternKeepLevelsText")).not.toBeNull();
    // No external documentation link and no tooltip (#171/#179): the
    // in-app Help page owns the full guide.
    expect(queryByText("documentationText")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll(".tooltip")).toHaveLength(0);
  });

  it("arranges the card as add bar, accordion, table area, footer actions", () => {
    const { container, getByText, queryByText } = renderExpressions();
    const card = container.querySelector(".rounded-box") as HTMLElement;
    const children = Array.from(card.children);
    expect(children[0].querySelector("#formText")).not.toBeNull();
    expect(children[1].tagName).toBe("DETAILS");
    expect(children[2].textContent).toContain("noExpressionsText");
    const footer = children[3] as HTMLElement;
    ["createDefaultExpressionOptionsText", "removeAllExpressions"].forEach(
      (key) => expect(footer.textContent).toContain(key)
    );
    // Export/import moved to the Import / Export page.
    expect(queryByText("exportURLSText")).toBeNull();
    expect(queryByText("importURLSText")).toBeNull();
    // Remove All is error-styled and pushed to the far end.
    const removeAll = getByText("removeAllExpressions").closest(
      "button"
    ) as HTMLButtonElement;
    expect(removeAll.className).toContain("btn-error");
    expect(removeAll.className).toContain("ms-auto");
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
    fireEvent.click(getByText("keepSessionButtonText"));

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
    const error = container.querySelector(".alert-error") as HTMLElement;
    expect(error.textContent).toContain("invalidNewExpressions");
    expect(error.textContent).toContain("bad domain -> inputErrorSpace");
    // The invalid value stays in the input for correction.
    expect(input.value).toBe("bad domain");
  });

  it("renders a table row per stored expression with its list type", () => {
    const { container } = renderExpressions({ lists: sampleLists });
    // The syntax-help table renders too, so scope to the expression table.
    const rows = container.querySelectorAll("tbody.expressionTable tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("example.com");
    expect(rows[0].textContent).toContain("keptBadgeText");
    expect(rows[1].textContent).toContain("*.example.org");
    expect(rows[1].textContent).toContain("sessionBadgeText");
  });

  it("shows an error when removing all expressions while none exist", () => {
    const { container, dispatchSpy, getByText } = renderExpressions();
    fireEvent.click(getByText("removeAllExpressions"));

    expect(dispatchSpy).not.toHaveBeenCalled();
    const error = container.querySelector(".alert-error") as HTMLElement;
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
