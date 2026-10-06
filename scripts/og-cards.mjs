#!/usr/bin/env node
// Renders the share cards into docs/dist/og/ from the built site. Part of `pnpm docs:build`.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}docs/dist/`;
const port = Number(process.env.SCB_OG_PORT ?? 4332);
const base = `http://localhost:${port}/starlight-codeblocks/`;

const font = (path) => readFileSync(`${root}docs/node_modules/@fontsource/${path}`).toString('base64');
const logo = readFileSync(`${root}docs/src/assets/logo.svg`, 'utf8').replace(
  / role="img" aria-label="[^"]*"/,
  ' aria-hidden="true"',
);

// Page ids as Head.astro builds them: the path under dist, with `index` for the home page.
function pages(dir = '') {
  return readdirSync(dist + dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return entry.name === 'index.html' ? [dir.replace(/\/$/, '') || 'index'] : [];
    if (['og', '_astro', 'pagefind', 'examples'].includes(entry.name)) return [];
    return pages(`${dir}${entry.name}/`);
  });
}

const pane = '.example .pane.output';
const block = `${pane} .expressive-code`;

// How each page's shot differs from the default: `sel` picks the element, a wider `width` zooms out,
// `nth` picks a later match, `pad` adds padding, `prep(target, page)` sets a state before the shot, `fit` keeps the whole width in the card,
// and `from` reuses another page's shot.
const shots = {
  'features/code-mentions': {
    sel: block,
    prep: (_, page) => page.locator(pane).first().getByRole('link', { name: 'base case' }).focus(),
  },
  'features/code-tabs': { width: 640 },
  'features/code-walkthrough': { pad: '0 0 24px' },
  'features/expandable-blocks': { width: 640 },
  'features/file-icons': { sel: block },
  'features/footnotes': { width: 640 },
  'features/inline-callouts': { sel: pane, nth: 1 },
  'features/inline-code-highlighting': { pad: '24px 0' },
  'features/line-permalinks': { prep: (target) => target.locator('a.scb-permalink').nth(2).click() },
  'features/open-in-playground': { fit: true },
  'features/run-code': {
    prep: async (target) => {
      await target.locator('.scb-run').first().click();
      await target.locator('.scb-run-stdout').first().waitFor({ timeout: 60_000 });
      await target.evaluate((el) => {
        for (const button of el.querySelectorAll('button.scb-run')) {
          const parent = button.parentElement;
          button.remove();
          if (!parent.children.length) parent.remove();
        }
      });
    },
  },
  'features/scrollycoding': { from: 'features/focus' },
  'features/scrollycoding/wide': { from: 'features/focus' },
  'reference/attributes': { sel: block },
  'reference/directives': { sel: block },
  'reference/themes': {
    sel: '.theme-gallery .card .expressive-code',
    // The gallery is a grid of narrow cards, so keep only the first and let it take the full width.
    prep: (_, page) =>
      page.evaluate(() => {
        for (const card of document.querySelectorAll('.theme-gallery .card + .card')) card.remove();
        document.querySelector('.theme-gallery .cards').style.display = 'block';
      }),
  },
};

