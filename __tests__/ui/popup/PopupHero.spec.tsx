/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { ListType } from "@/typings/enums";
import { RESUME_ON_RESTART } from "@/services/pause-service";
import PopupHero from "@/ui/popup/components/PopupHero";

// The switch callbacks; the display tests below don't use them.
const noop = { onPause: () => undefined, onTurnOn: () => undefined };

describe("PopupHero", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
  });

  it("shows the off pair while auto-delete is disabled", () => {
    const { getByText } = render(
      <PopupHero {...noop} activeMode={false} domain="example.com" />
    );
    expect(getByText("popupHeroOffText")).toBeTruthy();
    expect(getByText("popupHeroOffSubText")).toBeTruthy();
  });

  it("shows the resting pair while on with no matching rule", () => {
    const { getByText } = render(
      <PopupHero {...noop} activeMode={true} domain="example.com" />
    );
    expect(getByText("popupHeroOnText")).toBeTruthy();
    expect(getByText("popupHeroForgetText")).toBeTruthy();
  });

  it("shows the kept pair for a permanent keep rule", () => {
    const { getByText } = render(
      <PopupHero
        {...noop}
        activeMode={true}
        domain="example.com"
        matchedListType={ListType.WHITE}
      />
    );
    expect(getByText("popupHeroKeepingText")).toBeTruthy();
    expect(getByText("popupHeroKeepListText[example.com]")).toBeTruthy();
  });

  it("uses the session wording for a greylist rule", () => {
    const { getByText } = render(
      <PopupHero
        {...noop}
        activeMode={true}
        domain="example.com"
        matchedListType={ListType.GREY}
      />
    );
    expect(getByText("popupHeroKeepSessionListText[example.com]")).toBeTruthy();
  });

  it("keeps the off wording even when a rule matches", () => {
    const { getByText } = render(
      <PopupHero
        {...noop}
        activeMode={false}
        domain="example.com"
        matchedListType={ListType.WHITE}
      />
    );
    expect(getByText("popupHeroOffText")).toBeTruthy();
  });

  it("says when a timed pause ends (#555)", () => {
    const resumeAt = new Date(2026, 9, 24, 15, 45).getTime();
    const { getByText } = render(
      <PopupHero
        {...noop}
        activeMode={false}
        domain="example.com"
        resumeAt={resumeAt}
      />
    );
    const time = new Date(resumeAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    expect(getByText(`popupHeroResumesAtText[${time}]`)).toBeTruthy();
  });

  it("says an until-restart pause ends with the browser restart", () => {
    const { getByText } = render(
      <PopupHero
        {...noop}
        activeMode={false}
        domain="example.com"
        resumeAt={RESUME_ON_RESTART}
      />
    );
    expect(getByText("popupHeroResumesOnRestartText")).toBeTruthy();
  });

  it("greys the hero icon while auto-delete is off", () => {
    const { container, rerender } = render(
      <PopupHero {...noop} activeMode={false} domain="example.com" />
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "../icons/icon_48_greyscale.png"
    );
    rerender(<PopupHero {...noop} activeMode={true} domain="example.com" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "../icons/icon_48.png"
    );
  });

  describe("the auto-delete switch (#555)", () => {
    const switchEl = () =>
      document.getElementById("activeModeSwitch") as HTMLInputElement;
    const choices = () => document.getElementById("pauseChoices");

    it("shows on or off to match the setting", () => {
      const { rerender } = render(
        <PopupHero {...noop} activeMode={true} domain="example.com" />
      );
      expect(switchEl().checked).toBe(true);
      rerender(<PopupHero {...noop} activeMode={false} domain="example.com" />);
      expect(switchEl().checked).toBe(false);
    });

    it("turns auto-delete on at once while it is off", () => {
      const onTurnOn = jest.fn();
      const onPause = jest.fn();
      render(
        <PopupHero
          activeMode={false}
          domain="example.com"
          onPause={onPause}
          onTurnOn={onTurnOn}
        />
      );
      fireEvent.click(switchEl());
      expect(onTurnOn).toHaveBeenCalledTimes(1);
      expect(onPause).not.toHaveBeenCalled();
      expect(choices()).toBeNull();
    });

    it("asks for how long before turning auto-delete off", () => {
      const onPause = jest.fn();
      const { getByText } = render(
        <PopupHero
          {...noop}
          activeMode={true}
          domain="example.com"
          onPause={onPause}
        />
      );
      expect(choices()).toBeNull();
      fireEvent.click(switchEl());
      expect(onPause).not.toHaveBeenCalled();
      expect(choices()).toBeTruthy();
      expect(getByText("popupPauseChoicesText")).toBeTruthy();
      // The first choice takes focus, so the keyboard lands on the choices.
      expect(document.activeElement?.textContent).toBe("popupPauseHourText");
    });

    it.each([
      ["popupPauseHourText", "hour"],
      ["popupPauseRestartText", "restart"],
      ["popupPauseOffText", "off"],
    ])("%s pauses with %s and closes the choices", (text, length) => {
      const onPause = jest.fn();
      const { getByText } = render(
        <PopupHero
          {...noop}
          activeMode={true}
          domain="example.com"
          onPause={onPause}
        />
      );
      fireEvent.click(switchEl());
      fireEvent.click(getByText(text));
      expect(onPause).toHaveBeenCalledWith(length);
      expect(choices()).toBeNull();
    });

    it("Cancel closes the choices and keeps auto-delete on", () => {
      const onPause = jest.fn();
      const { getByText } = render(
        <PopupHero
          {...noop}
          activeMode={true}
          domain="example.com"
          onPause={onPause}
        />
      );
      fireEvent.click(switchEl());
      fireEvent.click(getByText("popupPauseCancelText"));
      expect(onPause).not.toHaveBeenCalled();
      expect(choices()).toBeNull();
    });

    it("clicking the switch again closes the choices", () => {
      render(<PopupHero {...noop} activeMode={true} domain="example.com" />);
      fireEvent.click(switchEl());
      fireEvent.click(switchEl());
      expect(choices()).toBeNull();
    });
  });
});
