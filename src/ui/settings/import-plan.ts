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
import { validateExpressionDomain } from "@/services/libs";

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
  /** Expressions to dispatch, with container entries retargeted to default. */
  additions: Expression[];
  /** Per-entry rejection lines for the error alert. */
  errors: string[];
  /** Container-list entries that were merged into the default list. */
  foldedCount: number;
}

/** The two store IDs this Chromium-only extension actually uses. */
const isNativeStoreId = (storeId: string) =>
  storeId === "default" || storeId === "private";

/**
 * Turns a parsed expressions-export file into a list of additions.
 *
 * Native lists (default/private) import unchanged. Any other store key —
 * Firefox container lists like `firefox-container-1` from original Cookie
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
  const orderedStoreIds = [
    ...storeIds.filter(isNativeStoreId),
    ...storeIds.filter((storeId) => !isNativeStoreId(storeId)),
  ];

  orderedStoreIds.forEach((storeId) => {
    if (!Array.isArray(imported[storeId])) {
      errors.push(
        `- ${browser.i18n.getMessage("importListNotArray", [storeId])}`
      );
      return;
    }
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
        if (isNativeStoreId(storeId)) {
          if (storeId === "default") {
            inDefault.add(e);
          }
          additions.push({ ...expression, expression: e });
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
