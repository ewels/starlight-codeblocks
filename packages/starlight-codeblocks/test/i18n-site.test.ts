import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const fixture = join(import.meta.dirname, 'fixtures/i18n-site');
const read = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/&(?:quot|#x22);/g, '"')
    .replace(/&(?:amp|#x26);/g, '&');

// A real Starlight build, because only Starlight gives the plugin each page's language and the site's translations.
test('a Starlight site with two locales gives each page the texts of its language', { timeout: 120_000 }, () => {
  const out = mkdtempSync(join(tmpdir(), 'scb-i18n-'));
  const astro = join(import.meta.dirname, '../node_modules/.bin/astro');
  const log = execFileSync(astro, ['build', '--root', fixture, '--outDir', out], { encoding: 'utf8' });
  // Vite warns about a directive in Astro's own MDX output, which is not the plugin's.
  const warnings = log
    .split('\n')
    .filter((line) => line.includes('[WARN]') && !line.includes('MODULE_LEVEL_DIRECTIVE'));
  expect(warnings).toEqual([]);
  const de = read(join(out, 'de/index.html'));
  const en = read(join(out, 'index.html'));

  expect(de).toContain('<span>2 verborgene Zeilen</span>');
  expect(de).toContain('data-scb-texts="{"closed":"2 verborgene Zeilen","open":"Hide 2 lines"}"');
  expect(de).toContain('>Code ausführen</button>');
  expect(de).toContain('{"output":"Ausgabe","running":"Running…","error":"Error: "}');
  expect(de).toContain('>Befehle kopieren</button>');
  expect(de).toContain('data-scb-labels="["Klartext","JavaScript"]"');
  expect(de).toContain('<span class="scb-steps-count">Schritt 1 von 2</span>');
  expect(de).toContain('aria-label="Schritt 1: Erste & <Zweite>"');
  expect(de).toContain('aria-label="Step 2"');

  expect(en).toContain('<span>2 hidden lines</span>');
  expect(en).toContain('>Run code</button>');
  expect(en).toContain('>Copy commands</button>');
  expect(en).toContain('<span class="scb-steps-count">Step 1 of 2</span>');
});
