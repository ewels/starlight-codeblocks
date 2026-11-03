import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const fixture = join(import.meta.dirname, 'fixtures/i18n-site');
const read = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/&(?:quot|#x22);/g, '"')
    .replace(/&(?:amp|#x26);/g, '&');

// A real Starlight build, because only Starlight gives the plugin each page's language and the site's translations.
test('a Starlight site gives each page the texts of its language, with its own texts first', {
  timeout: 120_000,
}, () => {
  const out = mkdtempSync(join(tmpdir(), 'scb-i18n-'));
  const astro = join(import.meta.dirname, '../node_modules/.bin/astro');
  const log = execFileSync(astro, ['build', '--root', fixture, '--outDir', out], { encoding: 'utf8' });
  // Vite warns about a directive in Astro's own MDX output, which is not the plugin's.
  const warnings = log
    .split('\n')
    .filter((line) => line.includes('[WARN]') && !line.includes('MODULE_LEVEL_DIRECTIVE'));
  expect(warnings).toEqual([]);
  const [en, de, pt] = ['index.html', 'de/index.html', 'pt/index.html'].map((page) => read(join(out, page)));
  rmSync(out, { recursive: true, force: true });
  const mark = (label: string) =>
    `<span class="scb-state-prefix scb-sr-only scb-deco" data-pagefind-ignore="">${label}:</span>No rule`;

  // The site's de.json first, then the bundled German.
  expect(de).toContain('<span>2 versteckte Zeilen</span>');
  expect(de).toContain('data-scb-texts="{"closed":"2 versteckte Zeilen","open":"2 Zeilen verbergen"}"');
  expect(de).toContain('data-scb-run-again="Erneut ausführen">Code starten</button>');
  expect(de).toContain('{"output":"Ausgabe","running":"Wird ausgeführt…","error":"Fehler: "}');
  expect(de).toContain(mark('Fehler'));
  expect(de).toContain('>Befehle kopieren</button>');
  expect(de).toContain('data-scb-labels="["Klartext","JavaScript"]"');
  expect(de).toContain('<span class="scb-steps-count">Schritt 1/2</span>');
  expect(de).toContain('aria-label="Schritt 1: Erste & <Zweite>"');
  expect(de).toContain('aria-label="Schritt 2"');
  expect(de).toContain('aria-label="Zurück"');

  // A `pt` locale, with no texts of its own, gets the bundled Portuguese.
  expect(pt).toContain('<html lang="pt"');
  expect(pt).toContain('<span>2 linhas ocultas</span>');
  expect(pt).toContain('data-scb-run-again="Executar novamente">Executar código</button>');
  expect(pt).toContain(mark('Erro'));
  expect(pt).toContain('<span class="scb-steps-count">Etapa 1 de 2</span>');
  expect(pt).toContain('aria-label="Anterior"');

  expect(en).toContain('<span>2 hidden lines</span>');
  expect(en).toContain('>Run code</button>');
  expect(en).toContain('>Copy commands</button>');
  expect(en).toContain(mark('Error'));
  expect(en).toContain('<span class="scb-steps-count">Step 1 of 2</span>');
});
