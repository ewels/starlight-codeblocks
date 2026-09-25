import LZString from 'lz-string';

/** The TypeScript Playground URL for the code. The build and the placeholder script both use it. */
export const typescriptPlaygroundUrl = (code: string) =>
  `https://www.typescriptlang.org/play#code/${LZString.compressToEncodedURIComponent(code)}`;
