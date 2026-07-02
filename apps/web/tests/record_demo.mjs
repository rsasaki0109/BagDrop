import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureAppFrame,
  dropDemoBag,
  filterTopics,
  jumpToFindingTopic,
  prepareDemoPage,
  selectPlotKind,
  selectTopic,
  waitForCleanDemoReady,
  waitForFindingsDemoReady
} from "./demo_flows.mjs";
import { createCleanDemoDb, createFindingsDemoDb } from "./fixtures/demo_dbs.mjs";
import { writeGifFromFrames } from "./gif_writer.mjs";
import { createSmokeViteServer, launchSmokeBrowser, smokeBaseUrl } from "./browser_smoke_helpers.mjs";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testsDir, "../../..");
const assetsDir = join(repoRoot, "docs/assets");

async function recordCleanBagDemo(page, baseUrl) {
  await prepareDemoPage(page, baseUrl);

  const frames = [];
  frames.push({ png: await captureAppFrame(page), durationSec: 1.2 });

  await dropDemoBag(page, await createCleanDemoDb());
  await waitForCleanDemoReady(page);
  frames.push({ png: await captureAppFrame(page), durationSec: 1.8 });

  await filterTopics(page, "temp");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.2 });

  await filterTopics(page, "");
  await selectTopic(page, "/odom");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.6 });

  await selectPlotKind(page, "xy");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.6 });

  await selectTopic(page, "/temperature");
  await selectPlotKind(page, "value");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.6 });

  await selectTopic(page, "/imu");
  await selectPlotKind(page, "value");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.6 });

  await selectTopic(page, "/cmd_vel");
  await selectPlotKind(page, "value");
  frames.push({ png: await captureAppFrame(page), durationSec: 2.0 });

  return frames;
}

async function recordFindingsDemo(page, baseUrl) {
  await prepareDemoPage(page, baseUrl);

  const frames = [];
  frames.push({ png: await captureAppFrame(page), durationSec: 1.0 });

  await dropDemoBag(page, await createFindingsDemoDb(), "findings_segment_0.db3");
  await waitForFindingsDemoReady(page);
  frames.push({ png: await captureAppFrame(page), durationSec: 2.2 });

  await jumpToFindingTopic(page, "/diagnostics");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.6 });

  await jumpToFindingTopic(page, "/scan");
  await selectPlotKind(page, "range");
  frames.push({ png: await captureAppFrame(page), durationSec: 1.8 });

  await page.locator(".finding-list .finding").nth(2).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  frames.push({ png: await captureAppFrame(page), durationSec: 1.6 });

  await jumpToFindingTopic(page, "/fix");
  await selectPlotKind(page, "latlon");
  frames.push({ png: await captureAppFrame(page), durationSec: 2.0 });

  return frames;
}

const server = await createSmokeViteServer();
const baseUrl = smokeBaseUrl(server);
const browser = await launchSmokeBrowser();

try {
  const page = await browser.newPage();

  console.log("Recording clean bag demo...");
  const cleanFrames = await recordCleanBagDemo(page, baseUrl);
  writeGifFromFrames(cleanFrames, join(assetsDir, "demo-clean-bag.gif"));
  console.log(`Wrote ${join(assetsDir, "demo-clean-bag.gif")}`);

  console.log("Recording findings demo...");
  const findingsFrames = await recordFindingsDemo(page, baseUrl);
  writeGifFromFrames(findingsFrames, join(assetsDir, "demo-findings.gif"));
  console.log(`Wrote ${join(assetsDir, "demo-findings.gif")}`);
} finally {
  await browser.close();
  await server.close();
}
