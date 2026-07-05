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
import { useSelector } from "react-redux";

import { getMatchedExpressions } from "@/services/libs";
import ExpressionTable from "@/ui/common-components/ExpressionTable";

interface OwnProps {
  url: string;
  storeId: string;
}

const FilteredExpression: React.FunctionComponent<OwnProps> = (props) => {
  const { url, storeId } = props;
  const lists = useSelector((s: State) => s.lists);
  const expressions = getMatchedExpressions(lists, storeId, url);
  return (
    <ExpressionTable
      expressionColumnTitle={browser.i18n.getMessage(
        "matchedDomainExpressionText"
      )}
      expressions={expressions}
      storeId={storeId}
      emptyElement={
        <span
          style={{
            fontStyle: "italic",
            width: "100%",
          }}
        >
          <div
            className="alert alert-primary"
            role="alert"
            style={{
              marginBottom: 0,
            }}
          >
            <i>{browser.i18n.getMessage("noRulesText")}</i>
          </div>
        </span>
      }
    />
  );
};

export default FilteredExpression;
