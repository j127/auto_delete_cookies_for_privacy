/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ReduxConstants } from "@/typings/redux-constants";
import ErrorBoundary from "@/ui/common-components/ErrorBoundary";

const Bomb: React.FunctionComponent = () => {
  throw new Error("boom");
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    // componentDidCatch logs through adcpLog, which reads the manifest version.
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
  });

  const renderBoundary = (
    children: React.ReactNode,
    state: State = initialState
  ) => {
    const reducer = jest.fn<(state: State | undefined, action: any) => State>(
      () => state
    );
    const store = createStore(reducer);
    const view = render(
      <Provider store={store}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Provider>
    );
    return { ...view, reducer };
  };

  it("renders its children when nothing throws", () => {
    const { getByText, queryByRole } = renderBoundary(<div>safe child</div>);
    getByText("safe child");
    expect(queryByRole("alert")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows the fallback alert with the error and its stack when a child throws", () => {
    const { getByRole, container } = renderBoundary(<Bomb />);
    const alert = getByRole("alert");
    // Class ORDER is formatter-owned (tailwind class sorting); assert
    // membership only.
    ["alert", "alert-error", "block", "whitespace-pre-wrap"].forEach((cls) =>
      expect(alert.classList.contains(cls)).toBe(true)
    );
    // DaisyUI has no alert-heading; the heading is styled with font
    // utilities instead.
    const heading = alert.querySelector("h4") as HTMLElement;
    expect(heading.textContent).toBe("errorText");
    ["text-lg", "font-bold"].forEach((cls) =>
      expect(heading.classList.contains(cls)).toBe(true)
    );
    expect(alert.textContent).toContain("Error: boom");
    const details = container.querySelector("details") as HTMLElement;
    expect(details).not.toBeNull();
    expect(details.textContent).toContain("Error: boom");
  });

  it("offers export buttons and a reset link in the fallback", () => {
    const { getAllByTitle, getByText, container } = renderBoundary(<Bomb />);
    expect(getAllByTitle("exportTitleTimestamp")).toHaveLength(2);
    getByText("exportSettingsText");
    getByText("exportURLSText");
    const reset = container.querySelector("a") as HTMLAnchorElement;
    expect(reset.className).toBe("btn btn-error");
    expect(reset.getAttribute("title")).toBe("resetExtensionDataText");
    expect(reset.textContent).toBe("resetExtensionDataText");
  });

  it("exports the saved sites without the Private list (#468)", () => {
    const hrefs: (string | null)[] = [];
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        hrefs.push(this.getAttribute("href"));
      });
    const rule = (expression: string, storeId: string) =>
      ({ expression, listType: "WHITE", storeId }) as Expression;
    const { getByText } = renderBoundary(<Bomb />, {
      ...initialState,
      lists: {
        default: [rule("normal.example", "default")],
        private: [rule("private.example", "private")],
      },
    });
    fireEvent.click(getByText("exportURLSText"));
    click.mockRestore();
    expect(hrefs).toHaveLength(1);
    const prefix = "data:text/json;charset=urf-8,";
    const exported = JSON.parse(
      decodeURIComponent((hrefs[0] as string).slice(prefix.length))
    );
    expect(Object.keys(exported)).toEqual(["default"]);
  });

  it("logs the caught error through the extension logger", () => {
    renderBoundary(<Bomb />);
    const errorCalls = (console.error as jest.Mock).mock.calls;
    expect(
      errorCalls.some(
        ([first]) =>
          typeof first === "string" &&
          first.includes("React ErrorBoundary - An Error was caught:")
      )
    ).toBe(true);
  });

  it("clears storage, dispatches RESET_ALL and reloads when reset is clicked", async () => {
    const { getByText, reducer } = renderBoundary(<Bomb />);
    fireEvent.click(getByText("resetExtensionDataText"));
    await waitFor(() => {
      expect(global.browser.runtime.reload).toHaveBeenCalledTimes(1);
    });
    expect(global.browser.storage.local.clear).toHaveBeenCalledTimes(1);
    const actions = reducer.mock.calls.map(([, action]) => action);
    expect(actions).toContainEqual({ type: ReduxConstants.RESET_ALL });
  });
});
