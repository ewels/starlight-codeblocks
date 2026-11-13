interface Style {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

/** Escape sequences that are not colours, such as cursor moves and OSC 8 links: their text stays, the codes go. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: escape codes start with the escape character.
const OTHER = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[\d;?]*[A-Za-ln-z]|\x1b[()][\dA-Z]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: escape codes start with the escape character.
const SGR = /\x1b\[([\d;]*)m/;

const level = (v: number) => (v ? 55 + v * 40 : 0);

/** A colour of the 256-colour palette. The first 16 come from the theme, through the panel's variables. */
function palette(n: number) {
  if (n < 16) return `var(--scb-ansi-${n})`;
  if (n > 231) return `rgb(${Array(3).fill(8 + 10 * (n - 232))})`;
  const c = n - 16;
  return `rgb(${level(Math.floor(c / 36))},${level(Math.floor(c / 6) % 6)},${level(c % 6)})`;
}

/** Reads an extended colour (`5;n` or `2;r;g;b`) from `codes`, and removes it. */
function extended(codes: number[]) {
  const mode = codes.shift();
  if (mode === 5) return palette(codes.shift() ?? 0);
  if (mode === 2) return `rgb(${codes.splice(0, 3).join(',')})`;
}

function apply(style: Style, params: string) {
  const codes = params ? params.split(';').map(Number) : [0];
  while (codes.length) {
    const code = codes.shift() as number;
    if (code === 0) for (const key of Object.keys(style)) delete style[key as keyof Style];
    else if (code === 1) style.bold = true;
    else if (code === 2) style.dim = true;
    else if (code === 3) style.italic = true;
    else if (code === 4) style.underline = true;
    else if (code === 9) style.strike = true;
    else if (code === 22) style.bold = style.dim = false;
    else if (code === 23) style.italic = false;
    else if (code === 24) style.underline = false;
    else if (code === 29) style.strike = false;
    else if (code >= 30 && code <= 37) style.fg = palette(code - 30);
    else if (code >= 90 && code <= 97) style.fg = palette(code - 82);
    else if (code === 38) style.fg = extended(codes);
    else if (code === 39) style.fg = undefined;
    else if (code >= 40 && code <= 47) style.bg = palette(code - 40);
    else if (code >= 100 && code <= 107) style.bg = palette(code - 92);
    else if (code === 48) style.bg = extended(codes);
    else if (code === 49) style.bg = undefined;
  }
}

/**
 * The text of `output` with its ANSI colours and styles as spans. Dim text takes the muted colour. A background is a
 * light tint of its colour, as line states are, so text in the theme colours stays readable on it in every theme.
 */
export function ansiNodes(output: string): DocumentFragment {
  const nodes = document.createDocumentFragment();
  const style: Style = {};
  for (const [i, text] of output.replace(OTHER, '').split(SGR).entries()) {
    if (i % 2) {
      apply(style, text);
      continue;
    }
    if (!text) continue;
    const { fg, bg, bold, dim, italic, underline, strike } = style;
    if (!fg && !bg && !bold && !dim && !italic && !underline && !strike) {
      nodes.append(text);
      continue;
    }
    const span = document.createElement('span');
    span.textContent = text;
    span.style.color = fg ?? (dim ? 'var(--scb-ansi-dim)' : '');
    if (bg) span.style.backgroundColor = `color-mix(in srgb, ${bg} 16%, transparent)`;
    if (bold) span.style.fontWeight = '700';
    if (italic) span.style.fontStyle = 'italic';
    span.style.textDecorationLine = [underline && 'underline', strike && 'line-through'].filter(Boolean).join(' ');
    nodes.append(span);
  }
  return nodes;
}
