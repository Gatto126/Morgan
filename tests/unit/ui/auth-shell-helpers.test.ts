import { describe, expect, it } from "vitest";

import {
  getAuthLandingResetState,
  getAuthSubmitButtonClass
} from "@/components/auth-shell-helpers";

describe("auth shell helpers", () => {
  it("builds enabled and disabled submit button classes", () => {
    expect(getAuthSubmitButtonClass(true)).toContain("cursor-pointer");
    expect(getAuthSubmitButtonClass(true)).toContain("hover:border-white");
    expect(getAuthSubmitButtonClass(true)).not.toContain("cursor-not-allowed");

    expect(getAuthSubmitButtonClass(false)).toContain("cursor-not-allowed");
    expect(getAuthSubmitButtonClass(false)).toContain("opacity-60");
    expect(getAuthSubmitButtonClass(false)).not.toContain("hover:border-white");
  });

  it("clears sensitive auth state when returning to landing", () => {
    expect(getAuthLandingResetState()).toEqual({
      view: "landing",
      email: "",
      password: "",
      inviteCode: "",
      error: null,
      successMessage: null
    });
  });
});
