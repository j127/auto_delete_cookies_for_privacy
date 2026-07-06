/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType } from "@/typings/enums";
import AdvancedControls from "@/ui/popup/components/AdvancedControls";

const matchedExpression: Expression = {
  expression: "*.example.com",
  id: "exp-1",
  listType: ListType.WHITE,
  storeId: "default",
};

describe("AdvancedControls", () => {
  const renderControls = (matched?: Expression) => {
    const store = createStore(() => initialState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <AdvancedControls
          addableHostnames={["*.example.com", "sub.example.com"]}
          matched={matched}
          storeId="default"
        />
      </Provider>
    );
    return { ...utils, dispatchSpy };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
  });

  it("says when no rule matches", () => {
    const { getByText } = renderControls();
    expect(getByText("noRuleMatchText")).toBeTruthy();
  });

  it("names the matched rule", () => {
    const { getByText } = renderControls(matchedExpression);
    expect(getByText("matchedRuleText[*.example.com]")).toBeTruthy();
  });

  it("renders one row per addable expression in session-then-keep order", () => {
    const { getAllByText } = renderControls();
    expect(getAllByText("keepSessionButtonText")).toHaveLength(2);
    expect(getAllByText("keepButtonText")).toHaveLength(2);
    const row = getAllByText("keepSessionButtonText")[0]
      .parentElement as HTMLElement;
    expect(
      Array.from(row.querySelectorAll("button")).map((b) => b.textContent)
    ).toEqual(["keepSessionButtonText", "keepButtonText"]);
  });

  it("dispatches the list additions for the clicked expression", () => {
    const { dispatchSpy, getAllByText } = renderControls();
    fireEvent.click(getAllByText("keepSessionButtonText")[1]);
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "sub.example.com",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
    fireEvent.click(getAllByText("keepButtonText")[0]);
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "*.example.com",
        listType: ListType.WHITE,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
  });

  it("explains both actions in tooltips", () => {
    const { getAllByText } = renderControls();
    expect(getAllByText("keepSessionButtonText")[0].getAttribute("title")).toBe(
      "keepSessionButtonTooltipText"
    );
    expect(getAllByText("keepButtonText")[0].getAttribute("title")).toBe(
      "keepButtonTooltipText"
    );
  });
});
