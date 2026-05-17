import { chromium, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://82.202.142.222';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@salon.ru';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const steps = [];
const consoleErrors = [];
const pageErrors = [];

async function step(name, fn) {
  process.stdout.write(`- ${name}... `);
  await fn();
  steps.push(name);
  process.stdout.write('ok\n');
}

async function clickTab(page, name) {
  const byName = page.getByRole('button', { name: new RegExp(name) });
  if (await byName.first().isVisible({ timeout: 1500 }).catch(() => false)) {
    await byName.first().click();
    return;
  }

  const tabIndexes = {
    'Сводка': 0,
    'Записи': 1,
    'Услуги': 2,
    'Мастера': 3,
    'Отзывы': 4,
    'Клиенты': 5,
    'Аккаунты': 6,
    'Лист ожидания': 7,
  };
  const index = tabIndexes[name];
  if (index === undefined) {
    throw new Error(`Unknown tab: ${name}`);
  }
  await page.locator('button[class*="border-b-2"]').nth(index).click();
}

async function closeModal(page) {
  const cancel = page.getByRole('button', { name: 'Отмена' }).last();
  if (await cancel.isVisible()) {
    await cancel.click();
  }
}

async function withDialogs(page, answers, fn) {
  let index = 0;
  const handler = async (dialog) => {
    const answer = answers[index++];
    if (answer === undefined) {
      await dialog.accept();
      return;
    }
    await dialog.accept(answer);
  };

  page.on('dialog', handler);
  try {
    await fn();
  } finally {
    page.off('dialog', handler);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  baseURL: BASE_URL,
});
const page = await context.newPage();

page.on('console', (message) => {
  if (message.type() === 'error') {
    const text = message.text();
    if (!text.includes('401 (Unauthorized)')) {
      consoleErrors.push(text);
    }
  }
});
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await step('admin login', async () => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"], input[type="text"]').last().fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Войти/ }).click();
    await expect(page.getByText('Аналитика салона')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('/ Администратор')).toBeVisible();
  });

  await step('dashboard period switches and chart', async () => {
    await page.getByRole('button', { name: 'Этот месяц' }).click();
    await expect(page.getByText('Динамика выручки')).toBeVisible();
    await page.getByRole('button', { name: 'Этот год' }).click();
    await expect(page.getByText('Загрузка мастеров сегодня')).toBeVisible();
    await page.getByRole('button', { name: 'Эта неделя' }).click();
  });

  await step('bookings filters, CSV and details action', async () => {
    await clickTab(page, 'Записи');
    await expect(page.getByText('Все записи')).toBeVisible();
    await page.getByPlaceholder('Клиент, телефон, услуга, мастер').fill('Дмитрий');
    await expect(page.getByText('Найдено:')).toBeVisible();
    await page.getByPlaceholder('Клиент, телефон, услуга, мастер').fill('');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Скачать отчет CSV/ }).click();
    await downloadPromise;

    const detailButton = page.getByTitle('Детали записи').first();
    if (await detailButton.isVisible()) {
      await withDialogs(page, [''], async () => detailButton.click());
    }
  });

  await step('services add modal opens and closes', async () => {
    await clickTab(page, 'Услуги');
    await expect(page.getByText('Управление услугами')).toBeVisible();
    await page.getByRole('button', { name: /^Добавить$/ }).click();
    await expect(page.getByRole('heading', { name: 'Добавить услугу' })).toBeVisible();
    await closeModal(page);
  });

  await step('masters add modal opens and closes', async () => {
    await clickTab(page, 'Мастера');
    await expect(page.getByText('Управление мастерами')).toBeVisible();
    await page.getByRole('button', { name: /Добавить мастера/ }).click();
    await expect(page.getByRole('heading', { name: 'Добавить мастера' })).toBeVisible();
    await closeModal(page);
  });

  await step('reviews tab renders moderation cards', async () => {
    await clickTab(page, 'Отзывы');
    await expect(page.getByText('Модерация отзывов')).toBeVisible();
  });

  await step('clients CSV, history, contact and promo actions', async () => {
    await clickTab(page, 'Клиенты');
    await expect(page.getByText('База клиентов')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Скачать отчет CSV/ }).click();
    await downloadPromise;

    const historyButton = page.getByTitle('История записей').first();
    if (await historyButton.isVisible()) {
      await withDialogs(page, [''], async () => historyButton.click());
    }

    const contactButton = page.getByTitle('Написать').first();
    if (await contactButton.isVisible()) {
      await withDialogs(page, ['Тестовая тема', 'Тестовое сообщение', ''], async () => contactButton.click());
    }

    const promoButton = page.getByTitle('Отправить промокод').first();
    if (await promoButton.isVisible()) {
      await withDialogs(page, ['TEST10', '10% на тест', 'Тестовый промокод', ''], async () => promoButton.click());
    }
  });

  await step('users tab renders controls without changing current admin', async () => {
    await clickTab(page, 'Аккаунты');
    await expect(page.getByText('Управление аккаунтами')).toBeVisible();
    await expect(page.getByText('Ваш аккаунт')).toBeVisible();
  });

  await step('waitlist tab renders empty or populated state', async () => {
    await clickTab(page, 'Лист ожидания');
    await expect(page.getByRole('heading', { name: 'Лист ожидания' })).toBeVisible();
  });

  await step('mobile viewport keeps admin shell usable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('/ Администратор')).toBeVisible({ timeout: 15000 });
    await clickTab(page, 'Записи');
    await expect(page.getByText('Все записи')).toBeVisible();
  });

  if (pageErrors.length > 0) {
    throw new Error(`Page errors:\n${pageErrors.join('\n')}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors:\n${consoleErrors.join('\n')}`);
  }

  console.log(`\nAdmin smoke passed: ${steps.length} steps`);
} catch (error) {
  await page.screenshot({ path: 'admin-smoke-failure.png', fullPage: true });
  console.error('\nAdmin smoke failed');
  console.error(error);
  console.error('Screenshot: admin-smoke-failure.png');
  process.exitCode = 1;
} finally {
  await browser.close();
}
