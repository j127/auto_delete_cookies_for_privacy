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
import { ListType, SettingID } from "../../../typings/enums";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch } from "redux";
import {
  addExpressionUI,
  clearExpressionsUI,
  removeListUI,
} from "../../../redux/actions";
import {
  adcpLog,
  getMatchedExpressions,
  getSetting,
  validateExpressionDomain,
} from "../../../services/libs";
import { ReduxAction } from "../../../typings/redux-constants";
import ExpressionTable from "../../common-components/ExpressionTable";
import IconButton from "../../common-components/IconButton";
import { downloadObjectAsJSON } from "../../ui-libs";
import SettingsTooltip from "./SettingsTooltip";
const styles = {
  buttonStyle: {
    height: "max-content",
    padding: "0.75em",
    width: "max-content",
  },
  tableContainer: {
    height: `${window.innerHeight - 210}px`,
    overflow: "auto",
  },
};

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

  const setError = (e: Error): void => {
    setErrorMessage(e.toString());
    setSuccess("");
  };

  const parseRawExpression = (exp: Expression): string[] => {
    const exps = exp.expression.split(",");
    const expressions: string[] = [];
    let skipTimes = 0;
    exps.forEach((e, i, a) => {
      // Ignore if expression was a continuation of regex but had a comma
      if (skipTimes > 0) {
        skipTimes--;
        return;
      }
      // skipTimes should be 0 at this point
      let ee = e.trim();
      // Check for regex slash start
      if (ee.startsWith("/")) {
        // Continue to parse next set of comma-separated values until the next end slash
        while (!ee.endsWith("/")) {
          skipTimes++;
          if (i + skipTimes >= a.length) {
            // We have reached the end of the array and did not find an end slash.
            // We will import as combined.
            break;
          }
          ee += `,${a[i + skipTimes].trim()}`;
        }
      }
      // At this point it should be either a complete regex with start and end
      // slash, or a domain.
      expressions.push(ee);
    });
    return expressions;
  };

  // Import the expressions into the list
  const importExpressions = (importFile: File) => {
    // Do check for import first!
    if (importFile.type !== "application/json") {
      setError(
        new Error(
          `${browser.i18n.getMessage("importFileTypeInvalid")}:  ${
            importFile.name
          } (${importFile.type})`
        )
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (file) => {
      try {
        if (!file.target) {
          setError(
            new Error(
              browser.i18n.getMessage("importFileNotFound", [importFile.name])
            )
          );
          return;
        }
        // FileReader.result is always string as we used readAsText()
        const result = file.target.result as string;
        const newExpressions: StoreIdToExpressionList = JSON.parse(result);
        const storeIds = Object.keys(newExpressions);
        const errExps: string[] = [];
        let validExps = 0;
        storeIds.forEach((storeId) => {
          if (!Array.isArray(newExpressions[storeId])) {
            errExps.push(
              `- ${browser.i18n.getMessage("importListNotArray", [storeId])}`
            );
            return;
          }
          newExpressions[storeId].forEach((expression) => {
            const exps = parseRawExpression(expression);
            exps.forEach((exp) => {
              const e = exp.trim();
              if (!e) return;
              const result = validateExpressionDomain(e).trim();
              if (result) {
                // invalid
                errExps.push(`- ${e} (${storeId}) -> ${result}`);
              } else {
                // valid
                validExps += 1;
                onNewExpression({
                  ...expression,
                  expression: e,
                });
              }
            });
          });
        });
        setErrorMessage(
          errExps.length > 0
            ? `${browser.i18n.getMessage(
                "importInvalidExpressions"
              )}\n${errExps.join("\n")}`
            : ""
        );
        setSuccess(
          validExps > 0
            ? `${browser.i18n.getMessage("importValidExpressions", [
                validExps.toString(),
                importFile.name,
              ])}`
            : ""
        );
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(`${importFile.name} - ${error.toString()}.`);
          setSuccess("");
        }
      }
    };

    reader.readAsText(importFile);
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
        setSuccess(browser.i18n.getMessage("removeAllExpressions"));
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
    <div className="col" style={style}>
      <h1>{browser.i18n.getMessage("expressionListText")}</h1>

      <div className="row">
        <input
          style={{
            display: "inline",
            width: "100%",
          }}
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
          className="form-control"
          formNoValidate={true}
        />
      </div>
      <div className="row">
        <a
          target="_blank"
          rel="help noreferrer noopener"
          href="https://github.com/j127/autodelete_cookies_for_privacy/blob/main/documentation/src/expressions.md"
        >
          {browser.i18n.getMessage("questionExpression")}
        </a>
        <SettingsTooltip hrefURL="expressions.md#writing-expressions" />
      </div>
      <div
        className="row"
        style={{
          columnGap: "0.5em",
          justifyContent: "space-between",
          paddingBottom: "8px",
          paddingTop: "8px",
        }}
      >
        <div className="col-sm col-md-auto">
          <div
            className="row justify-content-sm-center justify-content-md-start"
            style={{
              paddingLeft: 0,
              paddingRight: 0,
            }}
          >
            <IconButton
              className="btn-primary"
              iconName="download"
              role="button"
              onClick={() => downloadObjectAsJSON(lists, "Expressions")}
              title={browser.i18n.getMessage("exportTitleTimestamp")}
              text={browser.i18n.getMessage("exportURLSText")}
              styleReact={styles.buttonStyle}
            />
            <IconButton
              tag="input"
              className="btn-info"
              iconName="upload"
              type="file"
              accept="application/json"
              onChange={(e) => importExpressions(e.target.files[0])}
              text={browser.i18n.getMessage("importURLSText")}
              title={browser.i18n.getMessage("importURLSText")}
              styleReact={styles.buttonStyle}
            />
          </div>
          <div className="w-100" />
          <div
            className="row justify-content-sm-center justify-content-md-start"
            style={{
              marginTop: "5px",
              marginBottom: "5px",
              paddingLeft: 0,
              paddingRight: 0,
            }}
          >
            <IconButton
              tag="button"
              className="btn-danger"
              iconName="trash"
              role="button"
              onClick={() => clearListsConfirmation(lists)}
              text={browser.i18n.getMessage("removeAllExpressions")}
              title={browser.i18n.getMessage("removeAllExpressions")}
              styleReact={styles.buttonStyle}
            />
            <IconButton
              tag="button"
              className="btn-dark"
              iconName="list-alt"
              role="button"
              onClick={() => createDefaultOptions()}
              text={browser.i18n.getMessage(
                "createDefaultExpressionOptionsText"
              )}
              title={browser.i18n.getMessage(
                "createDefaultExpressionOptionsText"
              )}
              styleReact={styles.buttonStyle}
            />
          </div>
        </div>
        <div
          className="col-sm col-md-auto"
          style={{
            justifyContent: "flex-end",
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          <IconButton
            className="btn-secondary"
            onClick={() => {
              addExpressionByInput({
                expression: expressionInput,
                listType: ListType.GREY,
                storeId,
              });
            }}
            styleReact={styles.buttonStyle}
            iconName="plus"
            title={browser.i18n.getMessage("toGreyListText")}
            text={browser.i18n.getMessage("greyListWordText")}
          />

          <IconButton
            className="btn-primary"
            onClick={() => {
              addExpressionByInput({
                expression: expressionInput,
                listType: ListType.WHITE,
                storeId,
              });
            }}
            styleReact={styles.buttonStyle}
            iconName="plus"
            title={browser.i18n.getMessage("toWhiteListText")}
            text={browser.i18n.getMessage("whiteListWordText")}
          />
        </div>
      </div>

      {error !== "" ? (
        <div
          onClick={() => setErrorMessage("")}
          className="row alert alert-danger alertPreWrap"
        >
          {error}
        </div>
      ) : (
        ""
      )}
      {success !== "" ? (
        <div
          onClick={() => setSuccess("")}
          className="row alert alert-success alertPreWrap"
        >
          {success}
        </div>
      ) : (
        ""
      )}
      <div className="row" style={styles.tableContainer}>
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
    </div>
  );
};

export default Expressions;
