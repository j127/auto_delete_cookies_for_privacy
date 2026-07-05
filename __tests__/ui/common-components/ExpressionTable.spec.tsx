/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "../../../src/redux/state";
import { ReduxConstants } from "../../../src/typings/redux-constants";
import { ListType } from "../../../src/typings/enums";
import fontAwesomeImports from "../../../src/ui/font-awesome-imports";
import ExpressionTable from "../../../src/ui/common-components/ExpressionTable";

// Register the FontAwesome icons the entrypoints normally provide.
fontAwesomeImports();

const whiteExpression: Expression = {
  expression: "example.com",
  id: "e1",
  listType: ListType.WHITE,
  storeId: "default",
};

const greyExpression: Expression = {
  expression: "example.org",
  id: "e2",
  listType: ListType.GREY,
  storeId: "default",
};

describe("ExpressionTable", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    // The nested ExpressionOptions fetch cookies in some configurations.
    global.browser.cookies.getAll.mockResolvedValue([]);
  });

  const renderTable = (expressions: ReadonlyArray<Expression>) => {
    const reducer = jest.fn<State, [State | undefined, any]>(
      () => initialState
    );
    const store = createStore(reducer);
    const view = render(
      <Provider store={store}>
        <ExpressionTable
          expressions={expressions}
          expressionColumnTitle="expressionColumnTitle"
          storeId="default"
          emptyElement={<span>emptyListText</span>}
        />
      </Provider>
    );
    const dispatchedActions = () =>
      reducer.mock.calls.map(([, action]) => action);
    const updates = () =>
      dispatchedActions().filter(
        (action) => action.type === ReduxConstants.UPDATE_EXPRESSION
      );
    return { ...view, dispatchedActions, updates };
  };

  const startEditingFirstRow = (
    view: ReturnType<typeof renderTable>,
    title = "editExpressionText"
  ) => {
    fireEvent.click(view.getAllByTitle(title)[0]);
    return view.container.querySelector(
      "td.editableExpression input.form-control"
    ) as HTMLInputElement;
  };

  it("renders the empty element when there are no expressions", () => {
    const { getByText, container } = renderTable([]);
    getByText("emptyListText");
    expect(container.querySelector("table")).toBeNull();
  });

  it("renders the empty element when the expressions prop is undefined", () => {
    const { getByText, container } = renderTable(
      undefined as unknown as ReadonlyArray<Expression>
    );
    getByText("emptyListText");
    expect(container.querySelector("table")).toBeNull();
  });

  it("renders the column headers and one row per expression", () => {
    const { container, getByText, getAllByTitle, getByTitle } = renderTable([
      whiteExpression,
      greyExpression,
    ]);
    const table = container.querySelector("table") as HTMLTableElement;
    expect(table.className).toBe(
      "table-striped table-hover table-bordered table"
    );
    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent
    );
    expect(headers).toEqual([
      "",
      "expressionColumnTitle",
      "optionsText",
      "listTypeText",
    ]);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    const textareas = Array.from(
      container.querySelectorAll("textarea")
    ) as HTMLTextAreaElement[];
    expect(textareas.map((t) => t.value)).toEqual([
      "example.com",
      "example.org",
    ]);
    expect(textareas[0].readOnly).toBe(true);
    getByText("whiteListWordText");
    getByText("greyListWordText");
    expect(getAllByTitle("removeExpressionText")).toHaveLength(2);
    expect(getAllByTitle("editExpressionText")).toHaveLength(2);
    getByTitle("toggleToGreyListWordText");
    getByTitle("toggleToWhiteListWordText");
  });

  it("dispatches the remove action for the row's expression", () => {
    const view = renderTable([whiteExpression, greyExpression]);
    fireEvent.click(view.getAllByTitle("removeExpressionText")[0]);
    expect(view.dispatchedActions()).toContainEqual({
      payload: whiteExpression,
      type: ReduxConstants.REMOVE_EXPRESSION,
    });
  });

  it("dispatches an update with the flipped list type from the toggle button", () => {
    const view = renderTable([whiteExpression, greyExpression]);
    fireEvent.click(view.getByTitle("toggleToGreyListWordText"));
    expect(view.dispatchedActions()).toContainEqual({
      payload: { ...whiteExpression, listType: ListType.GREY },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
    fireEvent.click(view.getByTitle("toggleToWhiteListWordText"));
    expect(view.dispatchedActions()).toContainEqual({
      payload: { ...greyExpression, listType: ListType.WHITE },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
  });

  it("switches the row into edit mode when the pen button is clicked", () => {
    const view = renderTable([whiteExpression, greyExpression]);
    const input = startEditingFirstRow(view);
    expect(input).not.toBeNull();
    expect(input.value).toBe("example.com");
    expect(input.type).toBe("url");
    view.getByTitle("stopEditingText");
    view.getByTitle("saveExpressionText");
    // Only the edited row loses its read-only textarea.
    expect(view.container.querySelectorAll("textarea")).toHaveLength(1);
    const feedback = view.container.querySelector(
      ".invalid-feedback"
    ) as HTMLElement;
    expect(feedback.textContent).toBe("");
  });

  it("commits a valid edit with Enter and dispatches the updated expression", () => {
    const view = renderTable([whiteExpression, greyExpression]);
    const input = startEditingFirstRow(view);
    fireEvent.change(input, { target: { value: "new.example.com" } });
    fireEvent.keyUp(input, { key: "Enter" });
    expect(view.updates()).toContainEqual({
      payload: {
        ...whiteExpression,
        expression: "new.example.com",
        storeId: "default",
      },
      type: ReduxConstants.UPDATE_EXPRESSION,
    });
    // Editing ends after the commit.
    expect(view.container.querySelector("td.editableExpression")).toBeNull();
  });

  it("rejects an invalid edit, shows the message and stays in edit mode", () => {
    const view = renderTable([whiteExpression, greyExpression]);
    const input = startEditingFirstRow(view);
    fireEvent.change(input, { target: { value: "bad domain" } });
    fireEvent.click(view.getByTitle("saveExpressionText"));
    const feedback = view.container.querySelector(
      ".invalid-feedback"
    ) as HTMLElement;
    expect(feedback.textContent).toBe("inputErrorSpace");
    const editCell = view.container.querySelector(
      "td.editableExpression"
    ) as HTMLTableCellElement;
    expect(editCell.classList.contains("was-validated")).toBe(true);
    expect(view.updates()).toHaveLength(0);
  });

  it("cancels the edit with Escape without dispatching", () => {
    const view = renderTable([whiteExpression, greyExpression]);
    const input = startEditingFirstRow(view);
    fireEvent.change(input, { target: { value: "changed.example.com" } });
    fireEvent.keyUp(input, { key: "Escape" });
    expect(view.container.querySelector("td.editableExpression")).toBeNull();
    const textareas = Array.from(
      view.container.querySelectorAll("textarea")
    ) as HTMLTextAreaElement[];
    expect(textareas.map((t) => t.value)).toEqual([
      "example.com",
      "example.org",
    ]);
    expect(view.updates()).toHaveLength(0);
  });
});
