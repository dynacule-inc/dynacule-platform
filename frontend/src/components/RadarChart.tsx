'use client';

/**
 * Custom SVG radar (spider) chart for physicochemical properties.
 * Hexagonal grid with 6 axes — fits the luxury-scientific theme.
 */

import { useMemo } from 'react';

interface RadarDataPoint {
  label: string;
  value: number; // 0 to 1 (normalized)
  raw: number;
  unit: string;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  levels?: number;
}

export default function RadarChart({ data, size = 180, levels = 4 }: RadarChartProps) {
  const n = data.length;
  const center = size / 2;
  const radius = size / 2 - 24;

  // Precompute polygon points
  const angles = useMemo(
    () => data.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2),
    [data, n]
  );

  const getPoint = (angle: number, r: number): [number, number] => [
    center + r * Math.cos(angle),
    center + r * Math.sin(angle),
  ];

  const gridLevels = useMemo(
    () =>
      Array.from({ length: levels }, (_, li) => {
        const r = (radius * (li + 1)) / levels;
        return angles.map((a) => getPoint(a, r));
      }),
    [angles, radius, levels]
  );

  const dataPolygon = useMemo(
    () => data.map((d, i) => getPoint(angles[i], d.value * radius)),
    [data, angles, radius]
  );

  const allPolygon = dataPolygon.map((p) => p.join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid levels */}
      {gridLevels.map((points, li) => (
        <polygon
          key={`grid-${li}`}
          points={points.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#c9a84c"
          strokeOpacity={0.15 + (li + 1) * 0.05}
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {angles.map((a, i) => {
        const [x, y] = getPoint(a, radius);
        return (
          <line
            key={`axis-${i}`}
            x1={center} y1={center}
            x2={x} y2={y}
            stroke="#c9a84c"
            strokeOpacity={0.2}
            strokeWidth={0.5}
          />
        );
      })}

      {/* Data polygon (filled) */}
      <polygon
        points={allPolygon}
        fill="#1a2a4a"
        fillOpacity={0.15}
        stroke="#1a2a4a"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {dataPolygon.map(([x, y], i) => (
        <circle key={`dp-${i}`} cx={x} cy={y} r={3} fill="#1a2a4a" stroke="#f9f7f4" strokeWidth={1.5} />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const [x, y] = getPoint(angles[i], radius + 16);
        return (
          <g key={`lbl-${i}`}>
            <text
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="#0f1b2d"
              fillOpacity={0.7}
            >
              {d.label}
            </text>
            <text
              x={x} y={y + 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={5.5}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="#0f1b2d"
              fillOpacity={0.45}
            >
              {Math.round(d.raw * 10) / 10}{d.unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Normalize a set of molecule descriptor values for radar display.
 * Uses reasonable max values for drug-like molecules.
 */
export function normalizeDescriptors(
  descriptors: Record<string, number>
): RadarDataPoint[] {
  const MAX = {
    MolWt: 600,
    LogP: 6,
    NumHDonors: 6,
    NumHAcceptors: 12,
    NumRotatableBonds: 15,
    TPSA: 150,
    FractionCSP3: 1,
  } as const;

  const items: { key: keyof typeof MAX; label: string; unit: string }[] = [
    { key: 'MolWt', label: 'MolWt', unit: '' },
    { key: 'LogP', label: 'LogP', unit: '' },
    { key: 'NumHDonors', label: 'HBD', unit: '' },
    { key: 'NumHAcceptors', label: 'HBA', unit: '' },
    { key: 'NumRotatableBonds', label: 'RotB', unit: '' },
    { key: 'TPSA', label: 'TPSA', unit: '' },
    { key: 'FractionCSP3', label: 'Fsp3', unit: '' },
  ];

  return items.map(({ key, label, unit }) => {
    const raw = descriptors[key] ?? 0;
    const maxVal = MAX[key];
    return {
      label,
      value: Math.min(raw / maxVal, 1),
      raw,
      unit,
    };
  });
}