/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { ListType } from "@/typings/enums";
import SiteCard from "@/ui/popup/components/SiteCard";

describe("SiteCard", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
  });

  it("shows the cleaned badge and the delay line for an unkept site", () => {
    const { getByText } = render(
      <SiteCard
        cleanDelay={15}
        cookieCount={17}
        hostname="example.com"
        matchedListType={undefined}
      />
    );
    expect(getByText("example.com")).toBeTruthy();
    expect(getByText("siteWillBeCleanedText")).toBeTruthy();
    expect(getByText("siteCleanDelayText[15]")).toBeTruthy();
    expect(document.getElementById("siteCookieCount")?.textContent).toBe("17");
  });

  it("shows the kept badge and the permanent status line", () => {
    const { getByText } = render(
      <SiteCard
        cleanDelay={15}
        cookieCount={3}
        hostname="example.com"
        matchedListType={ListType.WHITE}
      />
    );
    expect(getByText("siteKeptText")).toBeTruthy();
    expect(getByText("siteKeptStatusText")).toBeTruthy();
  });

  it("shows the session status line for a greylist match", () => {
    const { getByText } = render(
      <SiteCard
        cleanDelay={15}
        cookieCount={3}
        hostname="example.com"
        matchedListType={ListType.GREY}
      />
    );
    expect(getByText("siteKeptText")).toBeTruthy();
    expect(getByText("siteKeptSessionStatusText")).toBeTruthy();
  });
});
