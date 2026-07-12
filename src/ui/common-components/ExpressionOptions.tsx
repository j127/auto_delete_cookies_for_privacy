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
import { ListType, SiteDataType } from "@/typings/enums";
import ipaddr from "ipaddr.js";
import * as React from "react";
import { useDispatch } from "react-redux";
import { updateExpressionUI } from "@/redux/actions";
import {
  toRawStoreId,
  withAllPartitions,
  withAnyFirstPartyDomain,
} from "@/services/libs";

interface OwnProps {
  expression: Expression;
}

type ExpressionOptionsProps = OwnProps;

const trimDotAndStar = (str: string) => {
  const trimmed = str.replace(/^[.*]+|[.*]+$/g, "");
  if (trimmed === "") return undefined;
  return trimmed;
};

/**
 * cleanAllCookies => droplist
 * undefined => false
 * false => true
 * true => false
 */
const coerceBoolean = (bool: boolean | undefined) => {
  if (bool === undefined) return false;
  return !bool;
};

/**
 * A DaisyUI checkbox with a trailing label. The pre-#40 version drew
 * FontAwesome square icons with role="checkbox"; a real input needs no ARIA
 * plumbing.
 */
const OptionCheckbox: React.FunctionComponent<{
  id: string;
  checked: boolean;
  onToggle: () => void;
  label: string;
}> = ({ id, checked, onToggle, label }) => (
  <label className="flex cursor-pointer items-center gap-2 py-0.5" htmlFor={id}>
    <input
      type="checkbox"
      id={id}
      className="checkbox checkbox-sm"
      checked={checked}
      onChange={onToggle}
    />
    <span>{label}</span>
  </label>
);

