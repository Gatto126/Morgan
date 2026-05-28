import { describe, expect, it } from "vitest";

import {
  canSubmitDeleteAccountDialog,
  getDeleteAccountDialogResetState
} from "@/components/finance-shell/delete-account-dialog-helpers";

describe("delete account dialog helpers", () => {
  it("allows submit only with password input while not deleting", () => {
    expect(canSubmitDeleteAccountDialog("", false)).toBe(false);
    expect(canSubmitDeleteAccountDialog("correct horse battery staple!", false)).toBe(true);
    expect(canSubmitDeleteAccountDialog("correct horse battery staple!", true)).toBe(false);
  });

  it("resets password and dialog-scoped errors", () => {
    expect(getDeleteAccountDialogResetState()).toEqual({
      password: "",
      error: null
    });
  });
});
