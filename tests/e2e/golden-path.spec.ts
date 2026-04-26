import { expect, test } from "@playwright/test";

// Golden path: hero → search → flyTo → panel → concerns → horizon switch.
// Runs against the dev server (gracefully degrades to local gazetteer + stub LLM
// when no Google / Anthropic keys are set).

test("golden path: 321 Church St → panel streams concerns at 10y → switch to 15y", async ({ page }) => {
  // 1. Land on hero
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Theami", level: 1 })).toBeVisible();
  const search = page.getByPlaceholder(/Search any San Francisco/i);
  await expect(search).toBeVisible();

  // 2. Type, pick suggestion
  await search.fill("321 Church");
  // Suggestion list rendered as listbox
  const option = page.getByRole("option", { name: /321 Church St/i });
  await expect(option).toBeVisible();
  await option.click();

  // 3. Panel slides in with the address heading
  await expect(page.getByRole("heading", { level: 2, name: /321 Church St/i })).toBeVisible();

  // 4. Horizon defaults to 10y
  const tenY = page.getByRole("radio", { name: /10\s*y/i });
  await expect(tenY).toBeChecked();

  // 5. Headline streams in
  await expect(page.getByRole("heading", { level: 3 })).toBeVisible({ timeout: 15_000 });

  // 6. URL reflects state
  const url = page.url();
  expect(url).toContain("lat=37.766");
  expect(url).toContain("h=10");

  // 7. Concerns list contains alerts and favors with sources
  const sourceLink = page.getByRole("link", { name: /California Geological Survey/i });
  await expect(sourceLink).toBeVisible();

  // 8. Switch to 15y horizon — URL updates, summary refetches
  await page.getByRole("radio", { name: /15\s*y/i }).click();
  await expect(page).toHaveURL(/h=15/);

  // 9. Close panel
  await page.getByRole("button", { name: /Close panel/i }).click();
  await expect(page.getByRole("heading", { name: "Theami", level: 1 })).toBeVisible();
});

test("about page renders methodology + sources", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: /About Theami/i, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sources/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Disclaimer/i })).toBeVisible();
});

test("compare view renders 3 addresses side by side", async ({ page }) => {
  const addrs = "37.76650,-122.42940,10|37.77830,-122.44250,10|37.80220,-122.43780,10";
  await page.goto(`/compare?addrs=${encodeURIComponent(addrs)}`);
  await expect(page.getByRole("heading", { name: /^Compare$/i, level: 1 })).toBeVisible();
  // Three cards
  await expect(page.locator("article")).toHaveCount(3, { timeout: 15_000 });
});

test("out-of-SF point returns no concerns from /api/concerns", async ({ request }) => {
  // Berkeley
  const res = await request.get("/api/concerns?lat=37.8716&lng=-122.2727&horizon=10");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { concerns: unknown[] };
  expect(body.concerns).toEqual([]);
});
