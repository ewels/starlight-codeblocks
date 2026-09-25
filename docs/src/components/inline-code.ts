const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Escapes text and turns `backticks` into code elements, for descriptions that come from the package source. */
export const inlineCode = (text: string) => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
