/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { ListType } from "@/typings/enums";
// React 19 no longer provides a global JSX namespace; it is imported instead.
import { useEffect, useRef, useState, type JSX } from "react";
import { useDispatch } from "react-redux";
import { removeExpressionUI, updateExpressionUI } from "@/redux/actions";
import { validateExpressionDomain } from "@/services/libs";
import { expressionOptionsSummary } from "@/ui/expression-options-summary";
import ExpressionOptions from "./ExpressionOptions";
import Icon from "./Icon";
import IconButton from "./IconButton";

interface OwnProps {
  expressions: ReadonlyArray<Expression>;
  expressionColumnTitle: string;
  storeId: string;
  emptyElement: JSX.Element;
}

type ExpressionTableProps = OwnProps;

const moveCaretToEnd = (e: any) => {
  const tempValue = e.target.value;
  e.target.value = "";
  e.target.value = tempValue;
};

function ExpressionTable(props: ExpressionTableProps) {
  const { expressionColumnTitle, emptyElement, storeId } = props;
  const dispatch = useDispatch<any>();

  const [expressionInput, setExpressionInput] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [id, setId] = useState<string | undefined>("");
  const [invalid, setInvalidText] = useState("");
  // Rows with their ExpressionOptions editor revealed (05-shield layout:
  // rows are one line until expanded).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const editInput = useRef<HTMLInputElement | undefined | null>(undefined);

  const clearEditState = () => {
    setExpressionInput("");
    setEditMode(false);
    setId("");
    setInvalidText("");
  };

  const startEditing = (expression: Expression) => {
    setEditMode(true);
    setExpressionInput(expression.expression);
    setId(expression.id);
    setInvalidText("");
  };

  const toggleExpanded = (expressionId: string | undefined) => {
    if (!expressionId) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(expressionId)) {
        next.delete(expressionId);
      } else {
        next.add(expressionId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (
      editInput.current &&
      editMode &&
      document.activeElement !== document.getElementById("formText")
    ) {
      editInput.current.focus();
    }
  });

  const clearEdit = () => {
    if (editInput.current) {
      editInput.current.setCustomValidity("");
      editInput.current.checkValidity();
      editInput.current = undefined;
    }
    clearEditState();
  };

  const setInvalid = (s: string): boolean => {
    if (!editInput.current) return false;
    setInvalidText(s);
    // Native constraint validation carries the message for assistive tech;
    // the visible text renders from the `invalid` state below (the Bootstrap
    // was-validated/.invalid-feedback pair is gone with #40).
    editInput.current.setCustomValidity(s);
    editInput.current.checkValidity();
    // should always return false since we set error above.
    return false;
  };

  const validateEdit = (): boolean => {
    if (!editMode || !editInput.current || !id) return false;
    const result = validateExpressionDomain(expressionInput.trim()).trim();
    if (result) {
      // validation failed.
      return setInvalid(result);
    }
    // Past this point, presume valid expression entry.
    editInput.current.setCustomValidity("");
    editInput.current.checkValidity();
    return true;
  };

  const commitEdit = () => {
    if (!validateEdit()) return;
    const original = (props.expressions || []).find(
      (expression) => expression.id === id
    );
    if (original) {
      dispatch(
        updateExpressionUI({
          ...original,
          expression: expressionInput,
          storeId,
        })
      );
    }
    clearEditState();
    editInput.current = undefined;
  };

  const expressions = props.expressions === undefined ? [] : props.expressions;

  if (expressions.length === 0) {
    return emptyElement;
  }

  return (
    <table className="table table-fixed table-zebra">
      <thead>
        <tr>
          <th scope="col" className="w-10" />
          <th scope="col" className="w-1/3">
            {expressionColumnTitle}
          </th>
          <th scope="col" className="w-28">
            {browser.i18n.getMessage("listTypeText")}
          </th>
          <th scope="col">{browser.i18n.getMessage("optionsText")}</th>
          <th scope="col" className="w-28" />
        </tr>
      </thead>
      <tbody className="expressionTable">
        {expressions.map((expression) => {
          const expanded = expandedIds.has(expression.id ?? "");
          return [
            <tr
              className="group"
              key={`${expression.expression}-${expression.listType}`}
            >
              <td>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  aria-expanded={expanded}
                  title={browser.i18n.getMessage("toggleOptionsText")}
                  onClick={() => toggleExpanded(expression.id)}
                >
                  <Icon
                    name={expanded ? "chevron-down" : "chevron-right"}
                    className="rtl:-scale-x-100"
                  />
                </button>
              </td>
              {editMode && id === expression.id ? (
                <td className="editableExpression">
                  <div className="flex items-center gap-2">
                    <input
                      ref={(c) => {
                        editInput.current = c;
                      }}
                      className="input w-full input-sm"
                      value={expressionInput}
                      onFocus={moveCaretToEnd}
                      onChange={(e) => setExpressionInput(e.target.value)}
                      onKeyUp={(e) => {
                        if (e.key.toLowerCase().includes("enter")) {
                          commitEdit();
                        } else if (e.key.toLowerCase().includes("escape")) {
                          clearEdit();
                        }
                      }}
                      type="url"
                      autoFocus={true}
                      formNoValidate={true}
                    />
                    <IconButton
                      title={browser.i18n.getMessage("saveExpressionText")}
                      className="btn-outline btn-sm btn-success"
                      iconName="save"
                      onClick={() => {
                        commitEdit();
                      }}
                    />
                    <IconButton
                      title={browser.i18n.getMessage("stopEditingText")}
                      className="btn-outline btn-error btn-sm"
                      iconName="ban"
                      onClick={() => {
                        clearEdit();
                      }}
                    />
                  </div>
                  {invalid !== "" && (
                    <div className="mt-1 text-sm text-error">{invalid}</div>
                  )}
                </td>
              ) : (
                <td>
                  <span
                    className="block truncate font-mono"
                    title={expression.expression}
                  >
                    {expression.expression}
                  </span>
                </td>
              )}
              <td>
                <span
                  className={`badge badge-sm whitespace-nowrap ${
                    expression.listType === "WHITE"
                      ? "badge-success"
                      : "badge-ghost"
                  }`}
                  title={browser.i18n.getMessage(
                    expression.listType === "WHITE"
                      ? "keepButtonTooltipText"
                      : "keepSessionButtonTooltipText"
                  )}
                >
                  {browser.i18n.getMessage(
                    expression.listType === "WHITE"
                      ? "keptBadgeText"
                      : "sessionBadgeText"
                  )}
                </span>
              </td>
              <td>
                <span
                  className="block truncate text-base-content/70"
                  title={expressionOptionsSummary(expression)}
                >
                  {expressionOptionsSummary(expression)}
                </span>
              </td>
              <td>
                <div className="showOnRowHover invisible flex justify-end gap-1 group-hover:visible">
                  <IconButton
                    title={browser.i18n.getMessage("editExpressionText")}
                    iconName="pen"
                    className="btn-outline btn-info btn-sm"
                    onClick={() => {
                      startEditing(expression);
                    }}
                  />
                  <IconButton
                    title={`${
                      expression.listType === "WHITE"
                        ? browser.i18n.getMessage("toggleToSessionText")
                        : browser.i18n.getMessage("toggleToKeepText")
                    }`}
                    iconName="exchange-alt"
                    className="btn-outline btn-neutral btn-sm"
                    onClick={() =>
                      dispatch(
                        updateExpressionUI({
                          ...expression,
                          listType:
                            expression.listType === ListType.GREY
                              ? ListType.WHITE
                              : ListType.GREY,
                        })
                      )
                    }
                  />
                  <IconButton
                    title={browser.i18n.getMessage("removeExpressionText")}
                    className="btn-outline btn-error btn-sm"
                    iconName="trash"
                    onClick={() => {
                      dispatch(removeExpressionUI(expression));
                    }}
                  />
                </div>
              </td>
            </tr>,
            expanded ? (
              <tr
                className="expressionOptionsRow"
                key={`${expression.expression}-${expression.listType}-options`}
              >
                <td />
                <td colSpan={4}>
                  <ExpressionOptions expression={expression} />
                </td>
              </tr>
            ) : null,
          ];
        })}
      </tbody>
    </table>
  );
}

export default ExpressionTable;
