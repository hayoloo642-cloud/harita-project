const { test, expect } = require('@playwright/test');

test('semua view bisa dibuka tanpa JS error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/?nosw=1', { waitUntil: 'networkidle' });

  // registrasi pertama (DB segar); kalau akun sudah ada (mis. app.spec.js
  // jalan lebih dulu dengan data terbagi), masuk dengan kredensial yang sama
  await page.fill('#authName', 'E2E Test');
  await page.fill('#authPassword', 'e2e-test-password');
  if (await page.locator('#authConfirmWrap:visible').count() > 0) {
    await page.fill('#authConfirm', 'e2e-test-password');
  }
  await page.click('#authSubmit');
  await expect(page.locator('#splash')).toBeHidden({ timeout: 20_000 });

  await page.waitForTimeout(800); // beri waktu onboarding tampil setelah splash hilang

  // selesaikan onboarding (tombol semua ada di DOM, target yang visible saja)
  const overlay = page.locator('#onboardOverlay');
  if (await overlay.isVisible().catch(() => false)) {
    const next = overlay.locator('[data-onboard-next]:visible');
    for (let i = 0; i < 3; i += 1) {
      if (await next.count() === 0) break;
      await next.first().click();
      await page.waitForTimeout(200);
    }
    const finish = overlay.locator('#onboardFinish:visible');
    if (await finish.count() > 0) await finish.first().click();
    await overlay.waitFor({ state: 'hidden', timeout: 5000 });
  }

  await expect(page.locator('#view-beranda')).toHaveClass(/active/);

  const views = ['tugas', 'kalender', 'fokus', 'catatan', 'jadwal', 'nilai', 'flashcard', 'lomba', 'pengeluaran', 'streak', 'music', 'beranda'];
  for (const view of views) {
    await page.click(`.nav-item[data-view="${view}"]`);
    await page.waitForTimeout(350);
    await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
  }

  // pengaturan + command palette
  await page.click('#openSettings');
  await page.waitForTimeout(300);
  await expect(page.locator('#modalOverlay:not([hidden])')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  const palette = page.locator('#paletteOverlay, .palette-overlay').first();
  await expect(palette).toBeVisible();
  await page.keyboard.press('Escape');

  // navigasi langsung ke view tanpa tombol sidebar via hash (beranda)
  await page.goto('/?nosw=1#cuaca', { waitUntil: 'networkidle' });
  await expect(page.locator('#view-cuaca')).toHaveClass(/active/);

  await page.goto('/?nosw=1#device', { waitUntil: 'networkidle' });
  await expect(page.locator('#view-device')).toHaveClass(/active/);

  expect(errors).toEqual([]);
});
