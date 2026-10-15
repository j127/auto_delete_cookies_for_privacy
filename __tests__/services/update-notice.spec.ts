import {
  UPDATED_SESSION_KEY,
  consumeJustUpdated,
  flagJustUpdated,
} from "@/services/update-notice";

const session = global.browser.storage.session;

describe("update-notice", () => {
  it("flagJustUpdated sets the one-shot flag in storage.session", async () => {
    await flagJustUpdated();
    expect(session.set).toHaveBeenCalledWith({ [UPDATED_SESSION_KEY]: true });
  });

  it("flagJustUpdated swallows a storage failure", async () => {
    session.set.mockRejectedValueOnce(new Error("quota") as never);
    await expect(flagJustUpdated()).resolves.toBeUndefined();
  });

  it("consumeJustUpdated returns true once and removes the flag", async () => {
    session.get.mockResolvedValueOnce({ [UPDATED_SESSION_KEY]: true } as never);
    await expect(consumeJustUpdated()).resolves.toBe(true);
    expect(session.remove).toHaveBeenCalledWith(UPDATED_SESSION_KEY);
  });

  it("consumeJustUpdated returns false when the flag is absent", async () => {
    session.get.mockResolvedValueOnce({
      [UPDATED_SESSION_KEY]: false,
    } as never);
    await expect(consumeJustUpdated()).resolves.toBe(false);
    expect(session.remove).not.toHaveBeenCalled();
  });

  it("consumeJustUpdated returns false when storage.session throws", async () => {
    session.get.mockRejectedValueOnce(new Error("nope") as never);
    await expect(consumeJustUpdated()).resolves.toBe(false);
  });
});
