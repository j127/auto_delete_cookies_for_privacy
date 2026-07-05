/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import fontAwesomeImports from "@/ui/font-awesome-imports";
import CheckboxSetting from "@/ui/common-components/CheckboxSetting";

// Register the FontAwesome icons the entrypoints normally provide.
fontAwesomeImports();

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

  it("renders a checked checkbox with its label when the setting is true", () => {
    const { getByRole, getByText } = renderCheckbox(true);
    // The FontAwesome svg carries aria-hidden="true", so the checkbox role
    // is only reachable through hidden elements.
    const checkbox = getByRole("checkbox", { hidden: true });
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(checkbox.getAttribute("aria-hidden")).toBe("true");
    expect(checkbox.id).toBe("activeMode");
    const label = getByText("activeModeText") as HTMLLabelElement;
    expect(label.htmlFor).toBe("activeMode");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("renders an unchecked checkbox when the setting is false", () => {
    const { getByRole } = renderCheckbox(false);
    const checkbox = getByRole("checkbox", { hidden: true });
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

  it("dispatches the negated value when a true setting is clicked", () => {
    const { getByText } = renderCheckbox(true);
    fireEvent.click(getByText("activeModeText"));
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith({
      name: "activeMode",
      value: false,
    });
  });

  it("dispatches the negated value when a false setting is clicked", () => {
    const { getByText } = renderCheckbox(false);
    fireEvent.click(getByText("activeModeText"));
    expect(updateSetting).toHaveBeenCalledWith({
      name: "activeMode",
      value: true,
    });
  });

  it("only sets display inline on the wrapper when the inline prop is given", () => {
    const inlineRender = renderCheckbox(true, true);
    const inlineWrapper = inlineRender.container.firstChild as HTMLElement;
    expect(inlineWrapper.className).toBe("checkbox");
    expect(inlineWrapper.style.display).toBe("inline");

    const blockRender = renderCheckbox(true);
    const blockWrapper = blockRender.container.firstChild as HTMLElement;
    expect(blockWrapper.style.display).toBe("");
  });
});
