#!/usr/bin/env node
// Captures the README images from the built docs site: `pnpm readme:media [slug...]`.
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}.github/assets/readme/`;
const port = 4331;
const base = `http://localhost:${port}/starlight-codeblocks/`;
const scale = 2;
const pad = 20;
const width = 1280;
const height = 1100;

const pane = (page, n = 0) => page.locator('.example').nth(n).locator('.pane').nth(1);
const block = (page) => pane(page).locator('.expressive-code').first();

// `run` gets the page and a recorder (see `recorder`). A feature without `run` is a still image.
const features = [
  {
    slug: 'focus',
    run: async (page, rec) => {
      await rec.hold(1500);
      await rec.point(block(page).locator('pre'));
      await rec.hold(1800);
      await rec.leave();
      await rec.hold(1200);
    },
  },
  { slug: 'line-states' },
  { slug: 'comment-notation' },
  { slug: 'inline-callouts' },
  {
    slug: 'annotations',
    run: async (page, rec) => {
      const markers = block(page).locator('.scb-annotation-marker, [aria-label^="Annotation"]');
      await rec.hold(1000);
      await rec.click(markers.nth(0));
      await rec.include(block(page).locator('.scb-annotation-popover').first());
      await rec.hold(1800);
      await rec.click(markers.nth(1));
      await rec.include(block(page).locator('.scb-annotation-popover').nth(1));
      await rec.hold(1800);
    },
  },
  {
    slug: 'footnotes',
    run: async (page, rec) => {
      await rec.hold(1000);
      for (const n of ['1', '2']) {
        await rec.click(block(page).getByRole('link', { name: `Footnote ${n}`, exact: true }));
        await rec.hold(1500);
      }
    },
  },
  {
    slug: 'hidden-lines',
    run: async (page, rec) => {
      await rec.hold(1200);
      await rec.click(block(page).locator('.scb-hidden-marker').first());
      await rec.hold(1800);
      await rec.include(block(page));
      await rec.click(block(page).locator('.scb-hidden-marker').first());
      await rec.hold(1000);
    },
  },
  {
    slug: 'smart-shell-copy',
    run: async (page, rec) => {
      const button = block(page).locator('.copy button');
      await rec.hold(1200);
      await rec.click(button);
      await rec.include(block(page).locator('.copy .feedback'));
      await rec.hold(1600);
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      await block(page).evaluate((el, text) => {
        const box = document.createElement('aside');
        box.className = 'starlight-aside starlight-aside--tip scb-readme-copied';
        box.setAttribute('aria-label', 'Copied to clipboard');
        box.style.marginTop = '0.75rem';
        box.innerHTML =
          '<p class="starlight-aside__title" aria-hidden="true">Copied to clipboard</p>' +
          '<div class="starlight-aside__content"><pre style="margin:0;white-space:pre-wrap;font:inherit"></pre></div>';
        box.querySelector('pre').textContent = text;
        el.after(box);
      }, copied);
      await rec.include(page.locator('.scb-readme-copied'));
      await rec.hold(2400);
    },
  },
  { slug: 'word-level-diff' },
  { slug: 'visible-whitespace' },
  { slug: 'colourised-brackets' },
  { slug: 'token-links' },
  {
    slug: 'api-auto-linking',
    run: async (page, rec) => {
      const link = block(page).locator('a.scb-api-link').nth(3);
      await rec.hold(1000);
      await rec.point(link);
      await page.locator('.scb-api-card').first().waitFor({ state: 'visible' });
      await rec.include(page.locator('.scb-api-card').first());
      await rec.hold(2500);
    },
  },
  {
    slug: 'expandable-blocks',
    run: async (page, rec) => {
      const button = block(page).locator('.scb-expandable-toggle');
      await rec.hold(1200);
      await rec.click(button);
      await rec.hold(2200);
      await rec.include(block(page));
    },
  },
  { slug: 'open-in-playground' },
  {
    slug: 'code-mentions',
    run: async (page, rec) => {
      await rec.hold(1000);
      await rec.point(pane(page).getByRole('link', { name: 'base case' }));
      await rec.hold(1600);
      await rec.point(pane(page).getByRole('link', { name: 'recursive step' }));
      await rec.hold(1600);
    },
  },
  {
    slug: 'line-permalinks',
    run: async (page, rec) => {
      const numbers = block(page).locator('a.scb-permalink');
      await rec.hold(1000);
      await rec.click(numbers.nth(3));
      await rec.hold(1200);
      await page.keyboard.down('Shift');
      await rec.click(numbers.nth(5));
      await page.keyboard.up('Shift');
      await rec.hold(1800);
    },
  },
  {
    slug: 'fill-in-placeholders',
    run: async (page, rec) => {
      await rec.hold(1000);
      await rec.click(pane(page).getByRole('textbox', { name: 'YOUR_TOKEN' }).first());
      for (const key of 'tok_3f9a21') {
        await page.keyboard.type(key);
        await rec.hold(110);
      }
      await rec.hold(1800);
    },
  },
  {
    slug: 'code-switcher',
    run: async (page, rec) => {
      await page.locator('[data-scb-code-switcher]:not([data-scb-ready])').waitFor({ state: 'detached' });
      const menu = () => pane(page).locator('.scb-switcher > .expressive-code:visible').getByRole('combobox');
      await rec.hold(1200);
      await rec.point(menu());
      for (const label of ['pnpm', 'Yarn']) {
        await menu().selectOption({ label });
        await rec.hold(1400);
      }
    },
  },
  {
    slug: 'token-transitions',
    run: async (page, rec) => {
      const next = () =>
        pane(page).locator('[data-scb-steps] > .expressive-code:visible').getByRole('button', { name: 'Next' });
      await rec.hold(1200);
      for (let i = 0; i < 2; i++) {
        await rec.click(next());
        await rec.hold(1800);
      }
      await rec.include(pane(page));
    },
  },
  {
    slug: 'scrollycoding',
    viewport: 640,
    run: async (page, rec) => {
      await rec.hold(1000);
      for (let i = 0; i < 3; i++) {
        for (let s = 0; s < 9; s++) {
          await page.mouse.wheel(0, 25);
          await rec.hold(30);
        }
        await rec.hold(900);
      }
    },
  },
  { slug: 'side-by-side-annotations' },
  { slug: 'inline-code-highlighting' },
  {
    slug: 'run-in-the-browser',
    run: async (page, rec) => {
      await rec.hold(1000);
      await rec.click(block(page).locator('.scb-run'));
      await block(page).locator('.scb-run-stdout').waitFor({ timeout: 60_000 });
      await rec.include(block(page));
      await rec.hold(2000);
    },
  },
];

