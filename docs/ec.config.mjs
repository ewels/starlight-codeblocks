import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginCodeblocks } from 'starlight-codeblocks/expressive-code';

// Collapsible sections are for the comparison on the hidden lines page.
export default {
  plugins: [pluginCollapsibleSections(), pluginCodeblocks()],
};
