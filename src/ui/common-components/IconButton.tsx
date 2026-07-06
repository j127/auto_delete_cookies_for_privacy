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
import Icon, { IconName } from "./Icon";

interface IconButtonProps {
  accept?: string;
  iconName: IconName;
  iconSize?: React.ComponentProps<typeof Icon>["size"];
  className: string;
  styleReact?: React.CSSProperties;
  text?: string;
  tag?: string;
  href?: string;
  type?: string;
  title?: string;
  download?: string;
  role?: string;
  target?: string;
  onClick?: (e: any) => void;
  onChange?: (e: any) => void;
  onContextMenu?: (e: any) => void;
}

export default function IconButton(props: IconButtonProps) {
  const {
    className,
    iconName,
    iconSize,
    styleReact,
    tag,
    text,
    ...nativeProps
  } = props;

  // Has to be PascalCase, else JSX will think it's a tag named 'tagName'.
  const TagName = tag === "input" ? "label" : tag || "button";
  // For the file-input variant the change handler must live on the hidden
  // input ONLY: the change event bubbles to the wrapping label, and a
  // duplicated React onChange there would run the handler twice per file.
  const wrapperProps = { ...nativeProps };
  if (tag === "input") {
    delete wrapperProps.accept;
    delete wrapperProps.onChange;
    delete wrapperProps.type;
  }
  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    <TagName
      {...wrapperProps}
      className={`btn ${className || ""}`}
      style={{
        cursor: tag === "input" ? "pointer" : undefined,
        margin: "0 2px",
        ...styleReact,
      }}
    >
      <Icon
        style={
          text
            ? {
                marginRight: "5px",
              }
            : undefined
        }
        name={iconName}
        size={iconSize}
      />
      {text}
      {tag === "input" ? (
        <input
          {...nativeProps}
          style={{
            display: "none",
          }}
        />
      ) : null}
    </TagName>
  );
}
