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
import { ListType, SettingID } from "@/typings/enums";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch } from "redux";
import {
  addExpressionUI,
  clearExpressionsUI,
  removeListUI,
} from "@/redux/actions";
import {
  adcpLog,
  getMatchedExpressions,
  getSetting,
  validateExpressionDomain,
} from "@/services/libs";
import { ReduxAction } from "@/typings/redux-constants";
import ExpressionTable from "@/ui/common-components/ExpressionTable";
import Icon from "@/ui/common-components/Icon";
import IconButton from "@/ui/common-components/IconButton";
import { parseRawExpression } from "@/ui/settings/import-plan";
import SettingsTooltip from "./SettingsTooltip";

interface OwnProps {
  style?: React.CSSProperties;
}

const Expressions: React.FunctionComponent<OwnProps> = ({ style }) => {
  const debug = useSelector(
    (state: State) => getSetting(state, SettingID.DEBUG_MODE) as boolean
  );
  const lists = useSelector((state: State) => state.lists);
  const dispatch = useDispatch<Dispatch<ReduxAction>>();

  const [error, setErrorMessage] = React.useState("");
  const [expressionInput, setExpressionInput] = React.useState("");
  const [storeId] = React.useState("default");
  const [success, setSuccess] = React.useState("");

  const onClearExpressions = (payload: StoreIdToExpressionList) => {
    dispatch(clearExpressionsUI(payload));
  };

  const onNewExpression = (payload: Expression) => {
    dispatch(addExpressionUI(payload));
  };

  const onRemoveList = (payload: keyof StoreIdToExpressionList) => {
    dispatch(removeListUI(payload));
  };

  // Add the expression using the + button or the Enter key
  const addExpressionByInput = (payload: Expression) => {
    const exps = parseRawExpression(payload);
    const invalidInputs: string[] = [];
    const inputReasons: string[] = [];
    const validInputs: string[] = [];
    exps.forEach((exp) => {
      const expTrim = exp.trim();
      if (!expTrim) return;
      const result = validateExpressionDomain(expTrim).trim();
      if (result) {
        // invalid
        invalidInputs.push(expTrim);
        inputReasons.push(`- ${expTrim} -> ${result}`);
      } else {
        // valid
        validInputs.push(`- ${expTrim}`);
        onNewExpression({
          ...payload,
          expression: expTrim,
        });
      }
    });
    setExpressionInput(invalidInputs.join(", "));
    setSuccess(
      validInputs.length > 0
        ? `${browser.i18n.getMessage("inputAddSuccess", [
            validInputs.length.toString(),
            browser.i18n.getMessage(
              `${payload.listType.toLowerCase()}ListWordText`
            ),
          ])}\n${validInputs.join(", ")}`
        : ""
    );
    setErrorMessage(
      inputReasons.length > 0
        ? `${browser.i18n.getMessage(
            "invalidNewExpressions"
          )}\n${inputReasons.join("\n")}`
        : ""
    );
  };

  const clearListsConfirmation = (lists: StoreIdToExpressionList) => {
    const listKeys = Object.keys(lists);
    let expCount = 0;
    listKeys.forEach((k) => {
      expCount += lists[k].length;
    });
    if (listKeys.length === 0 && expCount === 0) {
      setErrorMessage(browser.i18n.getMessage("removeAllExpressionsNoneFound"));
    } else {
      const r = window.prompt(
        browser.i18n.getMessage("removeAllExpressionsConfirm", [
          expCount.toString(),
          listKeys.length.toString(),
        ])
      );
      adcpLog(
        {
          msg: `Clear Expressions Prompt returned [ ${r} ]`,
          type: "info",
        },
        debug
      );
      if (r !== null && r === expCount.toString()) {
        onClearExpressions(lists);
        setSuccess(browser.i18n.getMessage("removedAllExpressionsText"));
      }
    }
  };

  // Currently unreferenced by the UI, kept from the class component for
  // future per-container list removal.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeListConfirmation = (
    list: keyof StoreIdToExpressionList,
    expressions: ReadonlyArray<Expression>
  ) => {
    const expCount = (expressions || []).length;
    if (expCount === 0) {
      setErrorMessage(browser.i18n.getMessage("removeAllExpressionsNoneFound"));
    } else {
      const r = window.prompt(
        browser.i18n.getMessage("removeAllExpressionsConfirm", [
          expCount.toString(),
          list.toString(),
        ])
      );
      adcpLog(
        {
          msg: `Remove Expressions Prompt for ${list} returned [ ${r} ]`,
          type: "info",
        },
        debug
      );
      if (r !== null && r === expCount.toString()) {
        onRemoveList(list);
        setSuccess(`${browser.i18n.getMessage("removeListText")}: ${list}`);
      }
    }
  };

  const createDefaultOptions = () => {
    const containers = new Set<string>(Object.keys(lists));
    containers.add("0");
    containers.forEach((id) => {
      [ListType.GREY, ListType.WHITE].forEach((lt) => {
        onNewExpression({
          expression: `_Default:${lt}`,
          listType: lt,
          storeId: id,
        });
      });
    });
  };

  return (
    <div style={style}>
      <h1 className="mb-1 text-2xl font-bold">
        {browser.i18n.getMessage("savedSitesText")}
      </h1>
      <p className="mb-4 text-sm text-base-content/70">
        {browser.i18n.getMessage("savedSitesSubText")}
      </p>

      {error !== "" ? (
        <div
          onClick={() => setErrorMessage("")}
          className="mb-4 alert cursor-pointer whitespace-pre-wrap alert-error"
          role="alert"
        >
          {error}
        </div>
      ) : (
        ""
      )}
      {success !== "" ? (
        <div
          onClick={() => setSuccess("")}
          className="mb-4 alert cursor-pointer whitespace-pre-wrap alert-success"
          role="alert"
        >
          {success}
        </div>
      ) : (
        ""
      )}

      <div className="rounded-box border border-base-300 bg-base-100">
        <div className="border-b border-base-300 p-3">
          <div className="join w-full">
            <input
              className="input join-item w-full"
              value={expressionInput}
              onChange={(e) => setExpressionInput(e.target.value)}
              placeholder={browser.i18n.getMessage("domainPlaceholderText")}
              onKeyUp={(e) => {
                if (e.key.toLowerCase() === "enter") {
                  addExpressionByInput({
                    expression: expressionInput,
                    listType: e.shiftKey ? ListType.GREY : ListType.WHITE,
                    storeId,
                  });
                }
              }}
              type="url"
              id="formText"
              autoFocus={true}
              formNoValidate={true}
            />
            <IconButton
              className="join-item btn-secondary"
              onClick={() => {
                addExpressionByInput({
                  expression: expressionInput,
                  listType: ListType.GREY,
                  storeId,
                });
              }}
              iconName="plus"
              title={browser.i18n.getMessage("keepSessionButtonTooltipText")}
              text={browser.i18n.getMessage("keepSessionButtonText")}
            />
            <IconButton
              className="join-item btn-primary"
              onClick={() => {
                addExpressionByInput({
                  expression: expressionInput,
                  listType: ListType.WHITE,
                  storeId,
                });
              }}
              iconName="plus"
              title={browser.i18n.getMessage("keepButtonTooltipText")}
              text={browser.i18n.getMessage("keepButtonText")}
            />
          </div>
        </div>

        <details className="group/patterns border-b border-base-300">
          <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
            <Icon
              className="group-open/patterns:rotate-90 rtl:-scale-x-100"
              name="chevron-right"
              size="sm"
            />
            {browser.i18n.getMessage("questionExpression")}
          </summary>
          <div className="px-3 pb-3">
            <p className="mb-2 text-sm text-base-content/70">
              {browser.i18n.getMessage("patternKeepLevelsText")}
            </p>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">
                    {browser.i18n.getMessage("patternColumnText")}
                  </th>
                  <th scope="col">
                    {browser.i18n.getMessage("patternMeaningColumnText")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono">example.com</td>
                  <td>{browser.i18n.getMessage("patternDomainMeaningText")}</td>
                </tr>
                <tr>
                  <td className="font-mono">*.example.com</td>
                  <td>
                    {browser.i18n.getMessage("patternSubdomainsMeaningText")}
                  </td>
                </tr>
                <tr>
                  <td className="font-mono">192.168.1.1</td>
                  <td>{browser.i18n.getMessage("patternIPMeaningText")}</td>
                </tr>
                <tr>
                  <td className="font-mono">192.168.1.0/24</td>
                  <td>{browser.i18n.getMessage("patternCIDRMeaningText")}</td>
                </tr>
                <tr>
                  <td className="font-mono">{"/^mail\\.example\\.com$/"}</td>
                  <td>{browser.i18n.getMessage("patternRegexMeaningText")}</td>
                </tr>
                <tr>
                  <td className="font-mono">file:///home/user/</td>
                  <td>{browser.i18n.getMessage("patternFileMeaningText")}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 flex items-center">
              <a
                className="link text-sm link-primary"
                target="_blank"
                rel="help noreferrer noopener"
                href="https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/expressions.md"
              >
                {browser.i18n.getMessage("documentationText")}
              </a>
              <SettingsTooltip hrefURL="expressions.md#writing-expressions" />
            </div>
          </div>
        </details>

        <div className="max-h-[calc(100vh-20rem)] overflow-auto p-3">
          <ExpressionTable
            expressionColumnTitle={browser.i18n.getMessage(
              "domainExpressionsText"
            )}
            expressions={getMatchedExpressions(
              lists,
              storeId,
              expressionInput,
              true
            )}
            storeId={storeId}
            emptyElement={
              <span>
                {browser.i18n.getMessage(
                  expressionInput.trim().length === 0
                    ? "noExpressionsText"
                    : "noSearchExpressionsFound"
                )}
              </span>
            }
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-base-300 p-3">
          <IconButton
            tag="button"
            className="btn-neutral btn-sm"
            iconName="list-alt"
            role="button"
            onClick={() => createDefaultOptions()}
            text={browser.i18n.getMessage("createDefaultExpressionOptionsText")}
            title={browser.i18n.getMessage(
              "createDefaultExpressionOptionsText"
            )}
          />
          <IconButton
            tag="button"
            className="ms-auto btn-error btn-sm"
            iconName="trash"
            role="button"
            onClick={() => clearListsConfirmation(lists)}
            text={browser.i18n.getMessage("removeAllExpressions")}
            title={browser.i18n.getMessage("removeAllExpressions")}
          />
        </div>
      </div>
    </div>
  );
};

export default Expressions;
