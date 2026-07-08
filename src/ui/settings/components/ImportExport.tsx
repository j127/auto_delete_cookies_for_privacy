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
import { SettingID } from "@/typings/enums";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch } from "redux";
import { addExpressionUI, resetSettings, updateSetting } from "@/redux/actions";
import { initialState } from "@/redux/state";
import { adcpLog } from "@/services/libs";
import { ReduxAction } from "@/typings/redux-constants";
import IconButton from "@/ui/common-components/IconButton";
import { planExpressionImport } from "@/ui/settings/import-plan";
import { downloadObjectAsJSON } from "@/ui/ui-libs";

interface OwnProps {
  style?: React.CSSProperties;
}

/** Card wrapper matching the Saved sites card treatment (#162). */
const IOCard: React.FunctionComponent<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="mb-4 rounded-box border border-base-300 bg-base-100 p-4">
    <h2 className="mb-3 text-base font-semibold">{title}</h2>
    {children}
  </section>
);

const ImportExport: React.FunctionComponent<OwnProps> = ({ style }) => {
  const settings = useSelector((state: State) => state.settings);
  const lists = useSelector((state: State) => state.lists);
  const dispatch = useDispatch<Dispatch<ReduxAction>>();
  const [error, setErrorMessage] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const onUpdateSetting = (newSetting: Setting) => {
    dispatch(updateSetting(newSetting));
  };

  const onNewExpression = (payload: Expression) => {
    dispatch(addExpressionUI(payload));
  };

  const onResetButtonClick = () => {
    dispatch(resetSettings());
  };

  const setError = (e: Error): void => {
    setErrorMessage(e.toString());
    setSuccess("");
  };

  // Import Settings
  const importCoreSettings = (importFile: File) => {
    const debug = settings[SettingID.DEBUG_MODE].value as boolean;
    adcpLog(
      {
        msg: "Import Core Settings received file for parsing.",
        x: {
          name: importFile.name,
          size: importFile.size,
          type: importFile.type,
        },
      },
      debug
    );
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
    const initialSettingKeys = Object.keys(initialState.settings);
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
        // https://stackoverflow.com/questions/35789498/new-typescript-1-8-4-build-error-build-property-result-does-not-exist-on-t
        const target: FileReader = file.target;
        const result: string = target.result as string;
        const jsonImport: { [k: string]: Record<string, unknown> } =
          JSON.parse(result);
        if (!jsonImport.settings) {
          adcpLog(
            {
              msg: 'importCoreSettings:  Imported JSON does not have "settings" array',
              x: jsonImport,
            },
            debug
          );
          setError(
            new Error(
              `${browser.i18n.getMessage(
                "importFileValidationFailed"
              )}. ${browser.i18n.getMessage("importMissingKey")} 'settings': ${
                importFile.name
              }`
            )
          );
          return;
        }
        // from { name, value } to name:{ name, value }
        const newSettings: MapToSettingObject = (
          jsonImport.settings as unknown as Setting[]
        ).reduce((a: { [k: string]: Setting }, c: Setting) => {
          a[c.name] = c;
          return a;
        }, {});
        const settingKeys = Object.keys(newSettings);
        const unknownKeys = settingKeys.filter(
          (key) => !initialSettingKeys.includes(key)
        );
        if (unknownKeys.length > 0) {
          setError(
            new Error(
              `${browser.i18n.getMessage(
                "importCoreSettingsFailed"
              )}:  ${unknownKeys.join(", ")}`
            )
          );
          return;
        }
        settingKeys.forEach((setting) => {
          if (settings[setting].value !== newSettings[setting].value) {
            adcpLog(
              {
                msg: `Setting updated:  ${setting} (${settings[setting].value} => ${newSettings[setting].value})`,
              },
              debug
            );
            onUpdateSetting(newSettings[setting]);
          } else {
            adcpLog(
              {
                msg: `Setting remains unchanged:  ${setting} (${settings[setting].value})`,
              },
              debug
            );
          }
        });
        setErrorMessage("");
        setSuccess(browser.i18n.getMessage("importCoreSettingsText"));
      } catch (error: unknown) {
        if (error instanceof Error) {
          setErrorMessage(error.toString());
          setSuccess("");
        }
      }
    };

    reader.readAsText(importFile);
  };

  const exportCoreSettings = () => {
    // Convert from name:{name, value} to {name, value}
    const exportSettings: Setting[] = Object.values(settings);
    const r = downloadObjectAsJSON(
      { settings: exportSettings },
      "CoreSettings"
    );
    adcpLog(
      {
        msg: "exportCoreSettings: Core Settings Exported.",
        type: "info",
        x: r,
      },
      settings[SettingID.DEBUG_MODE].value as boolean
    );
    setErrorMessage("");
    setSuccess(
      `${browser.i18n.getMessage("exportSettingsText")}: ${r.downloadName}`
    );
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
        const plan = planExpressionImport(newExpressions, lists);
        plan.additions.forEach((expression) => onNewExpression(expression));
        setErrorMessage(
          plan.errors.length > 0
            ? `${browser.i18n.getMessage(
                "importInvalidExpressions"
              )}\n${plan.errors.join("\n")}`
            : ""
        );
        const successParts: string[] = [];
        if (plan.additions.length > 0) {
          successParts.push(
            browser.i18n.getMessage("importValidExpressions", [
              plan.additions.length.toString(),
              importFile.name,
            ])
          );
        }
        if (plan.foldedCount > 0) {
          successParts.push(
            browser.i18n.getMessage("importFoldedContainersText", [
              plan.foldedCount.toString(),
            ])
          );
        }
        setSuccess(successParts.join("\n"));
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(`${importFile.name} - ${error.toString()}.`);
          setSuccess("");
        }
      }
    };

    reader.readAsText(importFile);
  };

  return (
    <div style={style}>
      <h1 className="mb-1 text-2xl font-bold">
        {browser.i18n.getMessage("importExportText")}
      </h1>
      <p className="mb-4 text-sm text-base-content/70">
        {browser.i18n.getMessage("importExportSubText")}
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

      <IOCard title={browser.i18n.getMessage("preferencesText")}>
        <div className="flex flex-wrap gap-2">
          <IconButton
            className="btn-primary btn-sm"
            iconName="download"
            role="button"
            onClick={() => exportCoreSettings()}
            title={browser.i18n.getMessage("exportTitleTimestamp")}
            text={browser.i18n.getMessage("exportSettingsText")}
          />
          <IconButton
            tag="input"
            className="btn-info btn-sm"
            iconName="upload"
            type="file"
            accept="application/json, .json"
            onChange={(e) => {
              // Cancelling the picker fires change with an empty FileList.
              const file = e.target.files?.[0];
              if (file) importCoreSettings(file);
            }}
            title={browser.i18n.getMessage("importCoreSettingsText")}
            text={browser.i18n.getMessage("importCoreSettingsText")}
          />
          <IconButton
            className="ms-auto btn-error btn-sm"
            role="button"
            onClick={() => {
              onResetButtonClick();
              setErrorMessage("");
              setSuccess(browser.i18n.getMessage("defaultSettingsText"));
            }}
            iconName="undo"
            title={browser.i18n.getMessage("defaultSettingsText")}
            text={browser.i18n.getMessage("defaultSettingsText")}
          />
        </div>
      </IOCard>

      <IOCard title={browser.i18n.getMessage("savedSitesText")}>
        <div className="flex flex-wrap gap-2">
          <IconButton
            className="btn-primary btn-sm"
            iconName="download"
            role="button"
            onClick={() => downloadObjectAsJSON(lists, "Expressions")}
            title={browser.i18n.getMessage("exportTitleTimestamp")}
            text={browser.i18n.getMessage("exportURLSText")}
          />
          <IconButton
            tag="input"
            className="btn-info btn-sm"
            iconName="upload"
            type="file"
            accept="application/json"
            onChange={(e) => {
              // Cancelling the picker fires change with an empty FileList.
              const file = e.target.files?.[0];
              if (file) importExpressions(file);
            }}
            text={browser.i18n.getMessage("importURLSText")}
            title={browser.i18n.getMessage("importURLSText")}
          />
        </div>
      </IOCard>
    </div>
  );
};

export default ImportExport;
