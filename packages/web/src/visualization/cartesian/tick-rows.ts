const TICK_GAP = 8;

function fitsOneRow(ticks: readonly SVGTextElement[]): boolean {
  const boxes = ticks.map((tick) => tick.getBBox()).sort((left, right) => left.x - right.x);
  return boxes.every((box, index) => index === 0 || boxes[index - 1]!.x + boxes[index - 1]!.width + TICK_GAP <= box.x);
}

/**
 * Staggered x-axis labels are the safe default. When the measured labels fit on one row,
 * the chart marks its SVG so styles lift the offset labels back onto the first row.
 */
export function fitAxisTickRows(root: ParentNode): void {
  for (const chart of root.querySelectorAll<SVGSVGElement>('svg')) {
    const ticks = [...chart.querySelectorAll<SVGTextElement>('text.axis-x-tick')];
    const single = ticks.length > 1 && typeof ticks[0]!.getBBox === 'function' && fitsOneRow(ticks);
    chart.toggleAttribute('data-single-row-ticks', single);
  }
}
