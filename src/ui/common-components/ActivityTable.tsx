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
import { useDispatch, useSelector, useStore } from "react-redux";
import { removeActivity } from "@/redux/actions";
import {
  adcpLog,
  getSetting,
  siteDataToBrowser,
  throwErrorNotification,
} from "@/services/libs";
import {
  FilterOptions,
  ListType,
  ReasonClean,
  ReasonKeep,
  SettingID,
  SiteDataType,
} from "@/typings/enums";
import IconButton from "./IconButton";

const createSummary = (cleanupObj: ActivityLog) => {
  const domainSet = new Set<string>();
  Object.values(cleanupObj.storeIds).forEach((value) => {
    value.forEach((deletedLog) => domainSet.add(deletedLog.cookie.hostname));
  });
  if (cleanupObj.browsingDataCleanup) {
    Object.values(cleanupObj.browsingDataCleanup).forEach((sd) => {
      if (sd) sd.forEach((domain) => domainSet.add(domain));
    });
  }

  return {
    total: domainSet.size.toString(),
    domains: Array.from(domainSet).slice(0, 5).join(", "),
  };
};

const createDetailedSummary = (cleanReasonObjects: CleanReasonObject[]) => {
  const mapDomainToCookieNames: { [domain: string]: CleanReasonObject[] } = {};
  cleanReasonObjects.forEach((obj) => {
    if (mapDomainToCookieNames[obj.cookie.hostname]) {
      mapDomainToCookieNames[obj.cookie.hostname].push(obj);
    } else {
      mapDomainToCookieNames[obj.cookie.hostname] = [obj];
    }
  });
  return Object.entries(mapDomainToCookieNames).map(
    ([domain, cleanReasonObj]) => {
      return (
        <div className="mb-2 alert alert-error" key={`${domain}`} role="alert">
          {`${domain} (${cleanReasonObj
            .map((obj) => obj.cookie.name)
            .join(", ")}): ${returnReasonMessages(cleanReasonObj[0])}`}
        </div>
      );
    }
  );
};

const returnReasonMessages = (cleanReasonObject: CleanReasonObject) => {
  const { reason } = cleanReasonObject;
  const { hostname, mainDomain } = cleanReasonObject.cookie;
  const matchedExpression = cleanReasonObject.expression;
  switch (reason) {
    case ReasonClean.CADSiteDataCookie:
    case ReasonClean.ExpiredCookie: {
      return browser.i18n.getMessage(reason, [hostname]);
    }
    case ReasonKeep.OpenTabs: {
      return browser.i18n.getMessage(reason, [mainDomain]);
    }

    case ReasonClean.NoMatchedExpression:
    case ReasonClean.StartupNoMatchedExpression: {
      return browser.i18n.getMessage(reason, [hostname]);
    }

    case ReasonClean.StartupCleanupAndGreyList: {
      return browser.i18n.getMessage(reason, [
        matchedExpression ? matchedExpression.expression : "",
      ]);
    }

    case ReasonClean.MatchedExpressionButNoCookieName:
    case ReasonKeep.MatchedExpression: {
      return browser.i18n.getMessage(reason, [
        matchedExpression ? matchedExpression.expression : "",
        matchedExpression && matchedExpression.listType === ListType.GREY
          ? browser.i18n.getMessage("greyListWordText")
          : browser.i18n.getMessage("whiteListWordText"),
      ]);
    }

    default:
      return "";
  }
};

type ActivityAction = (log: ActivityLog) => void;

interface OwnProps {
  decisionFilter: FilterOptions;
  numberToShow?: number;
}

type ActivityTableProps = OwnProps;

