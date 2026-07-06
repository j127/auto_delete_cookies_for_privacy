/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import CheckboxSetting from "@/ui/common-components/CheckboxSetting";

describe("CheckboxSetting", () => {
  let updateSetting: jest.Mock;

  beforeEach(() => {
    updateSetting = jest.fn();
  });

  const renderCheckbox = (value: boolean, inline?: boolean) =>
    render(
      <CheckboxSetting
        inline={inline}
        settingObject={{ name: "activeMode", value }}
        text="activeModeText"
        updateSetting={updateSetting}
      />
    );

  it("renders a checked toggle with its label when the setting is true", () => {
    const { getByRole, getByText } = renderCheckbox(true);
    const checkbox = getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.id).toBe("activeMode");
    const label = getByText("activeModeText").closest(
      "label"
    ) as HTMLLabelElement;
    expect(label.htmlFor).toBe("activeMode");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("renders an unchecked toggle when the setting is false", () => {
    const { getByRole } = renderCheckbox(false);
    expect((getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("dispatches the negated value when a true setting is clicked", () => {
    const { getByRole } = renderCheckbox(true);
    fireEvent.click(getByRole("checkbox"));
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith({
      name: "activeMode",
      value: false,
    });
  });

  it("dispatches the negated value when a false setting is clicked", () => {
    const { getByRole } = renderCheckbox(false);
    fireEvent.click(getByRole("checkbox"));
    expect(updateSetting).toHaveBeenCalledWith({
      name: "activeMode",
      value: true,
    });
  });

  it("only renders the wrapper inline when the inline prop is given", () => {
    const inlineRender = renderCheckbox(true, true);
    const inlineWrapper = inlineRender.container.firstChild as HTMLElement;
    expect(inlineWrapper.classList.contains("inline-flex")).toBe(true);

    const blockRender = renderCheckbox(true);
    const blockWrapper = blockRender.container.firstChild as HTMLElement;
    expect(blockWrapper.classList.contains("inline-flex")).toBe(false);
    expect(blockWrapper.classList.contains("flex")).toBe(true);
  });
});
