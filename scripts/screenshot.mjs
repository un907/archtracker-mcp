import { chromium } from "playwright";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, "..", "docs", "screenshots");
const URL = "http://localhost:54999";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Graph View (Dark theme - default) ---
  await page.goto(URL);
  await page.waitForTimeout(3000); // wait for D3 simulation to stabilize
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "graph-view-dark.png"),
    fullPage: false,
  });
  console.log("✓ graph-view-dark.png");

  // --- Graph View (Light theme) ---
  // Open settings and toggle theme
  const settingsBtn = page.locator("#settings-btn");
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
  }
  const themeToggle = page.locator("#theme-toggle");
  if (await themeToggle.isVisible()) {
    await themeToggle.click();
    await page.waitForTimeout(1000);
  }
  // Close settings panel by clicking settings button again
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "graph-view-light.png"),
    fullPage: false,
  });
  console.log("✓ graph-view-light.png");

  // Switch back to dark
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
  }
  if (await themeToggle.isVisible()) {
    await themeToggle.click();
    await page.waitForTimeout(500);
  }
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
  }

  // --- Hierarchy View ---
  const hierTab = page.locator('[data-view="hier-view"]');
  if (await hierTab.isVisible()) {
    await hierTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "hierarchy-view.png"),
      fullPage: false,
    });
    console.log("✓ hierarchy-view.png");
  }

  // --- Diff View (if available) ---
  const diffTab = page.locator("#diff-tab");
  if (await diffTab.isVisible()) {
    await diffTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "diff-view.png"),
      fullPage: false,
    });
    console.log("✓ diff-view.png");
  } else {
    console.log("⊘ diff-view (no diff data, skipped)");
  }

  // --- Graph View with Impact Mode ---
  const graphTab = page.locator('[data-view="graph-view"]');
  await graphTab.click();
  await page.waitForTimeout(1500);

  // Enable impact mode
  const impactBtn = page.locator("#impact-btn");
  if (await impactBtn.isVisible()) {
    await impactBtn.click();
    await page.waitForTimeout(500);

    // Click on a node to trigger impact simulation
    // Find a node in the SVG and click it
    const nodes = page.locator("#graph-view svg circle");
    const count = await nodes.count();
    if (count > 0) {
      // Click on a node near the center area
      const targetIdx = Math.min(2, count - 1);
      await nodes.nth(targetIdx).click({ force: true });
      await page.waitForTimeout(1500);
    }
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "impact-simulation.png"),
      fullPage: false,
    });
    console.log("✓ impact-simulation.png");
  }

  await browser.close();
  console.log("\nAll screenshots saved to docs/screenshots/");
}

main().catch(console.error);
