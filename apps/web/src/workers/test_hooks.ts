export interface BagdropTestHooks {
  readonly forceDisableDirectFileVfs: boolean;
  readonly forceOpfsStaging: boolean;
}

const disabledHooks: BagdropTestHooks = {
  forceDisableDirectFileVfs: false,
  forceOpfsStaging: false
};

const opfsHooks: BagdropTestHooks = {
  forceDisableDirectFileVfs: true,
  forceOpfsStaging: true
};

let activeHooks: BagdropTestHooks = disabledHooks;

export function setBagdropTestHooks(hooks: BagdropTestHooks): void {
  activeHooks = hooks;
}

export function resetBagdropTestHooks(): void {
  activeHooks = disabledHooks;
}

export function getBagdropTestHooks(): BagdropTestHooks {
  const fromWorkerUrl = readBagdropTestHooksFromUrl(import.meta.url);
  return {
    forceDisableDirectFileVfs:
      activeHooks.forceDisableDirectFileVfs || fromWorkerUrl.forceDisableDirectFileVfs,
    forceOpfsStaging: activeHooks.forceOpfsStaging || fromWorkerUrl.forceOpfsStaging
  };
}

export function readBagdropTestHooksFromPage(): BagdropTestHooks {
  if (typeof location === "undefined") {
    return disabledHooks;
  }

  return new URL(location.href).searchParams.get("bagdrop_test") === "opfs" ? opfsHooks : disabledHooks;
}

export function readBagdropTestHooksFromUrl(importMetaUrl: string): BagdropTestHooks {
  const params = new URL(importMetaUrl).searchParams;

  if (
    params.get("forceDisableDirectFileVfs") !== "1" &&
    params.get("forceOpfsStaging") !== "1"
  ) {
    return disabledHooks;
  }

  return {
    forceDisableDirectFileVfs: params.get("forceDisableDirectFileVfs") === "1",
    forceOpfsStaging: params.get("forceOpfsStaging") === "1"
  };
}

export function bagdropTestWorkerUrl(workerModuleUrl: URL): URL {
  const workerUrl = new URL(workerModuleUrl.href);
  const pageHooks = readBagdropTestHooksFromPage();

  if (pageHooks.forceDisableDirectFileVfs) {
    workerUrl.searchParams.set("forceDisableDirectFileVfs", "1");
  }
  if (pageHooks.forceOpfsStaging) {
    workerUrl.searchParams.set("forceOpfsStaging", "1");
  }

  return workerUrl;
}

export function hasActiveBagdropTestHooks(hooks: BagdropTestHooks): boolean {
  return hooks.forceDisableDirectFileVfs || hooks.forceOpfsStaging;
}
