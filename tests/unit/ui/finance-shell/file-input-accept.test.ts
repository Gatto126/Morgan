import { describe, expect, it } from "vitest";

import {
  getTransactionImportFileAccept,
  TRANSACTION_IMPORT_FILE_ACCEPT,
  usesAppleMobileFilePicker
} from "@/components/finance-shell/file-input-accept";

describe("transaction import file accept", () => {
  it("does not restrict the iPhone file picker", () => {
    const navigatorLike = {
      maxTouchPoints: 5,
      platform: "iPhone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15"
    };

    expect(usesAppleMobileFilePicker(navigatorLike)).toBe(true);
    expect(getTransactionImportFileAccept(navigatorLike)).toBeUndefined();
  });

  it("does not restrict iPadOS when Safari reports a desktop platform", () => {
    const navigatorLike = {
      maxTouchPoints: 5,
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15"
    };

    expect(usesAppleMobileFilePicker(navigatorLike)).toBe(true);
    expect(getTransactionImportFileAccept(navigatorLike)).toBeUndefined();
  });

  it("keeps unsupported files dimmed on desktop pickers", () => {
    const navigatorLike = {
      maxTouchPoints: 0,
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    expect(usesAppleMobileFilePicker(navigatorLike)).toBe(false);
    expect(getTransactionImportFileAccept(navigatorLike)).toBe(TRANSACTION_IMPORT_FILE_ACCEPT);
  });

  it("does not emit an accept filter before the browser environment is known", () => {
    expect(getTransactionImportFileAccept(null)).toBeUndefined();
  });
});
