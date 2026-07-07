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
  numSize?: number;
  numStart?: number;
  inputOptions?: string[];
  settingObject: Setting;
  text: string;
  updateSetting: (payload: Setting) => void;
}

/**
 * A select-backed setting, laid out per the 05d design: label (with an
 * optional muted description underneath) on the start side, the select at
 * the row's end.
 */
const SelectInput: React.FunctionComponent<OwnProps> = ({
  description,
  numSize,
  numStart,
  inputOptions,
  settingObject,
  text,
  updateSetting,
}) => {
  const { name, value } = settingObject;
  const numbers: string[] = numSize
    ? Array.from(Array(numSize + 1), (x, i) => i + (numStart || 0)).map(String)
    : [];
  const options: string[] = inputOptions || numbers || [];
  return (
    <span className="flex w-full items-center gap-3">
      <label className="min-w-0 flex-1" htmlFor={name}>
        <span className="font-semibold">{text}</span>
        {description && (
          <span className="block text-sm text-base-content/70">
            {description}
          </span>
        )}
      </label>
      <select
        name={name}
        id={name}
        className="select w-auto min-w-20 flex-none select-sm"
        onChange={(e) => {
          const newValue = options.includes(e.target.value as string)
            ? e.target.value
            : value;
          updateSetting({
            name,
            value: newValue,
          });
        }}
        value={value as string}
      >
        {options.map((opt) => (
          <option key={`${name}-${opt}`}>{opt}</option>
        ))}
      </select>
    </span>
  );
};

export default SelectInput;
