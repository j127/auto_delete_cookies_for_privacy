/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { getTheme, setTheme, ThemeChoice } from "@/ui/theme";

/**
 * Auto/Light/Dark selector in the settings header (#40). Persistence and
 * cross-page sync live in src/ui/theme.ts; this component only mirrors the
 * stored choice into local state so the select shows the current value.
 */
const ThemeSwitcher: React.FunctionComponent = () => {
  const [choice, setChoice] = React.useState<ThemeChoice>("auto");

  React.useEffect(() => {
    let cancelled = false;
    getTheme().then((stored) => {
      if (!cancelled) setChoice(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm">{browser.i18n.getMessage("themeText")}</span>
      <select
        className="select w-28 select-sm"
        id="themeSwitcher"
        value={choice}
        onChange={(e) => {
          const next = e.target.value as ThemeChoice;
          setChoice(next);
          void setTheme(next);
        }}
      >
        <option value="auto">{browser.i18n.getMessage("themeAutoText")}</option>
        <option value="light">
          {browser.i18n.getMessage("themeLightText")}
        </option>
        <option value="dark">{browser.i18n.getMessage("themeDarkText")}</option>
      </select>
    </label>
  );
};

export default ThemeSwitcher;
