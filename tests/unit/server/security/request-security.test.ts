import { afterEach, describe, expect, it } from "vitest";

import {
  RequestSecurityError,
  getAllowedMutationOrigins,
  requireSameOriginMutation
} from "@/server/security/request-security";
import { setTestEnv } from "../../../setup/env";

let restoreEnv = () => {};

afterEach(() => {
  restoreEnv();
  restoreEnv = () => {};
});

describe("request security", () => {
  it("allows the request origin for same-origin mutations", () => {
    const request = new Request("https://morgan.example/api/users", {
      method: "POST",
      headers: { Origin: "https://morgan.example" }
    });

    expect(() => requireSameOriginMutation(request)).not.toThrow();
  });

  it("allows the configured public auth origin behind a proxy", () => {
    restoreEnv = setTestEnv({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://morgan.example",
      BETTER_AUTH_TRUSTED_ORIGINS: ""
    });

    const request = new Request("http://internal:3000/api/users", {
      method: "POST",
      headers: { Origin: "https://morgan.example" }
    });

    expect(() => requireSameOriginMutation(request)).not.toThrow();
  });

  it("rejects requests without origin or referer signals", () => {
    const request = new Request("https://morgan.example/api/users", {
      method: "POST"
    });

    expect(() => requireSameOriginMutation(request)).toThrow(RequestSecurityError);
  });

  it("does not turn wildcard trusted origins into mutation allow-list entries", () => {
    restoreEnv = setTestEnv({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://morgan.example",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://*.example.com, https://app.example"
    });

    const request = new Request("https://morgan.example/api/users", {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });

    expect(getAllowedMutationOrigins(request)).toEqual([
      "https://morgan.example",
      "https://app.example"
    ]);
    expect(() => requireSameOriginMutation(request)).toThrow(RequestSecurityError);
  });
});
