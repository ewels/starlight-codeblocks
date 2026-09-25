import type { StarlightPlugin } from '@astrojs/starlight/types';

export default function codeblocks(): StarlightPlugin {
  return {
    name: 'starlight-codeblocks',
    hooks: {
      'config:setup'() {},
    },
  };
}
