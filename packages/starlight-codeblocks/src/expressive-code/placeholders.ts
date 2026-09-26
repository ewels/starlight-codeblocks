import { type AnnotationRenderOptions, AttachedPluginData, ExpressiveCodeAnnotation } from '@expressive-code/core';
import { type Element, type ElementContent, h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CodeblocksPlugin, warn } from './core.ts';
import { PREFIX } from './styles.ts';

type Node = AnnotationRenderOptions['nodesToTransform'][number];

/** The first syntax token span in a node, whose colour the field takes. */
function tokenStyle(node: Node): string | undefined {
  if (node.type === 'element' && typeof node.properties.style === 'string') return node.properties.style;
  if (node.type !== 'element' && node.type !== 'root') return undefined;
  for (const child of node.children) {
    const style = tokenStyle(child as Node);
    if (style) return style;
  }
  return undefined;
}

class PlaceholderAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly text: string,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    super({ inlineRange });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    const style = nodesToTransform.map(tokenStyle).find(Boolean);
    const input = h('input', {
      type: 'text',
      class: `${PREFIX}-placeholder`,
      dataPh: this.text,
      placeholder: this.text,
      ariaLabel: this.text,
      spellcheck: 'false',
      autocomplete: 'off',
      style: `width: ${this.text.length}ch`,
    });
    // The text copy is for tools that read the HTML and skip inputs, such as starlight-llms-txt and Pagefind.
    const text = h('span', { class: `${PREFIX}-placeholder-text` }, this.text);
    const field: ElementContent = h('span', style ? { style } : {}, [input, text]);
    return nodesToTransform.map((_, i) => (i === 0 ? field : h(null, [])));
  }
}

/** Every match of each text on the line, longest first where two start at the same place. */
export function findPlaceholders(line: string, texts: string[]) {
  const sorted = [...texts].sort((a, b) => b.length - a.length);
  const matches: { text: string; start: number }[] = [];
  for (let i = 0; i < line.length; ) {
    const text = sorted.find((t) => line.startsWith(t, i));
    if (text) {
      matches.push({ text, start: i });
      i += text.length;
    } else i++;
  }
  return matches;
}

const placeholderData = new AttachedPluginData<{ active: boolean }>(() => ({ active: false }));

/** Turns each text that `placeholder="A,B"` names into an input field. */
export function pluginPlaceholders({ storage = 'local' }: { storage?: string } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:placeholders',
    baseStyles: `
.${PREFIX}-placeholder {
  box-sizing: content-box;
  height: auto;
  margin: 0;
  padding: 1px 3px;
  border: 1px dashed color-mix(in srgb, currentColor 60%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
  font: inherit;
  line-height: 1.35;
  vertical-align: baseline;
}
.${PREFIX}-placeholder-text { display: none; }
.${PREFIX}-placeholder::placeholder {
  color: inherit;
  opacity: 1;
}
.${PREFIX}-placeholder:focus {
  outline: 2px solid currentColor;
  outline-offset: 1px;
  border-style: solid;
}
@media print {
  .${PREFIX}-placeholder { padding: 0; border: 0; background: none; }
}`,
    jsModules: clientJsModules,
    hooks: {
      annotateCode(context) {
        const texts = [
          ...new Set(
            (context.codeBlock.metaOptions.getString('placeholder') ?? '')
              .split(',')
              .map((text) => text.trim())
              .filter(Boolean),
          ),
        ];
        if (texts.length === 0) return;
        const found = new Set<string>();
        for (const line of context.codeBlock.getLines()) {
          for (const { text, start } of findPlaceholders(line.text, texts)) {
            found.add(text);
            line.addAnnotation(new PlaceholderAnnotation(text, { columnStart: start, columnEnd: start + text.length }));
          }
        }
        const missing = texts.filter((text) => !found.has(text));
        if (missing.length > 0) {
          warn(
            context,
            `\`placeholder\` names ${missing.map((t) => `\`${t}\``).join(', ')}, but the code does not contain ${missing.length > 1 ? 'them' : 'it'}.`,
          );
        }
        placeholderData.getOrCreateFor(context.codeBlock).active = found.size > 0;
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        if (!placeholderData.getOrCreateFor(codeBlock).active) return;
        const figure = select('figure', renderData.blockAst) as Element | undefined;
        if (figure) figure.properties.dataScbPlaceholders = storage;
      },
    },
  };
}
