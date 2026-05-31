'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi } from '@/lib/moleculeApi';
import type { ViewPreset } from '@/lib/store';
import type { MoleculeData } from '@/lib/moleculeApi';

/* ═══════════════════════════════════════════════════════════════════════════════
   SELECTION STRINGS — work for any structure; NGL renders nothing on empty match
   ═══════════════════════════════════════════════════════════════════════════════ */

// All protein residues (backbone + side-chains). Used for cartoon/ribbon/tube/backbone/surface.
const SEL_PROTEIN = 'protein';

// Small-molecule ligands only — excludes protein, waters, common ions.
// This is what most presets show as "the ligand" (drug, cofactor, substrate).
const SEL_SMALL_MOL = 'not (protein or HOH or water or resname NA or resname CL or resname K or resname MG or resname CA or resname ZN or resname FE or resname MN or resname CO or resname CU or resname PB or resname CD or resname HG)';

// Ligands + ions — everything that isn't protein or water. Used by CPK and metal-site presets.
const SEL_IONS_AND_LIGAND = 'not (protein or HOH or water)';

// Protein residues within 8 Å of any small-molecule ligand (pocket lining).
const SEL_NEAR_PROT = `(protein within 8A of (${SEL_SMALL_MOL}))`;

// Water molecules only.
const SEL_WATERS = 'HOH or water';

// Show all atoms except nonpolar hydrogens (C–H bonds).
// Polar H (bonded to N, O, or S within 1.3 Å) are kept — they indicate H-bond donors.
const SEL_NO_NONPOLARH = '((not H) or (H within 1.3A of (N or O or S)))';

// Secstruct selectors for the Dynacule split representation.
const SEL_HELIX = 'protein and helix';
const SEL_SHEET  = 'protein and sheet';
const SEL_COIL   = 'protein and coil';

/* ═══════════════════════════════════════════════════════════════════════════════
   NGL STAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

interface MolecularViewerProps {
  className?: string;
  projectId?: string | null;
}

/* ── Preset display labels ─────────────────────────────────────────────────── */
const PRESET_LABELS: Record<string, string> = {
  dynacule: 'Dynacule',
  cartoon: 'Cartoon',
  ribbon: 'Ribbon',
  surface: 'Surface',
  cpk: 'CPK',
  backbone: 'Backbone',
  rainbow: 'Rainbow',
  'chain-surface': 'Chain Surface',
  'secondary-structure': 'Secondary Structure',
  'bfactor-putty': 'B-Factor Putty',
  'standard-cpk-licorice': 'CPK Licorice',
  'backbone-trace': 'Backbone Trace',
  'vdw-spacefill': 'VDW Spacefill',
  'nucleic-acid-ladder': 'Nucleic Acid Ladder',
  'hydrophobicity-surface': 'Hydrophobicity Surface',
  'ribbon-stick': 'Ribbon & Stick',
  'ligand-emphasis': 'Ligand Emphasis',
  'pocket-surface': 'Pocket Surface',
  'pharmacophore-map': 'Pharmacophore Map',
  'polar-contacts': 'Polar Contacts',
  'halogen-bonds': 'Halogen Bonds',
  'pi-pi-stacking': 'Pi-Pi Stacking',
  'steric-clash-map': 'Steric Clash Map',
  'receptor-cavity-mesh': 'Receptor Cavity Mesh',
  'solvent-excluded-ligand': 'Solvent-Excluded Ligand',
  'docking-score-gradient': 'Docking Score Gradient',
  'electrostatic-coulombic': 'Electrostatic (Coulombic)',
  'poisson-boltzmann': 'Poisson-Boltzmann Surface',
  mlp: 'Molecular Lipophilicity Potential',
  'conservation-consurf': 'Evolutionary Conservation',
  'partial-charge-map': 'Partial Charge Map',
  'aromaticity-highlight': 'Aromaticity Highlight',
  'pka-shift-surface': 'pKa Shift Surface',
  'dipole-moment-vector': 'Dipole Moment Vector',
  'solvation-free-energy': 'Solvation Free Energy',
  'isoelectric-surface-point': 'Isoelectric Surface Point',
  'rmsf-putty': 'RMSF Putty',
  'pca-porcupine': 'PCA Porcupine',
  'trajectory-density-grid': 'Trajectory Density Grid',
  'hydration-site-iso': 'Hydration Site Iso-surface',
  dccm: 'Dynamic Cross-Correlation',
  'lipid-bilayer': 'Lipid Bilayer',
  'ion-permeation-track': 'Ion Permeation Track',
  'trajectory-ribbon-overlay': 'Trajectory Ribbon Overlay',
  'salt-bridge-network': 'Salt Bridge Network',
  'unfolding-pathway': 'Unfolding Pathway',
  'cryoem-density': 'Cryo-EM Density Fit',
  'xray-2fofc': 'X-ray Diffraction (2Fo-Fc)',
  'difference-map-fofc': 'Difference Map (Fo-Fc)',
  'ambient-occlusion': 'Ambient Occlusion Surface',
  'depth-cued-fog': 'Depth-Cued Fog',
  nci: 'Non-Covalent Interactions',
  'sasa-dot-map': 'SASA Dot Map',
  'alphafold-plddt': 'AlphaFold Confidence (pLDDT)',
  'disulfide-bridges': 'Disulfide Bridges',
  'ramachandran-outliers': 'Ramachandran Outliers',
  'dark-matter': 'Dark Matter',
  glass: 'Glass',
  blueprint: 'Blueprint',
  ghost: 'Ghost',
  'oil-paint': 'Oil Paint',
  publication: 'Publication',
};