const restoreCookies = async (
  state: State,
  log: ActivityLog,
  onRemoveActivity: ActivityAction
) => {
  const debug = getSetting(state, SettingID.DEBUG_MODE) as boolean;
  const cleanReasonObjsArrays = Object.values(log.storeIds);
  const promiseArr = [];
  adcpLog(
    {
      msg: `ActivityTable.restoreCookies:  Restoring Cookies for triggered ActivityLog entry`,
      x: log,
    },
    debug
  );
  for (const cleanReasonObjs of cleanReasonObjsArrays) {
    for (const obj of cleanReasonObjs) {
      // Cannot set cookies from file:// protocols
      if (obj.cookie.preparedCookieDomain.startsWith("file:")) {
        adcpLog(
          {
            msg: "Cookie appears to come from a local file.  Cannot be restored normally.",
            type: "warn",
            x: obj.cookie,
          },
          debug
        );
        continue;
      }
      // Silently ignore cookies with no domain
      if (obj.cookie.preparedCookieDomain.trim() === "") {
        adcpLog(
          {
            msg: "Cookie appears to have no domain.  Cannot restore.",
            type: "warn",
            x: obj.cookie,
          },
          debug
        );
        continue;
      }
      const {
        domain,
        expirationDate,
        firstPartyDomain,
        hostOnly,
        httpOnly,
        name,
        sameSite,
        secure,
        storeId,
        value,
      } = obj.cookie;
      // Prefix fun: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#Cookie_prefixes
      // Since the cookies returned through web-extension API should already be validated,
      // we are not doing any validations for __Secure- cookies.
      // For cookies starting with __Secure-, secure attribute should already be true,
      // and url should already start with https://
      // Only modify cookie names starting with __Host- as it shouldn't have domain.
      const cookieProperties = {
        domain: name.startsWith("__Host-") || hostOnly ? undefined : domain,
        expirationDate,
        httpOnly,
        name,
        sameSite,
        secure,
        storeId,
        url: obj.cookie.preparedCookieDomain,
        value,
        // Restoring a Firefox FPI cookie must echo its firstPartyDomain
        // or the set rejects under FPI; absent on Chrome cookies.
        ...(firstPartyDomain !== undefined && { firstPartyDomain }),
      };
      promiseArr.push(browser.cookies.set(cookieProperties));
    }
  }
  try {
    // If any error/rejection was thrown, the rest of the promises are not processed.
    // FUTURE:  Use https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled to process all regardless of rejection. ** Perhaps too early to implement at this time 2020-May-03 **
    await Promise.all(promiseArr).catch((e) => {
      throwErrorNotification(
        e,
        getSetting(state, SettingID.NOTIFY_DURATION) as number
      );
      adcpLog(
        {
          msg: "An Error occurred while trying to restore cookie(s).  The rest of the cookies to restore are not processed.",
          type: "error",
          x: e,
        },
        debug
      );
      throw e;
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return;
  }
  // Restore didn't fail
  onRemoveActivity(log);
};

const ActivityTable: React.FunctionComponent<ActivityTableProps> = (props) => {
  const { numberToShow } = props;
  // Render data comes from slice selectors; the full state is only needed
  // when the restore button is clicked, so it is read from the store at
  // event time instead of through a render subscription.
  const activityLog = useSelector((s: State) => s.activityLog);
  const cache = useSelector((s: State) => s.cache);
  const store = useStore();
  const dispatch = useDispatch<any>();
  const onRemoveActivity: ActivityAction = (activity: ActivityLog) => {
    dispatch(removeActivity(activity));
  };
  if (activityLog.length === 0) {
    return (
      <div className="alert alert-info" role="alert">
        <i>
          {browser.i18n.getMessage("noCleanupLogText")}
          <br /> {browser.i18n.getMessage("noPrivateLogging")}
        </i>
      </div>
    );
  }
  const filtered = activityLog.slice(0, numberToShow || 10);
  return (
    <div className="mb-3 flex flex-col gap-2">
      {filtered.map((log, index) => {
        const summary = createSummary(log);
        const message = browser.i18n.getMessage("notificationContent", [
          log.recentlyCleaned.toString(),
          summary.total,
          summary.domains !== "" ? summary.domains : "(Private)",
        ]);
        const browsingDataEntries = Object.entries(
          log.browsingDataCleanup || {}
        );
        const storeIdEntries = Object.entries(log.storeIds);
        return (
          <div key={index} className="flex items-start gap-2">
            {(log.recentlyCleaned > 0 && (
              <IconButton
                className={"mt-2 btn-primary btn-sm"}
                iconName={"undo"}
                onClick={() =>
                  restoreCookies(
                    store.getState() as State,
                    log,
                    onRemoveActivity
                  )
                }
                title={browser.i18n.getMessage("restoreText")}
              />
            )) || <div className="min-w-11" />}
            {/* The pre-#40 Bootstrap/jQuery collapse plugin is replaced by a
                native details element (DaisyUI styles it via .collapse). */}
            <details className="collapse-arrow collapse min-w-0 flex-1 bg-base-200">
              <summary
                className="collapse-title cursor-pointer overflow-x-hidden text-sm font-medium"
                id={`heading${index}`}
              >
                {`${new Date(log.dateTime).toLocaleString([], {
                  timeZoneName: "short",
                })} - ${message} ...`}
              </summary>
              <div className="collapse-content" id={`collapse${index}`}>
                {browsingDataEntries.map(([siteData, domains]) => {
                  if (!domains || domains.length === 0) return "";
                  return (
                    <div
                      key={`${siteData}-${log.dateTime}`}
                      className="mb-2 alert alert-info"
                      role="alert"
                    >
                      {browser.i18n.getMessage(
                        "activityLogSiteDataDomainsText",
                        [
                          browser.i18n.getMessage(
                            `${siteDataToBrowser(siteData as SiteDataType)}Text`
                          ),
                          domains.join(", "),
                        ]
                      )}
                    </div>
                  );
                })}
                {storeIdEntries.map(([storeId, cleanReasonObjects]) => {
                  return (
                    <div key={`${storeId}-${log.dateTime}`}>
                      {storeIdEntries.length > 1 && (
                        <h6 className="mb-1 font-semibold">
                          {cache[storeId] !== undefined
                            ? `${cache[storeId]} `
                            : ""}
                          ({storeId})
                        </h6>
                      )}
                      {createDetailedSummary(cleanReasonObjects)}
                    </div>
                  );
                })}
              </div>
            </details>
            <IconButton
              className={"mt-2 btn-outline btn-error btn-sm"}
              iconName={"trash"}
              onClick={() => onRemoveActivity(log)}
              title={browser.i18n.getMessage("removeActivityLogEntryText")}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ActivityTable;
