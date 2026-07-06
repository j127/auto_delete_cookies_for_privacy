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
  inline?: boolean;
  settingObject: Setting;
  text: string;
  updateSetting: (payload: Setting) => void;
}

/**
 * A boolean setting as a DaisyUI toggle. The pre-#40 version drew a
 * FontAwesome square icon with role="checkbox"; a real checkbox input needs
 * none of that ARIA plumbing.
 */
const CheckboxSetting: React.FunctionComponent<OwnProps> = ({
  inline,
  settingObject,
  text,
  updateSetting,
}) => {
  const { name, value } = settingObject;
  return (
    <label
      className={`${
        inline ? "inline-flex" : "flex"
      } cursor-pointer items-center gap-3 py-1`}
      htmlFor={name}
    >
      <input
        type="checkbox"
        id={name}
        className="toggle toggle-primary toggle-sm"
        checked={!!value}
        onChange={() =>
          updateSetting({
            name,
            value: !value,
          })
        }
      />
      <span>{text}</span>
    </label>
  );
};

export default CheckboxSetting;
