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
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch } from "redux";
// tslint:disable-next-line: import-name
import ReleaseNotes from "@/ui/settings/release-notes.json";
import IconButton from "@/ui/common-components/IconButton";
import { ReduxAction } from "@/typings/redux-constants";
import { SettingID } from "@/typings/enums";
import { resetCookieDeletedCounter } from "@/redux/actions";

const displayReleaseNotes = (releases: ReleaseNote[]) => {
  return (
    <div className="flex flex-col gap-3">
      {releases.map((release, index) => (
        <div key={`release${index}`}>
          <span className="badge font-mono badge-neutral">
            {release.version}
          </span>
          <ul className="mt-1 list-disc ps-6">
            {release.notes.map((element, index2) => (
              <li key={`release3${index2}`}>{element}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

interface OwnProps {
  style?: React.CSSProperties;
  switchTabs: (id: string) => void;
}

const Welcome: React.FunctionComponent<OwnProps> = ({ style, switchTabs }) => {
  const cookieDeletedCounterTotal = useSelector(
    (state: State) => state.cookieDeletedCounterTotal
  );
  const cookieDeletedCounterSession = useSelector(
    (state: State) => state.cookieDeletedCounterSession
  );
  const activeMode = useSelector(
    (state: State) => !!state.settings[SettingID.ACTIVE_MODE]?.value
  );
  const dispatch = useDispatch<Dispatch<ReduxAction>>();

  const onResetCounterButtonClick = () => {
    dispatch(resetCookieDeletedCounter());
  };

  const { releases } = ReleaseNotes as { releases: ReleaseNote[] };
  return (
    <div style={style}>
      <h1 className="mb-4 text-2xl font-bold">
        {browser.i18n.getMessage("overviewText")}
      </h1>

      {/* Activation steps (#262). Shown only until automatic cleaning is on;
          styled to match the Protection page's activeModeCallout so the
          highlighted switch is recognizable on arrival. */}
      {!activeMode && (
        <section
          id="setupSteps"
          className="mb-4 rounded-box border-2 border-primary/40 bg-primary/5 p-4"
        >
          <h2 className="mb-2 font-semibold">
            {browser.i18n.getMessage("setupStepsTitle")}
          </h2>
          <ol className="list-decimal ps-6 text-sm">
            <li>{browser.i18n.getMessage("setupStepProtectionText")}</li>
            <li>{browser.i18n.getMessage("setupStepActiveModeText")}</li>
            <li>{browser.i18n.getMessage("setupStepPinText")}</li>
          </ol>
          <button
            type="button"
            className="btn mt-3 btn-primary btn-sm"
            onClick={() => switchTabs("tabSettings")}
          >
            {browser.i18n.getMessage("setupOpenProtectionText")}
          </button>
        </section>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-2xl font-bold" id="statSession">
            {cookieDeletedCounterSession}
          </div>
          <div className="text-sm text-base-content/70">
            {browser.i18n.getMessage("cookiesDeletedSessionText")}
          </div>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-2xl font-bold" id="statTotal">
            {cookieDeletedCounterTotal}
          </div>
          <div className="text-sm text-base-content/70">
            {browser.i18n.getMessage("cookiesDeletedTotalText")}
          </div>
        </div>
      </div>
      <div className="mb-4">
        <IconButton
          iconName="trash"
          text={browser.i18n.getMessage("resetCookieCounterText")}
          title={browser.i18n.getMessage("resetCookieCounterText")}
          onClick={() => onResetCounterButtonClick()}
          className="btn-sm btn-warning"
        />
      </div>
      <div className="divider" />
      <h2 className="mb-3 text-xl font-semibold">
        {browser.i18n.getMessage("releaseNotesText")}
      </h2>

      {displayReleaseNotes(releases.slice(0, 5))}
    </div>
  );
};

export default Welcome;
