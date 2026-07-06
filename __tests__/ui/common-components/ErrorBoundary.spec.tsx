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
    global.browser.runtime.getManifest.mockReturnValue({ version: "4.0.0" });
  });

  const renderBoundary = (children: React.ReactNode) => {
    const reducer = jest.fn<State, [State | undefined, any]>(
      () => initialState
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
    expect(alert.className).toBe("alert alert-danger alertPreWrap");
    const heading = alert.querySelector("h4.alert-heading") as HTMLElement;
    expect(heading.textContent).toBe("errorText");
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
    expect(reset.className).toBe("btn btn-danger");
    expect(reset.getAttribute("title")).toBe("resetExtensionDataText");
    expect(reset.textContent).toBe("resetExtensionDataText");
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
