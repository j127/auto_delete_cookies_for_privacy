/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import SelectInput from "@/ui/common-components/SelectInput";

interface RenderOptions {
  inputOptions?: string[];
  numSize?: number;
  numStart?: number;
  value?: string;
}

describe("SelectInput", () => {
  let updateSetting: jest.Mock;

  beforeEach(() => {
    updateSetting = jest.fn();
  });

  const renderSelect = (options: RenderOptions = {}) =>
    render(
      <SelectInput
        inputOptions={options.inputOptions}
        numSize={options.numSize}
        numStart={options.numStart}
        settingObject={{ name: "sizePopup", value: options.value ?? "16" }}
        text="sizeText"
        updateSetting={updateSetting}
      />
    );

  const getSelect = (container: HTMLElement) =>
    container.querySelector("select") as HTMLSelectElement;

  const optionTexts = (container: HTMLElement) =>
    Array.from(getSelect(container).options).map((o) => o.textContent);

  it("renders a labeled select bound to the setting", () => {
    const { container } = renderSelect({ inputOptions: ["14", "16", "18"] });
    const select = getSelect(container);
    expect(select.id).toBe("sizePopup");
    expect(select.name).toBe("sizePopup");
    expect(select.className).toBe("selectOptions custom-select");
    expect(select.value).toBe("16");
    expect(optionTexts(container)).toEqual(["14", "16", "18"]);
    const label = container.querySelector("label") as HTMLLabelElement;
    expect(label.htmlFor).toBe("sizePopup");
    expect(label.textContent).toBe("sizeText");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("generates numSize+1 numeric options starting at numStart", () => {
    const { container } = renderSelect({
      numSize: 3,
      numStart: 5,
      value: "5",
    });
    expect(optionTexts(container)).toEqual(["5", "6", "7", "8"]);
    expect(getSelect(container).value).toBe("5");
  });

  it("starts the numeric options at 0 when numStart is omitted", () => {
    const { container } = renderSelect({ numSize: 2, value: "0" });
    expect(optionTexts(container)).toEqual(["0", "1", "2"]);
  });

  it("dispatches updateSetting with the chosen value", () => {
    const { container } = renderSelect({ inputOptions: ["14", "16", "18"] });
    fireEvent.change(getSelect(container), { target: { value: "18" } });
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith({
      name: "sizePopup",
      value: "18",
    });
  });

  it("falls back to the current value when the change is not a listed option", () => {
    const { container } = renderSelect({ inputOptions: ["14", "16", "18"] });
    fireEvent.change(getSelect(container), { target: { value: "99" } });
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith({
      name: "sizePopup",
      value: "16",
    });
  });
});
