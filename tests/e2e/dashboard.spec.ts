import { expect, test } from "@playwright/test";

test.describe("StockPilot dashboard", () => {
  test("shows the inventory overview metrics", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Here's what's happening")).toBeVisible();
    await expect(page.getByText("Products", { exact: true })).toBeVisible();
    await expect(page.getByText("Units in stock")).toBeVisible();
    await expect(page.getByText("Low stock", { exact: true })).toBeVisible();
  });

  test("inventory lists products and SKUs", async ({ page }) => {
    await page.goto("/inventory");
    await expect(
      page.getByRole("heading", { name: "Inventory" }),
    ).toBeVisible();
    await expect(page.getByText("Vanilla Dream")).toBeVisible();
    await expect(page.getByText("TCS-CAN-001")).toBeVisible();
  });

  test("inventory adjust opens a modal with a sync action", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "Adjust" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Add units")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Save & sync" }),
    ).toBeVisible();
  });
});
