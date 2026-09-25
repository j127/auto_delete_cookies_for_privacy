/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { addExpression, addExpressions } from "@/redux/actions";
import { backgroundActions } from "@/redux/store";
import { ReduxConstants } from "@/typings/redux-constants";

describe("backgroundActions", () => {
  it("should map the single and the batch add to their thunks", () => {
    // The UI dispatches by action type over the bridge, and an unmapped
    // type is dropped with a console error, so the batch add (#437) has to
    // be listed next to the single one.
    expect(backgroundActions[ReduxConstants.ADD_EXPRESSION]).toBe(
      addExpression
    );
    expect(backgroundActions[ReduxConstants.ADD_EXPRESSIONS]).toBe(
      addExpressions
    );
  });
});
