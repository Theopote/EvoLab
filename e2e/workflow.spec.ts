import { expect, test } from "@playwright/test";

test.describe("core design workflow", () => {
  test("draw outline, generate plans, switch version, and export project json", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/workspace");

    await page.getByRole("button", { name: "场地" }).click();
    await expect(page.getByRole("heading", { name: "Draw Outline" })).toBeVisible();

    const canvas = page.locator('section:has-text("Draw Outline") svg').first();
    const box = await canvas.boundingBox();

    expect(box).toBeTruthy();

    const clickAt = async (xRatio: number, yRatio: number) => {
      await page.mouse.click(box!.x + box!.width * xRatio, box!.y + box!.height * yRatio);
    };

    await clickAt(0.2, 0.25);
    await clickAt(0.75, 0.25);
    await clickAt(0.75, 0.7);
    await clickAt(0.2, 0.7);

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "任务书" }).click();
    await expect(page.getByRole("heading", { name: "Plan Options" })).toBeVisible();

    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByRole("button", { name: "Set Active" }).first()).toBeVisible({ timeout: 90_000 });

    const activeButtons = page.getByRole("button", { name: "Set Active" });
    if ((await activeButtons.count()) > 1) {
      await activeButtons.nth(1).click();
      await expect(page.getByText("Active").first()).toBeVisible();
    }

    await page.getByRole("button", { name: "交付" }).click();
    await expect(page.getByRole("heading", { name: "Export Center" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "ProjectData JSON" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/i);
  });
});
