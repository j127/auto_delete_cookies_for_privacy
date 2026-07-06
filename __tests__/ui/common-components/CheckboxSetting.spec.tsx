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

  const renderCheckbox = (value: boolean, description?: string) =>
    render(
      <CheckboxSetting
        description={description}
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

  it("lays out text before the toggle (05d row order)", () => {
    const { container } = renderCheckbox(true);
    const label = container.firstChild as HTMLLabelElement;
    expect(label.classList.contains("flex")).toBe(true);
    const children = Array.from(label.children);
    expect(children[0].tagName).toBe("SPAN");
    expect(children[children.length - 1].tagName).toBe("INPUT");
  });

  it("renders a muted description under the label when given", () => {
    const withDescription = renderCheckbox(true, "helper words");
    expect(withDescription.getByText("helper words")).toBeTruthy();
    withDescription.unmount();
    const without = renderCheckbox(true);
    expect(without.queryByText("helper words")).toBeNull();
  });
});