function ExpressionOptions(props: ExpressionOptionsProps) {
  const { expression } = props;
  const dispatch = useDispatch<any>();
  const [cookies, setCookies] = React.useState<browser.cookies.Cookie[]>([]);

  const getAllCookies = async () => {
    const exp = expression.expression;
    let foundCookies: browser.cookies.Cookie[] = [];
    if (exp.startsWith("/") && exp.endsWith("/")) {
      // Treat expression as regular expression.  Get all cookies then regex domain.
      const allCookies = await browser.cookies.getAll(
        withAllPartitions(
          withAnyFirstPartyDomain({
            storeId: toRawStoreId(expression.storeId),
          })
        )
      );
      if (exp.slice(1).startsWith("file:")) {
        // Regex with Local Directories
        const regExp = new RegExp(exp.slice(8, -1)); // take out file://
        foundCookies = allCookies.filter(
          (cookie) => cookie.domain === "" && regExp.test(cookie.path)
        );
      } else {
        const regExp = new RegExp(exp.slice(1, -1));
        foundCookies = allCookies.filter((cookie) =>
          regExp.test(cookie.domain)
        );
      }
    } else if (exp.startsWith("file:")) {
      const allCookies = await browser.cookies.getAll(
        withAllPartitions(
          withAnyFirstPartyDomain({
            storeId: toRawStoreId(expression.storeId),
          })
        )
      );
      const regExp = new RegExp(exp.slice(7)); // take out file://
      foundCookies = allCookies.filter(
        (cookie) => cookie.domain === "" && regExp.test(cookie.path)
      );
    } else {
      let cidrEXP: [ipaddr.IPv4 | ipaddr.IPv6, number];
      let allCookies;
      try {
        // Check if expression was a CIDR Notation
        cidrEXP = ipaddr.parseCIDR(exp);
        allCookies = await browser.cookies.getAll(
          withAllPartitions(
            withAnyFirstPartyDomain({
              storeId: toRawStoreId(expression.storeId),
            })
          )
        );
      } catch {
        // Not valid CIDR.  Proceed with default fetch.  Also applies to IP Addresses with no CIDR.
        foundCookies = await browser.cookies.getAll(
          withAllPartitions(
            withAnyFirstPartyDomain({
              domain: `${trimDotAndStar(exp)}${exp.endsWith(".") ? "." : ""}`,
              storeId: toRawStoreId(expression.storeId),
            })
          )
        );
      }
      if (allCookies) {
        foundCookies = allCookies.filter((cookie) => {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore Union types of IPv4 and IPv6 not compatible.
            return ipaddr.parse(cookie.domain).match(cidrEXP);
          } catch {
            // Cookie domain is not an IP Address
            return false;
          }
        });
      }
    }
    setCookies(foundCookies);
  };

  React.useEffect(() => {
    if (coerceBoolean(expression.cleanAllCookies)) {
      getAllCookies();
    }
    // Runs on mount only, mirroring the previous componentDidMount.
  }, []);

  const createCookieList = (
    cookieList: browser.cookies.Cookie[],
    exp: Expression
  ) => {
    const originalCookieNames = exp.cookieNames || [];
    const cookieNamesSet = new Set(originalCookieNames);
    const cookieNames = Array.from(
      new Set([...(exp.cookieNames || []), ...cookieList.map((a) => a.name)])
    ).sort((a, b) => a.localeCompare(b));
    return cookieNames.map((name) => {
      const checked = cookieNamesSet.has(name);
      const key = `${checked}-${exp.id}-${name}`;
      return (
        <div className="ms-5" key={key}>
          <OptionCheckbox
            id={key}
            checked={checked}
            label={name}
            onToggle={() => {
              dispatch(
                updateExpressionUI({
                  ...exp,
                  cookieNames: checked
                    ? originalCookieNames.filter(
                        (cookieName) => cookieName !== name
                      )
                    : [...originalCookieNames, name],
                })
              );
            }}
          />
        </div>
      );
    });
  };

  const toggleCleanAllCookies = (checked: boolean) => {
    if (!coerceBoolean(expression.cleanAllCookies)) {
      getAllCookies();
    }
    dispatch(
      updateExpressionUI({
        ...expression,
        cleanAllCookies: checked,
      })
    );
  };

  const toggleCleanSiteData = (key: SiteDataType, canClean: boolean) => {
    // Build a new array instead of mutating the incoming expression's
    // cleanSiteData prop (issue #95).
    const existingCleanSiteData: SiteDataType[] =
      expression.cleanSiteData || [];
    const newCleanSiteData: SiteDataType[] = canClean
      ? [...existingCleanSiteData, key]
      : existingCleanSiteData.filter((s) => s !== key);

    dispatch(
      updateExpressionUI({
        ...expression,
        cleanSiteData: newCleanSiteData,
        cleanLocalStorage:
          expression.cleanLocalStorage === undefined ? undefined : canClean,
      })
    );
  };

  /**
   * Use for all Site Data Type except cleanAllCookies and Cookies
   * @param cleanData In Expression Type, the site data to clean (SiteDataType enum). Check Expression Type for cleanType.  Case Sensitive.
   */
  const createSiteDataCheckbox = (cleanData: SiteDataType) => {
    const cleanType = `clean${cleanData}`;
    const keyID = `${expression.id}-${cleanType}`;
    // undefined will be false to keep them.
    const checked = expression.cleanSiteData
      ? expression.cleanSiteData.includes(cleanData)
      : false;
    const localeText = ((lt: ListType) => {
      switch (lt) {
        case ListType.WHITE:
          return `keep${cleanData}Text`;
        case ListType.GREY:
          return `keep${cleanData}GreyText`;
        default:
          return "";
      }
    })(expression.listType);
    // The checkbox reads as "keep this data", so it renders CHECKED when the
    // data is NOT in cleanSiteData (mirrors the pre-#40 icon logic).
    return (
      <OptionCheckbox
        id={keyID}
        checked={!checked}
        label={browser.i18n.getMessage(localeText)}
        onToggle={() => {
          toggleCleanSiteData(cleanData, !checked);
        }}
      />
    );
  };

  const keyCleanAllCookies = `${expression.id}-cleanAllCookies`;

  const dropList = coerceBoolean(expression.cleanAllCookies);
  return (
    <div>
      {!expression.expression.startsWith("file:") &&
        createSiteDataCheckbox(SiteDataType.CACHE)}
      {!expression.expression.startsWith("file:") &&
        createSiteDataCheckbox(SiteDataType.INDEXEDDB)}
      {!expression.expression.startsWith("file:") &&
        createSiteDataCheckbox(SiteDataType.LOCALSTORAGE)}
      {!expression.expression.startsWith("file:") &&
        createSiteDataCheckbox(SiteDataType.PLUGINDATA)}
      {!expression.expression.startsWith("file:") &&
        createSiteDataCheckbox(SiteDataType.SERVICEWORKERS)}
      <OptionCheckbox
        id={keyCleanAllCookies}
        checked={
          (expression.cleanAllCookies === undefined ||
            expression.cleanAllCookies) as boolean
        }
        label={browser.i18n.getMessage(
          `keepAllCookies${
            expression.listType === ListType.GREY ? "Grey" : ""
          }Text`
        )}
        onToggle={() =>
          toggleCleanAllCookies(
            !(
              expression.cleanAllCookies === undefined ||
              expression.cleanAllCookies
            )
          )
        }
      />
      {dropList && (
        <div className="max-h-36 overflow-auto">
          {createCookieList(cookies, expression)}
        </div>
      )}
    </div>
  );
}

export default ExpressionOptions;
