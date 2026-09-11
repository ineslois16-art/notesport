export type ChartPoint = { label: string; value: number | null };

export type Scale = {
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  x: (index: number) => number;
  y: (value: number) => number;
  min: number;
  max: number;
  ticks: number[];
};

/** Bornes « rondes » : un axe qui se lit d'un coup d'œil vaut mieux qu'un axe exact. */
export function niceBounds(min: number, max: number, tickCount = 3): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (min === max) {
    const pad = Math.abs(min) > 1 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / Math.max(1, tickCount);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const stepFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = stepFactor * magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return { min: niceMin, max: niceMax, ticks };
}

export function buildScale(options: {
  values: (number | null)[];
  width: number;
  height: number;
  padding: { left: number; right: number; top: number; bottom: number };
  fromZero?: boolean;
  minimumTop?: number;
  /** Plafond exact (7 blocs = axe à 7, pas un « joli » 10 qui écrase les barres). */
  snapMax?: number;
  tickCount?: number;
}): Scale {
  const { values, width, height, padding, fromZero, minimumTop, snapMax, tickCount = 3 } = options;
  const filled = values.filter((value): value is number => value !== null && Number.isFinite(value));

  let rawMin = filled.length ? Math.min(...filled) : 0;
  let rawMax = filled.length ? Math.max(...filled) : 1;
  if (fromZero) rawMin = Math.min(0, rawMin);
  if (minimumTop !== undefined) rawMax = Math.max(rawMax, minimumTop);
  if (!fromZero && filled.length) {
    // Sur une courbe de poids, coller au zéro écrase toute la variation.
    const margin = (rawMax - rawMin) * 0.15 || 1;
    rawMin -= margin;
    rawMax += margin;
  }

  const bounds =
    snapMax !== undefined
      ? { min: 0, max: Math.max(snapMax, rawMax), ticks: [0, snapMax] }
      : niceBounds(rawMin, rawMax, tickCount);
  const plotLeft = padding.left;
  const plotTop = padding.top;
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const span = bounds.max - bounds.min || 1;
  const count = values.length;

  return {
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    min: bounds.min,
    max: bounds.max,
    ticks: bounds.ticks,
    x: (index) => (count <= 1 ? plotLeft + plotWidth / 2 : plotLeft + (index / (count - 1)) * plotWidth),
    y: (value) => plotTop + plotHeight - ((value - bounds.min) / span) * plotHeight,
  };
}

/** Découpe la série en segments continus : les trous (jours sans pesée) ne sont pas inventés. */
export function contiguousSegments(values: (number | null)[]): { index: number; value: number }[][] {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ index, value });
  });
  if (current.length) segments.push(current);
  return segments;
}

/** Toutes les valeurs renseignées, trous ignorés : pour relier une série éparse. */
export function filledPoints(values: (number | null)[]): { index: number; value: number }[] {
  const points: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value !== null && Number.isFinite(value)) points.push({ index, value: value as number });
  });
  return points;
}

export function linePath(segment: { index: number; value: number }[], scale: Scale): string {
  return segment
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${scale.x(point.index).toFixed(2)},${scale.y(point.value).toFixed(2)}`)
    .join(' ');
}

export function areaPath(segment: { index: number; value: number }[], scale: Scale): string {
  if (segment.length < 2) return '';
  const baseline = scale.plotTop + scale.plotHeight;
  const first = scale.x(segment[0].index).toFixed(2);
  const last = scale.x(segment[segment.length - 1].index).toFixed(2);
  return `${linePath(segment, scale)} L${last},${baseline.toFixed(2)} L${first},${baseline.toFixed(2)} Z`;
}

/** Barre à extrémité arrondie côté donnée, ancrée sur la ligne de base. */
export function roundedTopBar(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${bottom}`,
    'Z',
  ].join(' ');
}

/** Indices dont l'étiquette d'axe est affichée : début, milieu(x), fin — jamais toutes. */
export function axisLabelIndices(count: number, maximum = 4): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count <= maximum) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (maximum - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maximum; i += 1) indices.add(Math.round(i * step));
  return [...indices].sort((a, b) => a - b);
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '').replace('.', ',')}k`;
  return String(Math.round(value * 10) / 10).replace('.', ',');
}
