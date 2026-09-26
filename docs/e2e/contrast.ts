import type { Page } from '@playwright/test';

/** The WCAG contrast ratio of two CSS colours, measured in the page. */
export function contrast(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    ([a, b]) => {
      const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      const luminance = (colour: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (high + 0.05) / (low + 0.05);
    },
    [a, b],
  );
}
