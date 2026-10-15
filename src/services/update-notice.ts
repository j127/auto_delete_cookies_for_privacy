/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * runtime.openOptionsPage() cannot carry a URL parameter, so the background
 * leaves a one-shot flag in storage.session before it opens the settings page
 * after an update; the Overview page reads and clears it to show the
 * "you've updated" notice. storage.session is wiped when the browser closes,
 * so a flag the page never consumed cannot show up a session later.
 */
export const UPDATED_SESSION_KEY = "justUpdated";

/** Background side: mark that the settings page is opening after an update. */
export const flagJustUpdated = async (): Promise<void> => {
  await Promise.resolve(
    browser.storage.session?.set({ [UPDATED_SESSION_KEY]: true })
  ).catch(() => undefined);
};

/** Page side: true once per update, then the flag is cleared. */
export const consumeJustUpdated = async (): Promise<boolean> => {
  try {
    if (!browser.storage.session) return false;
    const data = await browser.storage.session.get({
      [UPDATED_SESSION_KEY]: false,
    });
    if (data[UPDATED_SESSION_KEY] !== true) return false;
    await browser.storage.session.remove(UPDATED_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
};
