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
interface OwnProps {
  description?: string;
  settingObject: Setting;
  text: string;
  updateSetting: (payload: Setting) => void;
}

/**
 * A boolean setting as a DaisyUI toggle, laid out per the 05d design: label
 * (with an optional muted description underneath) on the start side, the
 * toggle at the row's end.
 */
const CheckboxSetting: React.FunctionComponent<OwnProps> = ({
  description,
  settingObject,
  text,
  updateSetting,
}) => {
  const { name, value } = settingObject;
  return (
    <label
      className="flex w-full cursor-pointer items-center gap-3 py-1.5"
      htmlFor={name}
    >
      <span className="min-w-0 flex-1">
        <span>{text}</span>
        {description && (
          <span className="block text-sm text-base-content/70">
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        id={name}
        className="toggle flex-none toggle-primary toggle-sm"
        checked={!!value}
        onChange={() =>
          updateSetting({
            name,
            value: !value,
          })
        }
      />
    </label>
  );
};

export default CheckboxSetting;
