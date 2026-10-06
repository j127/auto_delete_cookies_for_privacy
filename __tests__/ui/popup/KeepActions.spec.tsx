/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType } from "@/typings/enums";
import KeepActions from "@/ui/popup/components/KeepActions";

const matchedExpression: Expression = {
  expression: "*.example.com",
  id: "exp-1",
  listType: ListType.WHITE,
  storeId: "default",
};

describe("KeepActions", () => {
  const renderActions = (matched?: Expression, keepStaysSaved?: boolean) => {
    const store = createStore(() => initialState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <KeepActions
          domain="example.com"
          keepExpression="*.example.com"
          keepStaysSaved={keepStaysSaved}
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

  it("whitelists the keep expression from the primary action", () => {
    const { dispatchSpy, getByText } = renderActions();
    expect(getByText("keepCookiesCaptionText[example.com]")).toBeTruthy();
    fireEvent.click(getByText("keepCookiesButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "*.example.com",
        listType: ListType.WHITE,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
  });

  it("greylists the keep expression from the session action", () => {
    const { dispatchSpy, getByText } = renderActions();
    fireEvent.click(getByText("keepUntilCloseButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "*.example.com",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
  });

  it("dispatches the default cleanup and flashes the block from Clean now", () => {
    const { dispatchSpy, getByText } = renderActions();
    fireEvent.click(getByText("cleanNowText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { greyCleanup: false, ignoreOpenTabs: false },
      type: "COOKIE_CLEANUP",
    });
    const block = document.getElementById("popupActions") as HTMLElement;
    expect(block.classList.contains("successAnimated")).toBe(true);
  });

  it("swaps the keep actions for a remove action when a rule matches", () => {
    const { dispatchSpy, getByText, queryByText } =
      renderActions(matchedExpression);
    expect(queryByText("keepCookiesButtonText")).toBeNull();
    expect(queryByText("keepUntilCloseButtonText")).toBeNull();
    fireEvent.click(getByText("stopKeepingButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: matchedExpression,
      type: "REMOVE_EXPRESSION",
    });
  });

  it("says a keep rule stays saved only when asked to (#468)", () => {
    const note = () => document.getElementById("keepStaysSavedNote");
    const first = renderActions();
    expect(note()).toBeNull();
    first.unmount();
    renderActions(undefined, true);
    expect(note()?.textContent).toBe("keepRuleStaysSavedText");
  });

  it("keeps the stays-saved note next to a matched rule's remove action", () => {
    renderActions(matchedExpression, true);
    expect(document.getElementById("keepStaysSavedNote")?.textContent).toBe(
      "keepRuleStaysSavedText"
    );
  });
});
