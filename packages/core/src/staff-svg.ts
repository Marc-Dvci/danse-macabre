import { layoutStaff, type StaffOptions } from './layout';
import type { Score, TurnSymbol } from './types';

function num(n: number): string {
  return String(Number(n.toFixed(3)));
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Label written in a turn glyph: the amount as a fraction of a turn (requirement 3.4). */
function turnLabel(amount: TurnSymbol['amount']): string {
  const labels: Record<TurnSymbol['amount'], string> = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4', 1: '1' };
  return labels[amount];
}

/**
 * Draws the staff as a standalone SVG document (Requirement 3.6). Level is shown on each glyph: high is hatched with
 * lines at 45 degrees rising to the right, middle is white with a centre dot, low is solid. Each glyph is a `<g>` with
 * `data-symbol-id`. y is flipped so that time runs up the page, as on a printed staff.
 * @param score A valid score.
 * @param options Same as `layoutStaff`.
 * @returns The SVG markup as one string.
 */
export function renderStaffSvg(score: Score, options: StaffOptions = {}): string {
  const layout = layoutStaff(score, options);
  const H = layout.height;
  const fy = (y: number): string => num(H - y);
  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(layout.width)}" height="${num(H)}" viewBox="0 0 ${num(layout.width)} ${num(H)}">`,
  );
  out.push(`<title>${escapeXml(score.title)}</title>`);
  out.push(
    '<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4"><path d="M0 4 L4 0" stroke="#000" stroke-width="1"/></pattern></defs>',
  );
  out.push('<rect width="100%" height="100%" fill="#fff"/>');

  for (const line of layout.lines) {
    out.push(`<line x1="${num(line.x)}" y1="${fy(line.y1)}" x2="${num(line.x)}" y2="${fy(line.y2)}" stroke="#000"/>`);
  }
  for (const bar of layout.bars) {
    const offsets = bar.double ? [0, 3] : [0];
    for (const dy of offsets) {
      out.push(
        `<line x1="${num(bar.x1)}" y1="${fy(bar.y + dy)}" x2="${num(bar.x2)}" y2="${fy(bar.y + dy)}" stroke="#000" stroke-width="${bar.double ? 1 : 1.5}"/>`,
      );
    }
  }
  for (const count of layout.counts) {
    out.push(
      `<text x="${num(count.x - 3)}" y="${fy(count.y + 4)}" font-family="sans-serif" font-size="9" text-anchor="end">${escapeXml(count.label)}</text>`,
    );
  }

  for (const g of layout.glyphs) {
    const points = g.polygon.map((p) => `${num(p.x)},${fy(p.y)}`).join(' ');
    out.push(`<g data-symbol-id="${escapeXml(g.symbolId)}">`);
    if (g.kind === 'turn') {
      // Turn signs are white, with the amount written in the middle (1/4, 1/2, 3/4, 1).
      out.push(`<polygon points="${points}" fill="#fff" stroke="#000" stroke-width="1"/>`);
      const cx = g.x + g.w / 2;
      const cy = g.y + g.h / 2;
      out.push(
        `<text x="${num(cx)}" y="${fy(cy - 3)}" font-family="sans-serif" font-size="8" text-anchor="middle">${escapeXml(turnLabel(g.amount!))}</text>`,
      );
      out.push('</g>');
      continue;
    }
    const fill = g.level === 'high' ? 'url(#hatch)' : g.level === 'low' ? '#000' : '#fff';
    out.push(`<polygon points="${points}" fill="${fill}" stroke="#000" stroke-width="1"/>`);
    if (g.level === 'middle') {
      const xs = g.polygon.map((p) => p.x);
      const ys = g.polygon.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      out.push(`<circle cx="${num(cx)}" cy="${fy(cy)}" r="1.8" fill="#000"/>`);
    }
    out.push('</g>');
  }

  out.push('</svg>');
  return out.join('\n');
}
