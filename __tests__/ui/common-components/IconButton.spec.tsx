/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import fontAwesomeImports from "../../../src/ui/font-awesome-imports";
import IconButton from "../../../src/ui/common-components/IconButton";

// Register the FontAwesome icons the entrypoints normally provide.
fontAwesomeImports();

describe("IconButton", () => {
  it("renders a <button> by default with the btn class merged in", () => {
    const { container } = render(
      <IconButton className="btn-primary" iconName="trash" text="Remove" />
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.className).toBe("btn btn-primary");
    expect(button.textContent).toBe("Remove");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("prepends the FontAwesome icon and spaces it away from the text", () => {
    const { container } = render(
      <IconButton className="btn-primary" iconName="trash" text="Remove" />
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    const svg = button.querySelector("svg") as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("data-icon")).toBe("trash");
    expect(button.firstElementChild).toBe(svg);
    expect(svg.style.marginRight).toBe("5px");
  });

  it("leaves the icon unspaced when there is no text", () => {
    const { container } = render(
      <IconButton className="btn-primary" iconName="trash" />
    );
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.style.marginRight).toBe("");
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toBe("");
  });

  it("forwards native props such as title and role to the element", () => {
    const { container } = render(
      <IconButton
        className="btn-danger"
        iconName="trash"
        title="removeText"
        role="button"
      />
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("title")).toBe("removeText");
    expect(button.getAttribute("role")).toBe("button");
  });

  it("fires onClick when the button is clicked", () => {
    const onClick = jest.fn();
    const { container } = render(
      <IconButton className="btn-primary" iconName="trash" onClick={onClick} />
    );
    fireEvent.click(container.querySelector("button") as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an anchor when tag is 'a' and forwards link props", () => {
    const { container } = render(
      <IconButton
        tag="a"
        className="btn-info"
        iconName="download"
        href="blob:abc"
        download="settings.json"
        text="exportSettingsText"
      />
    );
    expect(container.querySelector("button")).toBeNull();
    const anchor = container.querySelector("a") as HTMLAnchorElement;
    expect(anchor.className).toBe("btn btn-info");
    expect(anchor.getAttribute("href")).toBe("blob:abc");
    expect(anchor.getAttribute("download")).toBe("settings.json");
    expect(anchor.textContent).toBe("exportSettingsText");
  });

  it("renders a label wrapping a hidden input when tag is 'input'", () => {
    const onChange = jest.fn();
    const { container } = render(
      <IconButton
        tag="input"
        className="btn-secondary"
        iconName="upload"
        type="file"
        accept=".json"
        onChange={onChange}
        text="importText"
      />
    );
    expect(container.querySelector("button")).toBeNull();
    const label = container.querySelector("label") as HTMLLabelElement;
    expect(label.className).toBe("btn btn-secondary");
    expect(label.style.cursor).toBe("pointer");
    expect(label.textContent).toBe("importText");
    const input = label.querySelector("input") as HTMLInputElement;
    expect(input.style.display).toBe("none");
    expect(input.type).toBe("file");
    expect(input.getAttribute("accept")).toBe(".json");
    fireEvent.change(input, { target: { files: [] } });
    expect(onChange).toHaveBeenCalled();
  });
});
