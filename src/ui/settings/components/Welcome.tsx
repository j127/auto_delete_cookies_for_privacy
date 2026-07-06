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
}

const Welcome: React.FunctionComponent<OwnProps> = ({ style }) => {
  const cookieDeletedCounterTotal = useSelector(
    (state: State) => state.cookieDeletedCounterTotal
  );
  const cookieDeletedCounterSession = useSelector(
    (state: State) => state.cookieDeletedCounterSession
  );
  const dispatch = useDispatch<Dispatch<ReduxAction>>();

  const onResetCounterButtonClick = () => {
    dispatch(resetCookieDeletedCounter());
  };

  const { releases } = ReleaseNotes as { releases: ReleaseNote[] };
  return (
    <div style={style}>
      <h1 className="mb-4 text-2xl font-bold">
        {browser.i18n.getMessage("welcomeText")}
      </h1>

      <p className="mb-4">
        {browser.i18n.getMessage("welcomeMessage", [
          browser.i18n.getMessage("extensionName"),
          cookieDeletedCounterSession.toString(),
          cookieDeletedCounterTotal.toString(),
        ])}
      </p>
      <div className="mb-4">
        <IconButton
          iconName="trash"
          text={browser.i18n.getMessage("resetCookieCounterText")}
          title={browser.i18n.getMessage("resetCookieCounterText")}
          onClick={() => onResetCounterButtonClick()}
          className="btn-sm btn-warning"
        />
      </div>
      <div className="flex flex-col gap-1">
        <a
          className="link link-primary"
          href="https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/introduction.md"
        >
          <span>{`${browser.i18n.getMessage("documentationText")}`}</span>
        </a>
        <a
          className="link link-primary"
          href="https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/faq.md"
        >
          <span>{`${browser.i18n.getMessage("faqText")}`}</span>
        </a>
      </div>
      <div className="divider" />
      <h2 className="mb-3 text-xl font-semibold">
        {browser.i18n.getMessage("releaseNotesText")}
      </h2>

      {displayReleaseNotes(releases.slice(0, 5))}
      <p className="mt-4">
        {browser.i18n.getMessage("oldReleasesText")}{" "}
        <a
          className="link link-primary"
          href="https://github.com/j127/auto_delete_cookies_for_privacy/releases"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </p>
    </div>
  );
};

export default Welcome;
