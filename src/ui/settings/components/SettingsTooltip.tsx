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
import Icon from "@/ui/common-components/Icon";

interface OwnProps {
  hrefURL: string;
}

/**
 * Documentation link with a CSS-only DaisyUI tooltip (the pre-#40 version
 * relied on the Bootstrap/jQuery tooltip plugin).
 */
const SettingsTooltip: React.FunctionComponent<OwnProps> = ({ hrefURL }) => {
  // Relative values resolve against the user documentation book; pass a
  // full URL to link elsewhere.
  const link = hrefURL.startsWith("http")
    ? hrefURL
    : `https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/${hrefURL}`;
  return (
    <span
      className="tooltip"
      data-tip={browser.i18n.getMessage("documentationText")}
    >
      <a
        href={link}
        target="_blank"
        rel="help noreferrer noopener"
        className="ml-1.5 text-base-content/60 hover:text-base-content"
        aria-label={browser.i18n.getMessage("documentationText")}
      >
        <Icon size="lg" name="question-circle" />
      </a>
    </span>
  );
};

export default SettingsTooltip;