const cursorScript = () => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;z-index:99999;pointer-events:none;';
    document.body.append(c);
    addEventListener('mousemove', (e) => {
      c.style.left = `${e.clientX - 3}px`;
      c.style.top = `${e.clientY - 2}px`;
    });
  });
};

async function rect(locator) {
  return locator.evaluate((el) => {
    const kids = el.matches('.pane') ? [...el.children].filter((k) => !k.classList.contains('label')) : [el];
    const r = kids.map((k) => k.getBoundingClientRect()).filter((b) => b.width && b.height);
    return {
      x: Math.min(...r.map((b) => b.left)),
      y: Math.min(...r.map((b) => b.top)),
      right: Math.max(...r.map((b) => b.right)),
      bottom: Math.max(...r.map((b) => b.bottom)),
    };
  });
}

const union = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  right: Math.max(a.right, b.right),
  bottom: Math.max(a.bottom, b.bottom),
});

function recorder(page, start, grab, include = async () => {}) {
  let at = start;
  const rec = {
    include,
    hold: async (ms) => {
      const until = Date.now() + ms;
      do await grab();
      while (Date.now() < until);
    },
    move: async (x, y) => {
      const from = at;
      at = { x, y };
      for (let i = 1; i <= 15; i++) {
        await page.mouse.move(from.x + ((x - from.x) * i) / 15, from.y + ((y - from.y) * i) / 15);
        await grab();
      }
    },
    leave: () => rec.move(start.x, start.y),
    point: async (locator) => {
      const box = await locator.boundingBox();
      await rec.move(box.x + box.width / 2, box.y + box.height / 2);
    },
    click: async (locator) => {
      await rec.point(locator);
      await page.mouse.down();
      await page.mouse.up();
    },
  };
  return rec;
}