// The element that shows the page's feature: the "Readers see" pane of its first example, else its first code block.
async function shoot(context, id) {
  const page = await context.newPage();
  await page.goto(base + (id === 'index' ? '' : `${id}/`), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  const meta = await page.evaluate(() => ({
    title: document.querySelector('h1#_top')?.textContent.trim() ?? document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
  }));
  const {
    sel = `${pane}, .sl-markdown-content .expressive-code`,
    nth = 0,
    width = 480,
    pad,
    prep,
    fit,
    from,
  } = shots[id] ?? {};
  const target = page.locator(sel).nth(nth);
  let shot = null;
  if (id !== 'index' && !from && (await target.count())) {
    // Narrower than the column, so the code reflows and reads larger once the card scales it up.
    await target.evaluate(
      (el, { width, pad }) => {
        el.style.width = `${width}px`;
        el.style.maxWidth = 'none';
        if (pad) el.style.padding = pad;
        el.querySelector(':scope > .label')?.remove();
        // In a side-by-side example, the source pane would take the space beside a wider output pane.
        for (const source of document.querySelectorAll('.example .pane.source')) source.remove();
      },
      { width, pad },
    );
    await target.scrollIntoViewIfNeeded();
    await prep?.(target, page);
    await page.waitForTimeout(300);
    shot = (await target.screenshot({ animations: 'disabled' })).toString('base64');
  }
  await page.close();
  return { id, ...meta, shot, fit, from };
}

const css = `
@font-face { font-family: Michroma; src: url(data:font/woff2;base64,${font('michroma/files/michroma-latin-400-normal.woff2')}); }
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${font('inter/files/inter-latin-400-normal.woff2')}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #fff; font-family: Inter, sans-serif;
  background: radial-gradient(800px 500px at 100% 100%, rgb(91 91 240 / .45), transparent 70%), linear-gradient(135deg, #10132a, #1c1f45); }
.left { position: absolute; left: 72px; top: 72px; bottom: 72px; width: 520px; display: flex; flex-direction: column; z-index: 1; }
.brand { display: flex; align-items: center; gap: 34px; width: 1056px; white-space: nowrap; font: 58px Michroma; color: #e3e5fb; }
.brand svg { width: 115px; flex: none; }
.t { margin-top: auto; font: 54px/1.2 Michroma; letter-spacing: -.01em; }
.d { margin-top: 22px; font-size: 27px; line-height: 1.4; color: #b9bedc; }
.win { position: absolute; border-radius: 12px; overflow: hidden; box-shadow: 0 40px 80px rgb(0 0 0 / .55), 0 0 0 1px #343a6b; }
.win img { display: block; width: 100%; }
.tilt { left: 640px; top: 240px; width: 700px; transform: perspective(1400px) rotateY(-16deg) rotateX(6deg) rotateZ(1deg); }
.tilt.fit { width: 520px; }
.home .left { width: 640px; }
.home .t { font-size: 70px; }
.home .logo { width: 112px; filter: drop-shadow(0 0 28px rgb(255 209 102 / .35)); }
.tiles { position: absolute; left: 330px; top: -300px; display: flex; gap: 14px; align-items: start;
  transform: perspective(3000px) rotateX(38deg) rotateZ(-24deg); transform-origin: 0 0; }
.col { width: 220px; display: flex; flex-direction: column; gap: 14px; }
.col:nth-child(even) { margin-top: 50px; }
.tiles .win { position: relative; max-height: 165px; border-radius: 8px; box-shadow: 0 16px 32px rgb(0 0 0 / .5), 0 0 0 1px #343a6b; }
.shade { position: absolute; inset: 0; background: linear-gradient(90deg, #10132a 0%, #10132a 42%, rgb(16 19 42 / .4) 60%, transparent 80%); }
`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = (shot) => `<img src="data:image/png;base64,${shot}" alt="">`;

function card({ title, description, shot, fit }) {
  const size = title.length <= 16 ? 54 : title.length <= 26 ? 48 : 40;
  return `<div class="left"><div class="brand">${logo}starlight-codeblocks</div><div class="t" style="font-size:${size}px">${esc(title)}</div><div class="d">${esc(description)}</div></div>${shot ? `<div class="win tilt${fit ? ' fit' : ''}">${img(shot)}</div>` : ''}`;
}

function home({ description }, shots) {
  // The other shots repeat to fill a grid larger than the card, so it reads as endless. The first three go
  // in the cells nearest the middle of the card.
  const size = 10;
  const spots = [7 * size, 7 * size + 1, 8 * size];
  const rest = shots.slice(spots.length);
  const cell = (i) => (spots.includes(i) ? shots[spots.indexOf(i)] : rest[i % rest.length]);
  const cols = [...Array(size).keys()].map((c) =>
    [...Array(size).keys()].map((r) => `<div class="win">${img(cell(r * size + c))}</div>`),
  );
  const tiles = cols.map((col) => `<div class="col">${col.join('')}</div>`).join('');
  return `<div class="tiles">${tiles}</div><div class="shade"></div><div class="left"><div class="logo">${logo}</div><div class="t">starlight-<br>codeblocks</div><div class="d">${esc(description)}</div></div>`;
}

const server = spawn(
  'pnpm',
  ['--filter', 'docs', 'exec', 'astro', 'preview', '--port', String(port), '--ignore-lock'],
  {
    cwd: root,
    stdio: 'ignore',
  },
);
try {
  for (let i = 0; !(await fetch(base).catch(() => null))?.ok; i++) {
    if (i > 100) throw new Error('The docs preview server did not start.');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const browser = await chromium.launch();
  const site = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const ids = pages();
  const results = [];
  for (let i = 0; i < ids.length; i += 6)
    results.push(...(await Promise.all(ids.slice(i, i + 6).map((id) => shoot(site, id)))));

  // Feature pages fill the home page wall: these three first, then the rest in sidebar order.
  const { sidebar } = await import(`${root}docs/src/sidebar.mjs`);
  const order = sidebar.flatMap((group) => group.items).filter((item) => typeof item === 'string');
  const byId = new Map(results.map((r) => [r.id, r]));
  for (const r of results) if (r.from) r.shot = byId.get(r.from)?.shot;
  const first = ['features/focus', 'comment-notation', 'features/code-tabs'];
  const wall = [...new Set([...first, ...order.filter((id) => id.startsWith('features/'))])]
    .map((id) => byId.get(id)?.shot)
    .filter(Boolean);

  const cards = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await cards.newPage();
  // Pages without code show the configuration block.
  const fallback = byId.get('configuration')?.shot;
  for (const r of results) {
    r.shot ??= fallback;
    const body = r.id === 'index' ? home(r, wall) : card(r);
    await page.setContent(
      `<!doctype html><html><head><style>${css}</style></head><body class="${r.id === 'index' ? 'home' : ''}">${body}</body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    const file = `${dist}og/${r.id}.png`;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await page.screenshot());
  }
  await browser.close();
  console.log(`Rendered ${results.length} share cards into docs/dist/og/.`);
} finally {
  server.kill();
}
