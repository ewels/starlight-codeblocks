import {
  AttachedPluginData,
  type ExpressiveCodeLine,
  isInlineStyleAnnotation,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, h, select } from '@expressive-code/core/hast';
import { LanguageGroups } from '@expressive-code/plugin-frames';
import type { CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

export interface ShellCopyStyleSettings {
  promptForeground: UnresolvedStyleValue;
  outputForeground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksShellCopy: ShellCopyStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksShellCopy: {
      promptForeground: ['#7fdbca', '#0f766e'],
      outputForeground: ({ resolveSetting }) => resolveSetting('codeblocks.mutedForeground'),
    },
  },
});

const shellData = new AttachedPluginData<{
  prompts: Map<ExpressiveCodeLine, string>;
  commands: Set<ExpressiveCodeLine>;
}>(() => ({ prompts: new Map(), commands: new Set() }));

/**
 * In terminal blocks with prompts, moves each prompt out of the code into an unselectable span,
 * mutes the output, and makes the copy button copy the commands only.
 */
export function pluginShellCopy({ prompts = ['$ ', '> '] }: { prompts?: string[] } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:shell-copy',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-shell-prompt {
  color: ${cssVar('codeblocksShellCopy.promptForeground')};
  user-select: none;
  -webkit-user-select: none;
}
.${PREFIX}-shell-output .code {
  color: ${cssVar('codeblocksShellCopy.outputForeground')};
}
.${PREFIX}-shell-output { user-select: none; -webkit-user-select: none; }`,
    hooks: {
      preprocessCode({ codeBlock }) {
        const { frame = 'auto' } = codeBlock.props;
        const terminal =
          frame === 'terminal' || (frame === 'auto' && LanguageGroups.terminal.includes(codeBlock.language));
        if (!terminal) return;
        const lines = codeBlock.getLines();
        if (!lines.some((line) => prompts.some((p) => line.text.startsWith(p)))) return;
        const data = shellData.getOrCreateFor(codeBlock);
        let continued = false;
        for (const line of lines) {
          const prompt = prompts.find((p) => line.text.startsWith(p));
          if (prompt) {
            data.prompts.set(line, prompt);
            line.editText(0, prompt.length, '');
          }
          if (prompt || continued) data.commands.add(line);
          continued = (prompt !== undefined || continued) && line.text.trimEnd().endsWith('\\');
        }
      },
      postprocessAnalyzedCode({ codeBlock }) {
        const { commands } = shellData.getOrCreateFor(codeBlock);
        if (commands.size === 0) return;
        for (const line of codeBlock.getLines()) {
          if (commands.has(line)) continue;
          for (const annotation of line.getAnnotations()) {
            if (isInlineStyleAnnotation(annotation)) line.deleteAnnotation(annotation);
          }
        }
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        const { prompts: linePrompts, commands } = shellData.getOrCreateFor(codeBlock);
        if (commands.size === 0) return;
        const prompt = linePrompts.get(line);
        if (prompt)
          select('.code', renderData.lineAst)?.children.unshift(h('span', { class: `${PREFIX}-shell-prompt` }, prompt));
        else if (!commands.has(line)) addClassName(renderData.lineAst, `${PREFIX}-shell-output`);
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const { commands } = shellData.getOrCreateFor(codeBlock);
        if (commands.size === 0) return;
        const button = select('button[data-code]', renderData.blockAst);
        if (!button) return;
        const text = codeBlock
          .getLines()
          .filter((line) => commands.has(line))
          .map((line) => line.text)
          .join('\n');
        button.properties.dataCode = text.replaceAll('\n', '\x7F');
        button.properties.title = 'Copy commands';
      },
    },
  };
}
