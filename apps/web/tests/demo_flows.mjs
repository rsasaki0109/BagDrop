export const DEMO_VIEWPORT = { width: 1280, height: 900 };

export async function prepareDemoPage(page, baseUrl) {
  page.on("pageerror", (error) => {
    throw error;
  });

  await page.setViewportSize(DEMO_VIEWPORT);
  await page.goto(baseUrl.href);
  await page.locator(".drop-title").waitFor({ timeout: 15_000 });
}

export async function dropDemoBag(page, dbBytes, fileName = "segment_0.db3") {
  await page.setInputFiles("#file-input", {
    name: fileName,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(dbBytes)
  });
}

export async function waitForCleanDemoReady(page) {
  await page.getByRole("cell", { name: "/temperature", exact: true }).waitFor({ timeout: 20_000 });
  await page.locator(".health-badge.health-healthy").getByText("Healthy", { exact: true }).waitFor({
    timeout: 20_000
  });
  await page.locator(".metric-card").filter({ hasText: "Storage" }).getByText("ready", { exact: true }).waitFor({
    timeout: 20_000
  });
}

export async function waitForFindingsDemoReady(page) {
  await page.locator(".finding-list .finding").first().waitFor({ timeout: 20_000 });
  await page.locator(".finding-summary-pill").first().waitFor({ timeout: 20_000 });
  await page.locator(".health-badge").first().waitFor({ timeout: 20_000 });
}

export async function selectTopic(page, topicName) {
  await page.locator(`tr[data-topic-name="${topicName}"]`).click();
  await page.locator(".topic-plot-panel").waitFor({ timeout: 10_000 });
  await waitForPlotCanvas(page);
}

export async function filterTopics(page, query) {
  await page.locator("#topic-filter").fill(query);
  await page.waitForTimeout(250);
}

export async function selectPlotKind(page, plotKind) {
  await page.locator(`.topic-plot-tab[data-plot-kind="${plotKind}"]:not(.is-disabled)`).click();
  await page.locator(`.topic-plot-tab[data-plot-kind="${plotKind}"].is-active`).waitFor({ timeout: 10_000 });
  await waitForPlotCanvas(page);
}

export async function jumpToFindingTopic(page, topicName) {
  await page.locator(`.finding-topic-link[data-topic-name="${topicName}"]`).first().click();
  await page.locator(`tr[data-topic-name="${topicName}"].is-selected`).waitFor({ timeout: 10_000 });
  await page.locator(".topic-plot-panel").waitFor({ timeout: 10_000 });
  await waitForPlotCanvas(page);
}

async function waitForPlotCanvas(page) {
  await page.locator("#topic-plot-canvas").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(250);
}

export async function captureAppFrame(page) {
  const shell = page.locator(".app-shell");
  await shell.waitFor({ timeout: 10_000 });
  return page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: DEMO_VIEWPORT.width, height: DEMO_VIEWPORT.height }
  });
}
