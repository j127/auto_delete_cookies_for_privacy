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

/**
 * One-line plain-language description of what an expression keeps, shown in
 * the Saved sites table so a row is readable without expanding its options.
 *
 * The underlying model is subtractive: everything is kept unless listed for
 * cleaning. `cleanAllCookies === false` flips cookies to an allowlist of
 * `cookieNames`; `cleanSiteData` lists the site-data types that get cleaned.
 */
export const expressionOptionsSummary = (expression: Expression): string => {
  const keepsAllCookies =
    expression.cleanAllCookies === undefined || expression.cleanAllCookies;
  const clearedTypes = expression.cleanSiteData || [];
  if (keepsAllCookies && clearedTypes.length === 0) {
    return browser.i18n.getMessage("summaryKeepsEverythingText");
  }
  const parts: string[] = [];
  parts.push(
    keepsAllCookies
      ? browser.i18n.getMessage("summaryAllCookiesText")
      : browser.i18n.getMessage("summaryNamedCookiesText", [
          (expression.cookieNames || []).length.toString(),
        ])
  );
  if (clearedTypes.length > 0) {
    // SiteDataType values (Cache, IndexedDB, ...) are technical proper nouns
    // and stay untranslated inside the localized sentence.
    parts.push(
      browser.i18n.getMessage("summaryClearsTypesText", [
        clearedTypes.join(", "),
      ])
    );
  }
  return parts.join(" · ");
};