interface PresetCategory { label: string; presets: string[]; }

const PRESET_CATEGORIES: PresetCategory[] = [
  { label: 'Standard Topology & Structure', presets: ['dynacule', 'rainbow', 'chain-surface', 'secondary-structure', 'bfactor-putty', 'standard-cpk-licorice', 'backbone-trace', 'vdw-spacefill', 'nucleic-acid-ladder', 'hydrophobicity-surface', 'ribbon-stick'] },
  { label: 'Ligands & Binding Pockets', presets: ['ligand-emphasis', 'pocket-surface', 'pharmacophore-map', 'polar-contacts', 'halogen-bonds', 'pi-pi-stacking', 'steric-clash-map', 'receptor-cavity-mesh', 'solvent-excluded-ligand', 'docking-score-gradient'] },
  { label: 'Physicochemical & Electrostatic', presets: ['electrostatic-coulombic', 'poisson-boltzmann', 'mlp', 'conservation-consurf', 'partial-charge-map', 'aromaticity-highlight', 'pka-shift-surface', 'dipole-moment-vector', 'solvation-free-energy', 'isoelectric-surface-point'] },
  { label: 'Molecular Dynamics & Ensembles', presets: ['rmsf-putty', 'pca-porcupine', 'trajectory-density-grid', 'hydration-site-iso', 'dccm', 'lipid-bilayer', 'ion-permeation-track', 'trajectory-ribbon-overlay', 'salt-bridge-network', 'unfolding-pathway'] },
  { label: 'Advanced Meshes & Specialized', presets: ['cryoem-density', 'xray-2fofc', 'difference-map-fofc', 'ambient-occlusion', 'depth-cued-fog', 'nci', 'sasa-dot-map', 'alphafold-plddt', 'disulfide-bridges', 'ramachandran-outliers'] },
  { label: 'Illustration & Publication', presets: ['dark-matter', 'glass', 'blueprint', 'ghost', 'oil-paint', 'publication'] },
];

/* ── CPK element color palette ───────────────────────────────────────────── */
const ELEMENT_COLORS: Record<string, [number, number, number]> = {
  H:  [0.90, 0.90, 0.90],
  C:  [0.25, 0.25, 0.25],
  N:  [0.13, 0.37, 0.90],
  O:  [0.91, 0.13, 0.13],
  S:  [0.95, 0.80, 0.10],
  P:  [1.00, 0.50, 0.00],
  F:  [0.20, 0.80, 0.20],
  CL: [0.12, 0.75, 0.12],
  BR: [0.60, 0.15, 0.10],
  FE: [0.80, 0.40, 0.10],
  MG: [0.30, 0.90, 0.30],
  CA: [0.10, 0.80, 0.80],
  ZN: [0.20, 0.50, 0.70],
  default: [0.45, 0.45, 0.55],
};

