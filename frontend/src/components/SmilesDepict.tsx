'use client';

/**
 * Simple 2D molecular depiction from SMILES string.
 * Renders atoms as SVG circles with element labels, bonds as lines.
 * Uses a force-directed-like layout from SMILES parsing.
 */

import { useMemo } from 'react';

interface Atom {
  elem: string;
  x: number;
  y: number;
  serial: number;
}

interface Bond {
  from: number;
  to: number;
  order: number; // 1, 2, 3
}

function parseSmiles(smiles: string): { atoms: Atom[]; bonds: Bond[] } {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  let i = 0;
  let serial = 0;
  const stack: number[] = []; // branch stack
  let prevAtom = -1;

  const elements = ['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Si', 'Se', 'H'];

  while (i < smiles.length) {
    const c = smiles[i];

    if (c === '(') {
      // Start branch — push current atom index
      stack.push(prevAtom);
      i++;
      continue;
    }

    if (c === ')') {
      // End branch — pop
      if (stack.length > 0) stack.pop();
      i++;
      continue;
    }

    if (c === '[') {
      // Bracket atom like [NH4+]
      const end = smiles.indexOf(']', i);
      if (end === -1) break;
      const content = smiles.substring(i + 1, end);
      let elem = '';
      for (const e of elements) {
        if (content.startsWith(e)) {
          elem = e;
          break;
        }
      }
      if (!elem) elem = content.substring(0, 1);
      atoms.push({ elem, x: 0, y: 0, serial });
      if (prevAtom >= 0) {
        bonds.push({ from: prevAtom, to: serial, order: 1 });
      }
      prevAtom = serial;
      serial++;
      i = end + 1;
      continue;
    }

    if (c.isalpha && c.isupper()) {
      let elem = c;
      if (i + 1 < smiles.length && smiles[i + 1].islower()) {
        elem += smiles[i + 1];
        i++;
      }
      if (elements.includes(elem)) {
        atoms.push({ elem, x: 0, y: 0, serial });
        if (prevAtom >= 0) {
          const order = bonds.length > 0 ? 1 : 1;
          bonds.push({ from: prevAtom, to: serial, order });
        }
        prevAtom = serial;
        serial++;
      }
    }

    i++;
  }

  // Layout atoms in a zigzag chain
  const spacing = 28;
  let x = 0;
  let y = 30;
  for (let ai = 0; ai < atoms.length; ai++) {
    if (ai % 2 === 0) {
      x = spacing;
      y += spacing * 0.6;
    } else {
      x = spacing * 3;
    }
    if (ai > 1) {
      x = atoms[ai - 1].x + spacing;
      y = atoms[ai - 1].y + (ai % 2 === 0 ? spacing * 0.5 : -spacing * 0.5);
    }
    // Adjust for ring-like positions
    atoms[ai].x = (ai % 3) * spacing * 1.2 + spacing;
    atoms[ai].y = Math.floor(ai / 3) * spacing * 0.9 + spacing;
  }

  return { atoms, bonds };
}

const ELEMENT_COLORS: Record<string, string> = {
  C: '#1a1a2e',
  N: '#2d4a7a',
  O: '#c0392b',
  S: '#d4a017',
  P: '#d35400',
  F: '#27ae60',
  Cl: '#16a085',
  Br: '#8e44ad',
  I: '#6c3483',
  B: '#7fb3d8',
  Si: '#5d6d7e',
  Se: '#b7950b',
  H: '#95a5a6',
};

export default function SmilesDepict({ smiles, size = 180 }: { smiles: string; size?: number }) {
  const { atoms, bonds } = useMemo(() => parseSmiles(smiles), [smiles]);

  // Center the drawing
  const pad = 20;
  const maxX = Math.max(...atoms.map((a) => a.x), 1);
  const maxY = Math.max(...atoms.map((a) => a.y), 1);
  const scale = Math.min((size - pad * 2) / maxX, (size - pad * 2) / maxY, 2.5);

  const cx = size / 2;
  const cy = atoms.length > 0 ? (size - pad) : size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Bonds */}
      {bonds.map((b, idx) => {
        const from = atoms[b.from];
        const to = atoms[b.to];
        if (!from || !to) return null;
        const x1 = cx + (from.x - maxX / 2) * scale;
        const y1 = cy - (from.y - maxY / 2) * scale;
        const x2 = cx + (to.x - maxX / 2) * scale;
        const y2 = cy - (to.y - maxY / 2) * scale;

        if (b.order >= 2) {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len * 3;
          const ny = dx / len * 3;
          return (
            <g key={`b${idx}`}>
              <line x1={x1 - nx} y1={y1 - ny} x2={x2 - nx} y2={y2 - ny} stroke="#1a1a2e" strokeWidth={1.2} />
              <line x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} stroke="#1a1a2e" strokeWidth={1.2} />
            </g>
          );
        }

        return (
          <line
            key={`b${idx}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#1a1a2e" strokeWidth={1.2}
          />
        );
      })}

      {/* Atoms */}
      {atoms.map((atom, idx) => {
        const x = cx + (atom.x - maxX / 2) * scale;
        const y = cy - (atom.y - maxY / 2) * scale;
        const color = ELEMENT_COLORS[atom.elem] || '#555';
        const r = atom.elem === 'C' ? 5 : 8;

        return (
          <g key={`a${idx}`}>
            {atom.elem !== 'C' && (
              <circle cx={x} cy={y} r={r} fill={color} opacity={0.9} />
            )}
            {atom.elem !== 'C' && (
              <text
                x={x} y={y + 0.4}
                textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={7} fontWeight={600}
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {atom.elem}
              </text>
            )}
            {atom.elem === 'C' && (
              <circle cx={x} cy={y} r={2.5} fill={color} opacity={0.6} />
            )}
          </g>
        );
      })}

      {atoms.length === 0 && (
        <text
          x={size / 2} y={size / 2}
          textAnchor="middle" dominantBaseline="central"
          fill="#aaa" fontSize={10}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          No structure
        </text>
      )}
    </svg>
  );
}