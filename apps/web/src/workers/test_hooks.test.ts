import { describe, expect, it } from "vitest";
import {
  bagdropTestWorkerUrl,
  getBagdropTestHooks,
  readBagdropTestHooksFromPage,
  readBagdropTestHooksFromUrl,
  resetBagdropTestHooks,
  setBagdropTestHooks
} from "./test_hooks";

describe("readBagdropTestHooksFromUrl", () => {
  it("reads worker query flags", () => {
    expect(
      readBagdropTestHooksFromUrl(
        "http://127.0.0.1/BagDrop/src/workers/bag.worker.ts?forceDisableDirectFileVfs=1&forceOpfsStaging=1"
      )
    ).toEqual({
      forceDisableDirectFileVfs: true,
      forceOpfsStaging: true
    });
  });
});

describe("getBagdropTestHooks", () => {
  it("merges active worker hooks", () => {
    resetBagdropTestHooks();
    setBagdropTestHooks({
      forceDisableDirectFileVfs: true,
      forceOpfsStaging: true
    });

    expect(getBagdropTestHooks()).toEqual({
      forceDisableDirectFileVfs: true,
      forceOpfsStaging: true
    });

    resetBagdropTestHooks();
  });
});

describe("bagdropTestWorkerUrl", () => {
  it("maps bagdrop_test=opfs page query to worker flags", () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL("http://127.0.0.1/BagDrop/?bagdrop_test=opfs")
    });

    try {
      expect(readBagdropTestHooksFromPage()).toEqual({
        forceDisableDirectFileVfs: true,
        forceOpfsStaging: true
      });

      const workerUrl = bagdropTestWorkerUrl(new URL("http://127.0.0.1/BagDrop/src/workers/bag.worker.ts"));
      expect(workerUrl.searchParams.get("forceDisableDirectFileVfs")).toBe("1");
      expect(workerUrl.searchParams.get("forceOpfsStaging")).toBe("1");
    } finally {
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: originalLocation
      });
    }
  });
});
