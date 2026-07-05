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
import { useDispatch } from "react-redux";
import { Dispatch } from "redux";
import { clearActivities } from "@/redux/actions";
import { FilterOptions } from "@/typings/enums";
import { ReduxAction } from "@/typings/redux-constants";
import ActivityTable from "@/ui/common-components/ActivityTable";
import IconButton from "@/ui/common-components/IconButton";

interface OwnProps {
  style?: React.CSSProperties;
}

const ActivityLog: React.FunctionComponent<OwnProps> = ({ style }) => {
  const dispatch = useDispatch<Dispatch<ReduxAction>>();
  // The filter radio buttons below are commented out, so only the state
  // value is consumed. Reviving them needs the setter as well:
  // const [decisionFilter, setNewFilter] = React.useState(FilterOptions.NONE);
  const [decisionFilter] = React.useState(FilterOptions.NONE);

  const onClearActivityLogClick = () => {
    dispatch(clearActivities());
  };

  return (
    <div style={style}>
      <h1>{browser.i18n.getMessage("cleanupLogText")}</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            marginTop: "5px",
          }}
        >
          {/* <span>{`${browser.i18n.getMessage('filterText')}: `}</span>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="filterRadios"
              id="filterRadios1"
              value="option1"
              checked={decisionFilter === FilterOptions.NONE}
              onClick={() => setNewFilter(FilterOptions.NONE)}
            />
            <label className="form-check-label" htmlFor="filterRadios1">
              {browser.i18n.getMessage('noneText')}
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="filterRadios"
              id="filterRadios2"
              value="option2"
              checked={decisionFilter === FilterOptions.CLEAN}
              onClick={() => setNewFilter(FilterOptions.CLEAN)}
            />
            <label className="form-check-label" htmlFor="filterRadios2">
              {browser.i18n.getMessage('cleanText')}
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="filterRadios"
              id="filterRadios3"
              value="option3"
              checked={decisionFilter === FilterOptions.KEEP}
              onClick={() => setNewFilter(FilterOptions.KEEP)}
            />
            <label className="form-check-label" htmlFor="filterRadios3">
              {browser.i18n.getMessage('keepText')}
            </label>
          </div> */}
        </div>
        <IconButton
          iconName="trash"
          text={browser.i18n.getMessage("clearLogsText")}
          onClick={() => onClearActivityLogClick()}
          className="btn-warning"
        />
      </div>
      <ActivityTable decisionFilter={decisionFilter} />
    </div>
  );
};

export default ActivityLog;
