// End-to-end smoke tests for MyAct (CommonJS so `node --check` works).
// These tests only use the running UI/API and never modify application code.

const { test, expect } = require('@playwright/test');

// The suite shares a single isolated SQLite database. Run serially so tests
// cannot race on task lists or the onboarding flag.
test.describe.configure({ mode: 'serial' });

const APP_URL = '/?nosw=1';

async function dismissOnboarding(page) {
  const overlay = page.locator('#onboardOverlay');
  if (!(await overlay.isVisible().catch(() => false))) return;

  // Step 1 -> 2 -> 3, then finish. Fresh databases show this once.
  const next = page.locator('#onboardOverlay [data-onboard-next]');
  for (let i = 0; i < 3; i += 1) {
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }

  const finish = page.locator('#onboardFinish');
  if (await finish.isVisible().catch(() => false)) {
    await finish.click();
  }
  await expect(overlay).toBeHidden();
}

async function gotoApp(page) {
  await page.goto(APP_URL);
  await expect(page.locator('#splash')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#crashOverlay')).toBeHidden();
  await dismissOnboarding(page);
}

async function openView(page, view) {
  await page.locator(`.nav-item[data-view="${view}"]`).click();
  await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
  await expect(page.locator(`#view-${view}`)).toBeVisible();
}

async function addQuickTask(page, title) {
  const input = page.locator('#quickAddInput');
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press('Enter');
  await expect(page.locator('#taskList .task-item').filter({ hasText: title })).toBeVisible();
}

test('boot: splash hides, beranda is active, no crash overlay', async ({ page }) => {
  await page.goto(APP_URL);

  await expect(page.locator('#splash')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#view-beranda')).toBeVisible();
  await expect(page.locator('#view-beranda')).toHaveClass(/active/);
  await expect(page.locator('#crashOverlay')).toBeHidden();
});

test('navigation: sidebar switches representative views', async ({ page }) => {
  await gotoApp(page);

  const views = ['tugas', 'kalender', 'lomba', 'catatan', 'jadwal', 'music'];
  for (const view of views) {
    await openView(page, view);
    // Exactly one view should be active at a time.
    await expect(page.locator('.view.active')).toHaveCount(1);
  }
});

test('task CRUD: create, toggle done, then delete through confirm dialog', async ({ page }) => {
  await gotoApp(page);
  await openView(page, 'tugas');

  const title = `E2E CRUD ${Date.now()}`;
  await addQuickTask(page, title);

  const row = page.locator('#taskList .task-item').filter({ hasText: title });
  await expect(row).toBeVisible();

  // Toggle complete and verify both the visual class and the ARIA/data state.
  await row.locator('[data-task-toggle]').click();
  await expect(row).toHaveClass(/done/);
  await expect(row.locator('[data-task-toggle]')).toHaveAttribute('data-done', '1');
  await expect(row.locator('[data-task-toggle]')).toHaveAttribute(
    'aria-label',
    'Tandai belum selesai'
  );

  // Delete via the trash button and confirm inside the shared modal.
  await row.locator('[data-task-del]').click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await expect(page.locator('#modalTitle')).toHaveText('Hapus tugas?');
  await page.locator('#modalSubmit').click();

  await expect(row).toHaveCount(0);
  await expect(page.locator('#modalOverlay')).toBeHidden();
});

test('search: non-matching tasks are filtered out', async ({ page }) => {
  await gotoApp(page);
  await openView(page, 'tugas');

  const stamp = Date.now();
  const alpha = `E2E Search Alpha ${stamp}`;
  const beta = `E2E Search Beta ${stamp}`;

  await addQuickTask(page, alpha);
  await addQuickTask(page, beta);

  const alphaRow = page.locator('#taskList .task-item').filter({ hasText: alpha });
  const betaRow = page.locator('#taskList .task-item').filter({ hasText: beta });

  await page.locator('#taskSearch').fill('Search Alpha');
  await expect(alphaRow).toBeVisible();
  await expect(betaRow).toHaveCount(0);

  // Clear the query so the list can be cleaned up through the API.
  await page.locator('#taskSearch').fill('');
  await expect(betaRow).toBeVisible();

  const bootstrapRes = await page.request.get('/api/bootstrap');
  const { today } = await bootstrapRes.json();
  const tasksRes = await page.request.get(`/api/tasks?date=${encodeURIComponent(today)}`);
  const { tasks } = await tasksRes.json();
  for (const task of tasks.filter((t) => t.title === alpha || t.title === beta)) {
    await page.request.delete(`/api/tasks/${task.id}`);
  }
});

test('command palette: Ctrl+K opens, filters, Escape closes', async ({ page }) => {
  await gotoApp(page);

  await page.keyboard.press('Control+K');
  await expect(page.locator('#paletteOverlay')).toBeVisible();
  await expect(page.locator('#paletteInput')).toBeVisible();

  await page.locator('#paletteInput').fill('beranda');
  await expect(
    page.locator('#paletteList .palette-item').filter({ hasText: 'Beranda' })
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#paletteOverlay')).toBeHidden();
});

test('settings: modal opens with Pengaturan and closes via Batal', async ({ page }) => {
  await gotoApp(page);

  await page.evaluate(() => window.openSettingsModal());
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await expect(page.locator('#modalTitle')).toHaveText('Pengaturan');
  await expect(page.locator('#modalOverlay')).toContainText('Pengaturan');

  await page.locator('#modalCancel').click();
  await expect(page.locator('#modalOverlay')).toBeHidden();
});
