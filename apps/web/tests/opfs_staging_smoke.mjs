import {
  createRosbagLikeDb,
  createSmokeViteServer,
  expectReadyRosbagScan,
  launchSmokeBrowser,
  smokeBaseUrl
} from "./browser_smoke_helpers.mjs";

const server = await createSmokeViteServer();
const baseUrl = smokeBaseUrl(server);
baseUrl.searchParams.set("bagdrop_test", "opfs");

const browser = await launchSmokeBrowser();

try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    throw error;
  });

  await page.goto(baseUrl.href);
  await page.setInputFiles("#file-input", {
    name: "segment_0.db3",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(await createRosbagLikeDb())
  });

  await expectReadyRosbagScan(page);

  await page.getByText("DirectFileVFS unavailable", { exact: true }).waitFor({ timeout: 15_000 });
  await page
    .getByText("DirectFileVFS disabled by BagDrop test harness.", { exact: true })
    .waitFor({ timeout: 15_000 });

  const deferredFindingVisible = await page
    .getByText("SQLite catalog deferred", { exact: true })
    .isVisible()
    .catch(() => false);
  if (deferredFindingVisible) {
    throw new Error("OPFS smoke test produced a deferred catalog finding.");
  }
} finally {
  await browser.close();
  await server.close();
}