async function open(context, feature) {
  const page = await context.newPage();
  if (feature.run) await page.addInitScript(cursorScript);
  await page.goto(`${base}features/${feature.slug}/`);
  await page.evaluate(() => document.fonts.ready);
  await pane(page).evaluate((el) => {
    const example = el.closest('.example');
    for (let next = example.nextElementSibling; next; next = next.nextElementSibling) next.style.visibility = 'hidden';
    for (const aside of document.querySelectorAll('.right-sidebar-container')) aside.style.visibility = 'hidden';
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100);
  });
  const r = await rect(pane(page));
  const h = page.viewportSize().height;
  const start = { x: Math.min(width - 5, r.right + pad + 15), y: Math.min(h - 5, r.bottom + pad + 15) };
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(500);
  return { page, start };
}

async function capture(browser, feature) {
  const fresh = async () => {
    const context = await browser.newContext({
      viewport: { width, height: feature.viewport ?? height },
      deviceScaleFactor: scale,
      colorScheme: 'dark',
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    return context;
  };
  let context = await fresh();
  let { page, start } = await open(context, feature);
  let area = await rect(pane(page));
  // A scrolling feature records the whole viewport under the page header.
  if (feature.viewport) {
    const header = await page.locator('header.header').boundingBox();
    area = { ...area, y: header.height + pad + 24, bottom: feature.viewport };
  }

  // A dry run finds the area that popovers and expanded blocks reach, so the recording can use one fixed clip.
  if (feature.run) {
    const grab = () => page.waitForTimeout(40);
    await feature.run(
      page,
      recorder(page, start, grab, async (locator) => {
        area = union(area, await rect(locator));
      }),
    );
    // Features such as placeholders keep state in storage, so the recording starts in a new context.
    await context.close();
    context = await fresh();
    ({ page, start } = await open(context, feature));
  }

  const x = Math.max(0, Math.floor(area.x - pad));
  const y = Math.max(0, Math.floor(area.y - pad));
  const clip = {
    x,
    y,
    width: Math.ceil(area.right + pad) - x,
    height: Math.min(page.viewportSize().height, Math.ceil(area.bottom + pad)) - y,
  };
  const shot = () => page.screenshot({ clip });

  if (!feature.run) {
    await save(feature, [{ data: await shot(), ms: 0 }]);
  } else {
    const frames = [];
    const grab = async () => {
      const t = Date.now();
      frames.push({ data: await shot(), t });
    };
    await feature.run(page, recorder(page, start, grab));
    await grab();
    frames.forEach((f, i) => {
      f.ms = (frames[i + 1]?.t ?? f.t) - f.t;
    });
    await save(feature, frames);
  }
  await context.close();
}

async function save(feature, frames) {
  let file;
  if (frames.length === 1) {
    file = `${out}${feature.slug}.png`;
    await sharp(frames[0].data).png({ compressionLevel: 9, palette: true, quality: 95, effort: 10 }).toFile(file);
  } else {
    const kept = [];
    for (const f of frames) {
      const last = kept.at(-1);
      if (last?.data.equals(f.data)) last.ms += f.ms;
      else kept.push({ ...f });
    }
    kept.at(-1).ms += 1500;
    file = `${out}${feature.slug}.webp`;
    await sharp(
      kept.map((f) => f.data),
      { join: { animated: true } },
    )
      .webp({ quality: 85, effort: 6, loop: 0, delay: kept.map((f) => Math.max(20, f.ms)) })
      .toFile(file);
    const avg = Math.round((frames.at(-1).t - frames[0].t) / frames.length);
    console.log(`  ${frames.length} frames, ${kept.length} kept, ${avg} ms per frame`);
  }
  console.log(`${file.slice(root.length)}  ${Math.round(statSync(file).size / 1024)} kB`);
}

const only = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = spawn(
  'pnpm',
  ['--filter', 'docs', 'exec', 'astro', 'preview', '--port', String(port), '--ignore-lock'],
  {
    cwd: root,
    stdio: 'ignore',
  },
);
try {
  for (let i = 0; ; i++) {
    if ((await fetch(base).catch(() => null))?.ok) break;
    if (i > 100) throw new Error('The docs preview server did not start. Run `pnpm docs:build` first.');
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch();
  for (const feature of features) if (!only.length || only.includes(feature.slug)) await capture(browser, feature);
  await browser.close();
} finally {
  server.kill();
}
