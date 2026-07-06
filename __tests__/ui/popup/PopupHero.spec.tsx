/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { ListType } from "@/typings/enums";
import PopupHero from "@/ui/popup/components/PopupHero";

describe("PopupHero", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
  });

  it("shows the off pair while auto-delete is disabled", () => {
    const { getByText } = render(
      <PopupHero activeMode={false} domain="example.com" />
    );
    expect(getByText("popupHeroOffText")).toBeTruthy();
    expect(getByText("popupHeroOffSubText")).toBeTruthy();
  });

  it("shows the resting pair while on with no matching rule", () => {
    const { getByText } = render(
      <PopupHero activeMode={true} domain="example.com" />
    );
    expect(getByText("popupHeroOnText")).toBeTruthy();
    expect(getByText("popupHeroForgetText")).toBeTruthy();
  });

  it("shows the kept pair for a permanent keep rule", () => {
    const { getByText } = render(
      <PopupHero
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
        activeMode={false}
        domain="example.com"
        matchedListType={ListType.WHITE}
      />
    );
    expect(getByText("popupHeroOffText")).toBeTruthy();
  });
});
