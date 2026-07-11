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
import { browserCapabilities } from "@/services/browser-capabilities";
import { getStoreId, validateExpressionDomain } from "@/services/libs";

export const parseRawExpression = (exp: Expression): string[] => {
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

export interface ImportPlan {
  /** Expressions to dispatch; container entries are retargeted per build. */
  additions: Expression[];
  /** Per-entry rejection lines for the error alert. */
  errors: string[];
  /** Container-list entries that were merged into the default list. */
  foldedCount: number;
}

/**
 * Store keys that import unchanged on this build. Both builds keep
 * default/private; the Firefox build additionally keeps container lists
 * as their own keys (full per-container parity).
 */
const isNativeStoreId = (storeId: string) =>
  storeId === "default" ||
  storeId === "private" ||
  (browserCapabilities.supportsContextualIdentities &&
    storeId.startsWith("firefox-container-"));

/**
 * The key an imported list lands under. On Firefox, old Cookie AutoDelete
 * exports normalize first (firefox-default → default, firefox-private →
 * private) so private entries land in the list cleanup actually reads;
 * containers pass through. On Chrome the raw key is kept so the fold
 * below behaves exactly as before (aliases fold into default and count).
 */
const importTargetStoreId = (storeId: string): string =>
  browserCapabilities.supportsContextualIdentities
    ? getStoreId(storeId)
    : storeId;

/**
 * Turns a parsed expressions-export file into a list of additions.
 *
 * Native lists import unchanged (on the Firefox build that includes
 * container lists, with firefox-default/-private normalized to their
 * unified keys first). On the Chrome build any other store key — Firefox
 * container lists like `firefox-container-1` from original Cookie
 * AutoDelete exports — would never match a Chromium cookie store and sit
 * inert, so those entries fold into `default` instead. Folded entries are
 * deduped against everything already headed for the default list; the key is
 * the expression string alone because the ADD_EXPRESSION reducer drops any
 * addition whose expression already exists in the target list, regardless of
 * list type — a stricter plan-side key would report folds that never land.
 */
export const planExpressionImport = (
  imported: StoreIdToExpressionList,
  existingLists: StoreIdToExpressionList
): ImportPlan => {
  const additions: Expression[] = [];
  const errors: string[] = [];
  let foldedCount = 0;
  const inDefault = new Set(
    (existingLists.default || []).map((e) => e.expression)
  );

  const storeIds = Object.keys(imported);
  // Native lists first so container entries dedupe against every expression
  // headed for default, wherever it appears in the file.
  const isNativeSource = (storeId: string) =>
    isNativeStoreId(importTargetStoreId(storeId));
  const orderedStoreIds = [
    ...storeIds.filter(isNativeSource),
    ...storeIds.filter((storeId) => !isNativeSource(storeId)),
  ];

  orderedStoreIds.forEach((storeId) => {
    if (!Array.isArray(imported[storeId])) {
      errors.push(
        `- ${browser.i18n.getMessage("importListNotArray", [storeId])}`
      );
      return;
    }
    const targetStoreId = importTargetStoreId(storeId);
    imported[storeId].forEach((expression) => {
      parseRawExpression(expression).forEach((exp) => {
        const e = exp.trim();
        if (!e) return;
        const result = validateExpressionDomain(e).trim();
        if (result) {
          // invalid
          errors.push(`- ${e} (${storeId}) -> ${result}`);
          return;
        }
        if (isNativeStoreId(targetStoreId)) {
          if (targetStoreId === "default") {
            inDefault.add(e);
          }
          additions.push({
            ...expression,
            expression: e,
            storeId: targetStoreId,
          });
          return;
        }
        if (inDefault.has(e)) return;
        inDefault.add(e);
        foldedCount += 1;
        additions.push({ ...expression, expression: e, storeId: "default" });
      });
    });
  });

  return { additions, errors, foldedCount };
};
