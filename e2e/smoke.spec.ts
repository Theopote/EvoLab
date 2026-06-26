import { expect, test } from "@playwright/test";

test.describe("launcher smoke", () => {
  test("loads the home page and navigates to workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "EvoLab" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "从哪里开始？" })).toBeVisible();
    await expect(page.getByRole("link", { name: /项目工作台/ })).toBeVisible();

    await page.getByRole("link", { name: /项目工作台/ }).click();
    await expect(page).toHaveURL(/\/workspace$/);
  });
});

test.describe("workspace smoke", () => {
  test("opens workspace shell", async ({ page }) => {
    await page.goto("/workspace");

    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/EvoLab|工作台|方案|场地/i).first()).toBeVisible();
  });
});