function elementColorScheme() {
  return Object.fromEntries(
    Object.entries(ELEMENT_COLORS).map(([el, rgb]) => [el, `rgb(${rgb.join(',')})`]),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PRESET APPLICATION
   ═══════════════════════════════════════════════════════════════════════════════ */

async function applyPreset(
  component: any,
  preset: ViewPreset,
  stage: any,
  reprStore?: Record<string, any[]>,
) {
  component.removeAllRepresentations();

  if (reprStore) {
    reprStore.proteinRibbon = [];
    reprStore.proteinAtoms  = [];
    reprStore.ligandAtoms   = [];
    reprStore.ligandRibbon  = [];
  }

  // Atom-level representations (ball+stick, licorice, spacefill, dot) should
  // exclude nonpolar hydrogens by default — they add visual noise without
  // chemical insight. Backbone/cartoon/tube/surface reps never render H anyway.
  const ATOM_REP_TYPES = new Set(['ball+stick', 'licorice', 'spacefill', 'dot']);

  function addRep(type: string, params: any, category: string): any {
    // Intersect atom-level selections with nonpolar-H exclusion
    if (ATOM_REP_TYPES.has(type) && params.sele) {
      params = { ...params, sele: `(${params.sele}) and ${SEL_NO_NONPOLARH}` };
    }
    const repr = component.addRepresentation(type, params);
    if (repr && reprStore) reprStore[category].push(repr);
    return repr;
  }

  const E = elementColorScheme();

  // ── Shorthand constants ──────────────────────────────────────────────────
  // Backbone reps — these draw smooth traces; they never render individual atoms.
  // Use SEL_PROTEIN = 'protein' which is semantically honest: trace through all protein residues.
  const P  = SEL_PROTEIN;           // 'protein'
  const LM = SEL_SMALL_MOL;         // small-molecule ligands (no waters/ions)
  const IL = SEL_IONS_AND_LIGAND;   // ligands + ions (no waters)
  const NP = SEL_NEAR_PROT;         // protein within 8Å of small molecules
  const W  = SEL_WATERS;            // water molecules

  switch (preset) {

  /* ══════════════════════════════════════════════════════════════════════
     Standard Topology & Structure                                       */

  /* Dynacule — signature view: thick helix/sheet cartoon, ultra-thin coil tube,
     ligand ball+stick, near-pocket protein detail.
     Helix scale 14 and sheet scale 12 dominate the thin coil tube (radius 0.08). */
  case 'dynacule': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: SEL_HELIX, smoothSheet: true, subdiv: 6, scale: 14.0 }, 'proteinRibbon');
    addRep('cartoon', { color: 'element', colorScheme: E, sele: SEL_SHEET, smoothSheet: true, subdiv: 6, scale: 12.0 }, 'proteinRibbon');
    addRep('tube',   { color: 'element', colorScheme: E, sele: SEL_COIL, radius: 0.08, subdiv: 4 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'cartoon': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 5.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'ribbon': {
    addRep('ribbon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 9.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* CPK — ALL atoms colored by element. Protein as thin ball+stick,
     non-protein non-water as spacefill. */
  case 'cpk': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 1.5 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: P, radius: 0.08, multipleBond: false }, 'proteinAtoms');
    addRep('spacefill', { color: 'element', colorScheme: E, sele: IL, radius: 1.0 }, 'ligandAtoms');
    break;
  }

  case 'surface': {
    addRep('surface', { color: '#d4c5a9', opacity: 0.82, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'backbone': {
    addRep('backbone', { color: 'element', colorScheme: E, sele: P, radius: 0.3 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'rainbow': {
    addRep('cartoon', { color: 'residueindex', sele: P, smoothSheet: true, scale: 4.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'chain-surface': {
    addRep('surface', { color: 'chainindex', opacity: 0.8, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'secondary-structure': {
    addRep('cartoon', { color: 'secstruct', sele: P, smoothSheet: true, scale: 5.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'bfactor-putty': {
    addRep('tube', { color: 'bfactor', sele: P, radius: 0.6, subdiv: 8 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'standard-cpk-licorice': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 4.0 }, 'proteinRibbon');
    addRep('licorice', { color: 'element', colorScheme: E, sele: LM, radius: 0.2 }, 'ligandAtoms');
    addRep('licorice', { color: 'element', colorScheme: E, sele: NP, radius: 0.15 }, 'proteinAtoms');
    break;
  }

  case 'backbone-trace': {
    addRep('backbone', { color: 'element', colorScheme: E, sele: P, radius: 0.3 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'vdw-spacefill': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('spacefill', { color: 'element', colorScheme: E, sele: LM, radius: 1.0 }, 'ligandAtoms');
    addRep('spacefill', { color: 'element', colorScheme: E, sele: NP, radius: 1.0 }, 'proteinAtoms');
    break;
  }

  case 'nucleic-acid-ladder': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: 'nucleic', scale: 5.0 }, 'ligandRibbon');
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'hydrophobicity-surface': {
    addRep('surface', { color: '#d4a017', opacity: 0.85, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'ribbon-stick': {
    addRep('ribbon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 7.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Ligands & Binding Pockets                                            */

  case 'ligand-emphasis': {
    addRep('surface', { color: '#ffffff', opacity: 0.2, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.4, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.25, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'pocket-surface': {
    addRep('surface', { color: 'element', colorScheme: E, surfaceType: 'av', sele: NP }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    break;
  }

  case 'pharmacophore-map': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('licorice', { color: 'element', colorScheme: E, sele: LM, radius: 0.2 }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.4, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'polar-contacts': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'halogen-bonds': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: `((F or CL or BR or I) and (${NP}))`, radius: 0.3, multipleBond: true }, 'proteinAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    break;
  }

  case 'pi-pi-stacking': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: `((PHE or TYR or TRP or HIS) and (${NP}))`, radius: 0.3, multipleBond: true }, 'proteinAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    break;
  }

  case 'steric-clash-map': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.5, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.5, multipleBond: true }, 'proteinAtoms');
    addRep('contact', { color: '#ff4444', sele: LM, radius: 0.5 }, 'ligandAtoms');
    break;
  }

  case 'receptor-cavity-mesh': {
    addRep('surface', { color: '#cccccc', opacity: 0.15, surfaceType: 'ms', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'solvent-excluded-ligand': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('dot', { color: '#ffffff', sele: LM, dotSize: 0.5 }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'docking-score-gradient': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'bfactor', sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'bfactor', sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Physicochemical & Electrostatic                                      */

  case 'electrostatic-coulombic': {
    addRep('surface', { color: 'electrostatic', opacity: 0.8, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'poisson-boltzmann': {
    addRep('surface', { color: 'electrostatic', opacity: 0.75, surfaceType: 'ms', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'mlp': {
    addRep('surface', { color: '#c9a84c', opacity: 0.7, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'conservation-consurf': {
    addRep('cartoon', { color: 'occupancy', sele: P, smoothSheet: true, scale: 4.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'partial-charge-map': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.2, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'aromaticity-highlight': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: `(PHE or TYR or TRP or HIS) and (${NP})`, radius: 0.3, multipleBond: true }, 'proteinAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    break;
  }

  case 'pka-shift-surface': {
    addRep('surface', { color: '#c9a84c', opacity: 0.7, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'dipole-moment-vector': {
    addRep('backbone', { color: 'element', colorScheme: E, sele: P, radius: 0.3 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'solvation-free-energy': {
    addRep('surface', { color: '#5b7db1', opacity: 0.7, surfaceType: 'sas', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'isoelectric-surface-point': {
    addRep('surface', { color: '#8b5cf6', opacity: 0.7, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Molecular Dynamics & Ensembles                                       */

  case 'rmsf-putty': {
    addRep('tube', { color: 'bfactor', sele: P, radius: 0.5, subdiv: 8 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'pca-porcupine': {
    addRep('backbone', { color: 'element', colorScheme: E, sele: P, radius: 0.3 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.25, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'trajectory-density-grid': {
    addRep('surface', { color: '#66c2a5', opacity: 0.3, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'hydration-site-iso': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('surface', { color: '#80b1d3', opacity: 0.3, surfaceType: 'av', surfaceSelection: W }, 'ligandRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'dccm': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.15, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.12, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'lipid-bilayer': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 4.0 }, 'proteinRibbon');
    addRep('line', { color: 'element', colorScheme: E, sele: IL }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'ion-permeation-track': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 4.0 }, 'proteinRibbon');
    addRep('spacefill', { color: 'element', colorScheme: E, sele: `(${IL}) and not (${LM})`, radius: 0.5 }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'trajectory-ribbon-overlay': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'salt-bridge-network': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: `(ASP or GLU or LYS or ARG or HIS) and (${NP})`, radius: 0.3, multipleBond: true }, 'proteinAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    break;
  }

  case 'unfolding-pathway': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 2.0, opacity: 0.5 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Advanced Meshes & Specialized                                         */

  case 'cryoem-density': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('surface', { color: '#e0e0e0', opacity: 0.15, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'xray-2fofc': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('surface', { color: '#4a90d9', opacity: 0.12, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'difference-map-fofc': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('surface', { color: '#ff6b6b', opacity: 0.15, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'ambient-occlusion': {
    addRep('surface', { color: '#c4b998', opacity: 0.85, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'depth-cued-fog': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'nci': {
    addRep('surface', { color: '#e5c494', opacity: 0.7, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'sasa-dot-map': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('dot', { color: '#8da0cb', sele: P, dotSize: 0.4 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'alphafold-plddt': {
    addRep('cartoon', { color: 'bfactor', sele: P, smoothSheet: true, scale: 4.0 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'disulfide-bridges': {
    addRep('backbone', { color: 'element', colorScheme: E, sele: P, radius: 0.3 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: 'SG', radius: 0.4, multipleBond: true }, 'proteinAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  case 'ramachandran-outliers': {
    addRep('cartoon', { color: 'element', colorScheme: E, sele: P, smoothSheet: true, scale: 3.0 }, 'proteinRibbon');
    addRep('spacefill', { color: '#ff0000', sele: NP, radius: 0.6 }, 'proteinAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    break;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Illustration & Publication                                               */

  /* Dark Matter — deep dark surface with neon element highlights */
  case 'dark-matter': {
    addRep('surface', { color: '#0a0a0a', opacity: 0.92, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('cartoon', { color: 'element', colorScheme: E, sele: SEL_HELIX, smoothSheet: true, subdiv: 6, scale: 14.0, opacity: 0.35 }, 'proteinRibbon');
    addRep('cartoon', { color: 'element', colorScheme: E, sele: SEL_SHEET, smoothSheet: true, subdiv: 6, scale: 12.0, opacity: 0.35 }, 'proteinRibbon');
    addRep('tube',   { color: 'element', colorScheme: E, sele: SEL_COIL, radius: 0.08, subdiv: 4, opacity: 0.35 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.35, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.2, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* Glass — translucent white surface, thin backbone trace, vivid ligand */
  case 'glass': {
    addRep('surface', { color: '#e8e4e0', opacity: 0.25, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('cartoon', { color: '#888888', sele: P, smoothSheet: true, scale: 4.0, opacity: 0.6 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.35, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* Blueprint — navy wireframe on cream, technical drawing aesthetic */
  case 'blueprint': {
    addRep('cartoon', { color: '#0f1b2d', sele: P, smoothSheet: true, scale: 14.0 }, 'proteinRibbon');
    addRep('cartoon', { color: '#0f1b2d', sele: P, smoothSheet: true, scale: 5.0, opacity: 0.15 }, 'proteinRibbon');
    addRep('licorice', { color: '#1a3a5c', sele: LM, radius: 0.15 }, 'ligandAtoms');
    addRep('licorice', { color: '#1a3a5c', sele: NP, radius: 0.1 }, 'proteinAtoms');
    break;
  }

  /* Ghost — ultra-faint transparent, atmospheric depth */
  case 'ghost': {
    addRep('surface', { color: '#c9a84c', opacity: 0.08, surfaceType: 'av', surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('cartoon', { color: '#999999', sele: P, smoothSheet: true, scale: 4.0, opacity: 0.2 }, 'proteinRibbon');
    addRep('ball+stick', { color: '#ffffff', sele: LM, radius: 0.3, multipleBond: true, opacity: 0.7 }, 'ligandAtoms');
    addRep('ball+stick', { color: '#cccccc', sele: NP, radius: 0.18, multipleBond: true, opacity: 0.4 }, 'proteinAtoms');
    break;
  }

  /* Oil Paint — rich warmth, gold/cream/sepia palette, bold forms */
  case 'oil-paint': {
    addRep('surface', { color: '#a0522d', opacity: 0.65, surfaceType: 'av', surfaceSelection: 'protein', roughness: 1.0 }, 'proteinRibbon');
    addRep('cartoon', { color: '#c9a84c', sele: SEL_HELIX, smoothSheet: true, subdiv: 6, scale: 14.0 }, 'proteinRibbon');
    addRep('cartoon', { color: '#d4a574', sele: SEL_SHEET, smoothSheet: true, subdiv: 6, scale: 12.0 }, 'proteinRibbon');
    addRep('tube',   { color: '#8b7355', sele: SEL_COIL, radius: 0.08, subdiv: 4 }, 'proteinRibbon');
    addRep('ball+stick', { color: '#c9a84c', sele: LM, radius: 0.35, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: '#d4a574', sele: NP, radius: 0.2, multipleBond: true }, 'proteinAtoms');
    break;
  }

  /* Publication — clean white background, muted palette, print-ready */
  case 'publication': {
    addRep('cartoon', { color: '#4a4a4a', sele: SEL_HELIX, smoothSheet: true, subdiv: 6, scale: 14.0 }, 'proteinRibbon');
    addRep('cartoon', { color: '#6a6a6a', sele: SEL_SHEET, smoothSheet: true, subdiv: 6, scale: 12.0 }, 'proteinRibbon');
    addRep('tube',   { color: '#9a9a9a', sele: SEL_COIL, radius: 0.08, subdiv: 4 }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: '#888888', sele: NP, radius: 0.15, multipleBond: true }, 'proteinAtoms');
    break;
  }

  } // end switch

  setTimeout(() => {
    try { component.autoView(400); } catch { /* noop */ }
  }, 100);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   REACT COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function MolecularViewer({ className, projectId }: MolecularViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const [pickingMode, setPickingMode] = useState<'distance' | 'angle' | 'torsion' | null>(null);
  const [nglReady, setNglReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<string>('');
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);

  const {
    selectedAtom, setSelectedAtom,
    selectedMolecule,
    vizCommand, setVizCommand,
    trajFrame,
    viewPreset, setViewPreset,
    colorScheme,
    visibilityFlags,
    nmrEnsemble, setNmrEnsemble,
    nmrPlaying, setNmrPlaying,
    nmrFrame, setNmrFrame,
    nmrTotalFrames, setNmrTotalFrames,
  } = useStore();

  const reprStoreRef = useRef<Record<string, any[]>>({
    proteinRibbon: [],
    proteinAtoms:  [],
    ligandAtoms:   [],
    ligandRibbon:  [],
  });

  /* ── NGL init ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || stageRef.current) return;
    let destroyed = false;

    const initNGL = async () => {
      try {
        const NGL = await import('ngl');
        if (destroyed || !containerRef.current) return;

        const stage = new NGL.Stage(containerRef.current, { backgroundColor: '#f9f7f4' });
        stageRef.current = stage;
        stage.handleResize();
        setNglReady(true);

        try {
          const comp = await stage.loadFile('rcsb://1crn', { defaultRepresentation: false });
          if (comp) {
            await applyPreset(comp, 'dynacule', stage, reprStoreRef.current);
            comp.setName('default-sample');
            setTimeout(() => { try { stage.autoView(400); } catch { /* noop */ } }, 100);
          }
        } catch {
          // offline / CORS — empty canvas is fine
        }
      } catch (err) {
        setLoadError('NGL requires WebGL. Please use a modern browser.');
        console.warn('NGL load failed:', err);
      }
    };

    initNGL();
    return () => {
      destroyed = true;
      if (stageRef.current) {
        try { stageRef.current.dispose(); } catch { /* noop */ }
        stageRef.current = null;
      }
      setNglReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load molecule into viewer ─────────────────────────────────────────── */
  const loadMolecule = useCallback(async (mol: MoleculeData) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Reset NMR state on new molecule load
    if (nmrAnimRef.current) { cancelAnimationFrame(nmrAnimRef.current); nmrAnimRef.current = null; }
    nmrCompRef.current = null;
    setNmrEnsemble(false);
    setNmrPlaying(false);
    setNmrFrame(0);
    setNmrTotalFrames(0);

    try {
      setLoadStatus('Loading…');

      stage.eachComponent((c: any) => {
        if (c.name?.startsWith('highlight-') || c.name === '__measurements__') return;
        stage.removeComponent(c);
      });

      let comp;

      if (mol.source === 'rcsb') {
        // Load directly from RCSB PDB — use asTrajectory for NMR ensemble detection
        comp = await stage.loadFile(`rcsb://${mol.name.toLowerCase()}`, { defaultRepresentation: false, asTrajectory: true });
      } else {
        // Load from backend API
        const { pdb } = await moleculeApi.getPdb(mol.id);
        const blob = new Blob([pdb], { type: 'text/plain' });
        comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false, asTrajectory: true });
      }

      if (comp) {
        comp.setName('loaded-molecule');
        await applyPreset(comp, viewPreset, stage, reprStoreRef.current);

        // Detect NMR ensemble: multi-model structure
        // NGL stores models as structure.frames when loaded with asTrajectory
        const numFrames = comp?.structure?.frames?.length ?? 0;
        if (numFrames > 1) {
          // Create a trajectory component so we can step through frames
          const trajComp = comp.addTrajectory();
          nmrCompRef.current = trajComp;
          setNmrEnsemble(true);
          setNmrTotalFrames(numFrames);
          setNmrFrame(0);
          setNmrPlaying(true); // auto-play NMR ensemble loop
        }
      }

      setLoadStatus('');
    } catch (err) {
      console.warn('Failed to load molecule:', err);
      setLoadStatus('Load failed');
    }
  }, [viewPreset]);

  /* ── Watch selected molecule ───────────────────────────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    loadMolecule(selectedMolecule);
  }, [selectedMolecule, nglReady, loadMolecule]);

  /* ── Re-apply preset when it changes ───────────────────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    const stage = stageRef.current;
    if (!stage) return;

    stage.eachComponent((c: any) => {
      if (c.name === 'loaded-molecule') {
        applyPreset(c, viewPreset, stage, reprStoreRef.current);
      }
    });
  }, [viewPreset, nglReady]);

  /* ── Visibility flags → toggle representations ─────────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;

    const categoryMap: Record<string, 'showRibbon' | 'showAtoms'> = {
      proteinRibbon: 'showRibbon',
      ligandRibbon:  'showRibbon',
      proteinAtoms:  'showAtoms',
      ligandAtoms:   'showAtoms',
    };

    (['proteinRibbon', 'proteinAtoms', 'ligandAtoms', 'ligandRibbon'] as const).forEach((cat) => {
      const flag = categoryMap[cat];
      const visible = visibilityFlags[flag];
      const reprs = reprStoreRef.current[cat] || [];
      reprs.forEach((repr: any) => {
        try { repr.setVisibility(visible); } catch {}
      });
    });
  }, [visibilityFlags, nglReady, selectedMolecule]);

  /* ── Color scheme → re-color all representations ────────────────────────── */
  useEffect(() => {
    if (!nglReady || !stageRef.current || !selectedMolecule) return;
    const stage = stageRef.current;

    const colorMap: Record<string, string> = {
      element:       'element',
      chain:         'chainindex',
      secstruct:     'secstruct',
      bfactor:       'bfactor',
      residueindex:  'residueindex',
      occupancy:     'occupancy',
    };
    const nglColor = colorMap[colorScheme] || 'element';

    stage.eachComponent((c: any) => {
      if (c.name !== 'loaded-molecule') return;
      c.eachRepresentation((repr: any) => {
        try {
          if (nglColor === 'element') {
            repr.setParameters({ color: 'element', colorScheme: elementColorScheme() });
          } else {
            repr.setParameters({ color: nglColor });
          }
        } catch { /* skip reps that don't support setParameters */ }
      });
    });
  }, [colorScheme, nglReady, selectedMolecule]);

  /* ── Viz command handling ──────────────────────────────────────────────── */
  const overlayRef = useRef<any>(null);
  const trajCompRef = useRef<any>(null);
  const nmrCompRef = useRef<any>(null);
  const nmrAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!nglReady || !stageRef.current) return;
    const stage = stageRef.current;
    if (!vizCommand) return;

    const handleCommand = async () => {
      try {
        if (vizCommand.type === 'clear' || vizCommand.type === 'qm') {
          if (overlayRef.current) { try { stage.removeComponent(overlayRef.current); } catch {} overlayRef.current = null; }
          if (trajCompRef.current) { try { stage.removeComponent(trajCompRef.current); } catch {} trajCompRef.current = null; }
          setLoadStatus('');
          return;
        }

        if (vizCommand.type === 'docking' && vizCommand.pdbData) {
          if (overlayRef.current) { try { stage.removeComponent(overlayRef.current); } catch {} }
          setLoadStatus('Loading ligand…');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });
          if (comp) {
            comp.addRepresentation('ball+stick', { color: 'element', colorScheme: elementColorScheme(), radius: 0.3, multipleBond: true, opacity: 1, sele: SEL_NO_NONPOLARH });
            comp.addRepresentation('label', { labelType: 'text', color: '#e67e22', fontSize: 0.5, showOption: 0 });
            comp.setName('docking-ligand');
            overlayRef.current = comp;
          }
          setLoadStatus('');
        }

        if (vizCommand.type === 'md' && vizCommand.pdbData) {
          if (trajCompRef.current) { try { stage.removeComponent(trajCompRef.current); } catch {} }
          setLoadStatus('Loading trajectory…');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false, asTrajectory: true });
          if (comp) {
            comp.addRepresentation('ribbon', { color: 'element', colorScheme: elementColorScheme(), subdiv: 2, opacity: 1 });
            comp.addRepresentation('ball+stick', { color: 'element', colorScheme: elementColorScheme(), radius: 0.2, sele: `(${SEL_IONS_AND_LIGAND}) and ${SEL_NO_NONPOLARH}` });
            comp.setName('md-trajectory');
            trajCompRef.current = comp;
          }
          setLoadStatus('');
        }
      } catch (err) {
        console.warn('Viz command failed:', err);
        setLoadStatus('Viz error');
      }
    };

    handleCommand();
  }, [nglReady, vizCommand]);

  /* ── Trajectory frame control ──────────────────────────────────────────── */
  useEffect(() => {
    if (!trajCompRef.current) return;
    try { trajCompRef.current.setFrame(trajFrame); } catch { /* noop */ }
  }, [trajFrame]);

  /* ── NMR ensemble looping animation ────────────────────────────────────── */
  useEffect(() => {
    if (!nmrEnsemble || !nmrPlaying || !nmrCompRef.current) return;

    const FRAME_INTERVAL = 200; // ms per frame — smooth but not too fast
    let lastTime = 0;
    let currentFrame = nmrFrame;

    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      if (time - lastTime >= FRAME_INTERVAL) {
        lastTime = time;
        currentFrame = (currentFrame + 1) % nmrTotalFrames;
        setNmrFrame(currentFrame);
        try { nmrCompRef.current?.setFrame(currentFrame); } catch { /* noop */ }
      }
      nmrAnimRef.current = requestAnimationFrame(animate);
    };

    nmrAnimRef.current = requestAnimationFrame(animate);
    return () => {
      if (nmrAnimRef.current) { cancelAnimationFrame(nmrAnimRef.current); nmrAnimRef.current = null; }
    };
  }, [nmrEnsemble, nmrPlaying, nmrTotalFrames]);

  /* ── NMR manual frame control ───────────────────────────────────────────── */
  useEffect(() => {
    if (!nmrEnsemble || nmrPlaying || !nmrCompRef.current) return;
    try { nmrCompRef.current.setFrame(nmrFrame); } catch { /* noop */ }
  }, [nmrFrame, nmrEnsemble, nmrPlaying]);

  /* ── Picking mode cursor ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = pickingMode ? 'crosshair' : 'default';
  }, [pickingMode]);

  /* ── Atom click → store ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!stageRef.current || !nglReady) return;
    const stage = stageRef.current;

    const onClick = (pickingProxy: any) => {
      if (!pickingProxy) return;
      const atom = pickingProxy.object?.atom;
      if (!atom) return;
      setSelectedAtom({ index: atom.index, serial: atom.serial, name: atom.atomname, element: atom.element, x: atom.x, y: atom.y, z: atom.z });
    };

    stage.signals.clicked.add(onClick);
    return () => { try { stage.signals.clicked.remove(onClick); } catch {} };
  }, [nglReady, setSelectedAtom]);

  /* ── Selected-atom highlight ───────────────────────────────────────────── */
  useEffect(() => {
    if (!stageRef.current || !selectedAtom) return;
    const stage = stageRef.current;

    stage.eachComponent((c: any) => {
      if (c.name?.startsWith('highlight-')) stage.removeComponent(c);
    });

    try {
      const NGL = require('ngl');
      const shape = new NGL.Shape('highlight-sphere');
      shape.addSphere([selectedAtom.x, selectedAtom.y, selectedAtom.z], [1, 1, 0], 0.5, 'Selected atom');
      const comp = stage.addComponentFromObject(shape);
      comp.addRepresentation('buffer', { opacity: 0.6 });
      comp.setName(`highlight-${selectedAtom.index}`);
    } catch { /* noop */ }
  }, [selectedAtom]);

  const pickDistance = useCallback(() => setPickingMode('distance'), []);
  const pickAngle    = useCallback(() => setPickingMode('angle'),    []);
  const pickTorsion  = useCallback(() => setPickingMode('torsion'),  []);
  const pickNone     = useCallback(() => setPickingMode(null),        []);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center text-navy/50 font-mono text-sm ${className ?? ''}`}>
        {loadError}
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {loadStatus && (
        <div className="absolute top-2 left-2 bg-navy/80 text-cream text-xs font-mono px-2 py-1 rounded">
          {loadStatus}
        </div>
      )}

      {nglReady && !selectedMolecule && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-navy/30 font-mono text-sm">No molecule loaded</p>
            <p className="text-navy/20 font-mono text-[10px] mt-1">
              Enter SMILES, PDB ID, or upload a file
            </p>
          </div>
        </div>
      )}

      {/* ── Preset toolbar ──────────────────────────────────────────────── */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 max-w-[240px]">
          <div className="flex gap-1 flex-wrap justify-end">
            {['dynacule', 'cartoon', 'surface', 'cpk', 'rainbow', 'dark-matter', 'glass', 'publication'].map((p) => (
              <button
                key={p}
                onClick={() => { (setViewPreset as (p: string) => void)(p); setPresetDropdownOpen(false); }}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  viewPreset === p ? 'bg-gold text-navy font-semibold' : 'bg-navy/80 text-cream/80 hover:bg-navy hover:text-cream'
                }`}
              >
                {PRESET_LABELS[p] || p}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
              className="w-full px-2 py-1 rounded text-xs font-mono bg-navy/80 text-cream/70 hover:bg-navy hover:text-cream transition-colors text-left flex items-center justify-between"
            >
              <span className="truncate">{PRESET_LABELS[viewPreset] || viewPreset}</span>
              <span className="text-[8px] ml-1">{presetDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {presetDropdownOpen && (
              <div className="absolute right-0 mt-1 w-64 max-h-[70vh] overflow-y-auto bg-navy border border-gold/30 rounded-lg shadow-2xl z-50">
                {PRESET_CATEGORIES.map((cat) => (
                  <div key={cat.label}>
                    <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-gold font-mono border-b border-gold/10">
                      {cat.label}
                    </div>
                    {cat.presets.map((p) => (
                      <button
                        key={p}
                        onClick={() => { (setViewPreset as (p: string) => void)(p); setPresetDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                          viewPreset === p ? 'bg-gold/20 text-cream font-semibold' : 'text-cream/70 hover:bg-gold/10 hover:text-cream'
                        }`}
                      >
                        {PRESET_LABELS[p] || p}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NMR ensemble controls ────────────────────────────────────────── */}
      {nglReady && selectedMolecule && nmrEnsemble && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-navy/90 rounded-lg px-3 py-1.5 border border-gold/20">
          <span className="text-[9px] font-mono text-gold uppercase tracking-wider">NMR</span>
          <button
            onClick={() => setNmrPlaying(!nmrPlaying)}
            className="px-2 py-0.5 rounded text-xs font-mono bg-gold/20 text-cream hover:bg-gold/40 transition-colors"
          >
            {nmrPlaying ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, nmrTotalFrames - 1)}
            value={nmrFrame}
            onChange={(e) => { setNmrPlaying(false); setNmrFrame(Number(e.target.value)); }}
            className="w-32 h-1 accent-gold cursor-pointer"
          />
          <span className="text-[10px] font-mono text-cream/60">
            {nmrFrame + 1}/{nmrTotalFrames}
          </span>
        </div>
      )}

      {/* ── Picking mode toolbar ──────────────────────────────────────── */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 left-2 flex gap-1 text-xs font-mono">
          <button onClick={pickDistance} className={`px-2 py-1 rounded ${pickingMode === 'distance' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}>Dist</button>
          <button onClick={pickAngle}    className={`px-2 py-1 rounded ${pickingMode === 'angle' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}>Angle</button>
          <button onClick={pickTorsion}  className={`px-2 py-1 rounded ${pickingMode === 'torsion' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}>Torsion</button>
          <button onClick={pickNone}     className="px-2 py-1 rounded bg-navy/80 text-cream hover:bg-navy transition-colors">Reset</button>
        </div>
      )}

      {pickingMode && (
        <div className="absolute top-2 left-2 mt-8 bg-amber-400 text-navy text-xs font-mono px-2 py-1 rounded">
          Picking: {pickingMode}
        </div>
      )}
    </div>
  );
}