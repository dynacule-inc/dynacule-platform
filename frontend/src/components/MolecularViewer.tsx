'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi } from '@/lib/moleculeApi';
import type { ViewPreset } from '@/lib/store';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  NGL Stage Component                                                        */
/*  NGL requires WebGL — only runs in the browser.                            */
/* ─────────────────────────────────────────────────────────────────────────── */

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
  // Standard Topology & Structure
  rainbow: 'Rainbow',
  'chain-surface': 'Chain Surface',
  'secondary-structure': 'Secondary Structure',
  'bfactor-putty': 'B-Factor Putty',
  'standard-cpk-licorice': 'Standard CPK Licorice',
  'backbone-trace': 'Backbone Trace',
  'vdw-spacefill': 'VDW Spacefill',
  'nucleic-acid-ladder': 'Nucleic Acid Ladder',
  'hydrophobicity-surface': 'Hydrophobicity Surface',
  'ribbon-stick': 'Ribbon & Stick',
  // Ligands & Binding Pockets
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
  // Physicochemical & Electrostatic
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
  // Molecular Dynamics & Ensembles
  'rmsf-putty': 'RMSF Putty',
  'pca-porcupine': 'PCA Porcupine',
  'trajectory-density-grid': 'Trajectory Density Grid',
  'hydration-site-iso': 'Hydration Site Iso-surface',
  dccm: 'Dynamic Cross-Correlation Map',
  'lipid-bilayer': 'Lipid Bilayer',
  'ion-permeation-track': 'Ion Permeation Track',
  'trajectory-ribbon-overlay': 'Trajectory Ribbon Overlay',
  'salt-bridge-network': 'Salt Bridge Network',
  'unfolding-pathway': 'Unfolding Pathway',
  // Advanced Meshes & Specialized
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
};

interface PresetCategory { label: string; presets: string[]; }

const PRESET_CATEGORIES: PresetCategory[] = [
  { label: 'Standard Topology & Structure', presets: ['dynacule', 'rainbow', 'chain-surface', 'secondary-structure', 'bfactor-putty', 'standard-cpk-licorice', 'backbone-trace', 'vdw-spacefill', 'nucleic-acid-ladder', 'hydrophobicity-surface', 'ribbon-stick'] },
  { label: 'Ligands & Binding Pockets', presets: ['ligand-emphasis', 'pocket-surface', 'pharmacophore-map', 'polar-contacts', 'halogen-bonds', 'pi-pi-stacking', 'steric-clash-map', 'receptor-cavity-mesh', 'solvent-excluded-ligand', 'docking-score-gradient'] },
  { label: 'Physicochemical & Electrostatic', presets: ['electrostatic-coulombic', 'poisson-boltzmann', 'mlp', 'conservation-consurf', 'partial-charge-map', 'aromaticity-highlight', 'pka-shift-surface', 'dipole-moment-vector', 'solvation-free-energy', 'isoelectric-surface-point'] },
  { label: 'Molecular Dynamics & Ensembles', presets: ['rmsf-putty', 'pca-porcupine', 'trajectory-density-grid', 'hydration-site-iso', 'dccm', 'lipid-bilayer', 'ion-permeation-track', 'trajectory-ribbon-overlay', 'salt-bridge-network', 'unfolding-pathway'] },
  { label: 'Advanced Meshes & Specialized', presets: ['cryoem-density', 'xray-2fofc', 'difference-map-fofc', 'ambient-occlusion', 'depth-cued-fog', 'nci', 'sasa-dot-map', 'alphafold-plddt', 'disulfide-bridges', 'ramachandran-outliers'] },
];

/* ── CPK-inspired element color palette ───────────────────────────────────── */
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

/* ── Apply a preset to a component ─────────────────────────────────────────── */
/**
 * @param component  NGL StructureComponent / RepresentationComponent
 * @param preset     Active view preset
 * @param stage      NGL Stage (passed for potential shape/shell use)
 * @param nearLigand Selection string targeting atoms within 8A of any
 *                   non-protein atom (ligand, waters, ions, metals).
 *                   Passed as '' when no such atoms exist in the structure.
 * @param reprStore  Object with arrays proteinRibbon, proteinAtoms,
 *                   ligandAtoms, ligandRibbon to collect repr refs.
 */
async function applyPreset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any,
  preset: ViewPreset,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stage: any,
  nearLigand: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reprStore?: Record<string, any[]>,
) {
  component.removeAllRepresentations();

  // Clear and initialize repr store
  if (reprStore) {
    reprStore.proteinRibbon = [];
    reprStore.proteinAtoms = [];
    reprStore.ligandAtoms = [];
    reprStore.ligandRibbon = [];
  }

  // Helper to add a representation and push it into the category array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addRep(type: string, params: any, category: string): any {
    const repr = component.addRepresentation(type, params);
    if (repr && reprStore) reprStore[category].push(repr);
    return repr;
  }

  const elemCol = elementColorScheme();

  /* ── Near-ligand protein selection ─────────────────────────────────────── */
  // Protein atoms within 8A of ligand/non-water non-protein atoms
  const nearProt = nearLigand ? `(protein within 8A of (${nearLigand}))` : '';

  /* ── Non-water non-protein selection (actual small-molecule ligands) ──────── */
  // Excludes HOH (waters), NA/CL/K/MG/CA/ZN/FE/... (ions)
  const ligandOnly = 'not (protein or HOH or NA or CL or K or MG or CA or ZN or FE or MN or CO or CU)';

  switch (preset) {
    /* ── Dynacule ────────────────────────────────────────────────────────── */
    case 'dynacule': {
      // CA-only cartoon: helices — scale 10-12 occludes any underlying CA tube
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:     1,
        Sele:        'CA and helix',
        smoothSheet: true,
        subdiv:      6,
        scale:       12.0,
      }, 'proteinRibbon');
      // CA-only cartoon: sheets
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:     1,
        Sele:        'CA and sheet',
        subdiv:      6,
        scale:       10.0,
      }, 'proteinRibbon');
      // CA-only tube: coils — thin, deliberately smaller than cartoon
      addRep('tube', {
        color:       'element',
        colorScheme: elemCol,
        opacity:     1,
        Sele:        'CA and coil',
        radius:      0.12,
        subdiv:      4,
      }, 'proteinRibbon');
      // Ball+stick: small-molecule ligands only (no waters, no ions)
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        opacity:       1,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      // Ball+stick: protein atoms within 8A of ligand (sidechains + CA)
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          opacity:        1,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Cartoon ─────────────────────────────────────────────────────────── */
    case 'cartoon': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:      1,
        Sele:        'CA and helix',
        smoothSheet: true,
        subdiv:       6,
        scale:        5.0,
      }, 'proteinRibbon');
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:      1,
        Sele:        'CA and sheet',
        subdiv:       6,
        scale:        4.0,
      }, 'proteinRibbon');
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:      1,
        Sele:        'CA and coil',
        scale:        3.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Ribbon ──────────────────────────────────────────────────────────── */
    case 'ribbon': {
      addRep('ribbon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:      1,
        Sele:        'CA',
        smoothSheet: true,
        subdiv:       8,
        scale:        9.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Surface ────────────────────────────────────────────────────────── */
    case 'surface': {
      addRep('surface', {
        color:            '#d4c5a9',
        opacity:          0.82,
        surfaceType:       'av',
        surfaceSelection:  'protein',
        contour:           false,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── CPK ────────────────────────────────────────────────────────────── */
    case 'cpk': {
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        opacity:       1,
        Sele:         'not protein',
      }, 'ligandAtoms');
      break;
    }

    /* ── Backbone ───────────────────────────────────────────────────────── */
    case 'backbone': {
      addRep('backbone', {
        color:        'element',
        colorScheme:  elemCol,
        opacity:       1,
        radius:       0.3,
      }, 'proteinRibbon');
      break;
    }

    /* ══════════════════════════════════════════════════════════════════════ */
    /*  Standard Topology & Structure (new presets)                         */
    /* ══════════════════════════════════════════════════════════════════════ */

    /* ── Rainbow ────────────────────────────────────────────────────────── */
    case 'rainbow': {
      addRep('cartoon', {
        color:       'residueindex',
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      6,
        scale:       4.0,
      }, 'proteinRibbon');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── Chain Surface ──────────────────────────────────────────────────── */
    case 'chain-surface': {
      addRep('surface', {
        color:            'chainindex',
        opacity:          0.8,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.25,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── Secondary Structure ────────────────────────────────────────────── */
    case 'secondary-structure': {
      addRep('cartoon', {
        color:       'secstruct',
        Sele:        'protein',
        smoothSheet: true,
        scale:       5.0,
      }, 'proteinRibbon');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── B-Factor Putty ──────────────────────────────────────────────────── */
    case 'bfactor-putty': {
      addRep('cartoon', {
        color:       'bfactor',
        Sele:        'protein',
        smoothSheet: true,
        scale:       4.0,
      }, 'proteinRibbon');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── Standard CPK Licorice ──────────────────────────────────────────── */
    case 'standard-cpk-licorice': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       4.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.2,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Backbone Trace ──────────────────────────────────────────────────── */
    case 'backbone-trace': {
      addRep('backbone', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'CA',
        radius:      0.3,
      }, 'proteinRibbon');
      break;
    }

    /* ── VDW Spacefill ──────────────────────────────────────────────────── */
    case 'vdw-spacefill': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       4.0,
      }, 'proteinRibbon');
      addRep('spacefill', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        ligandOnly,
        radius:      1.0,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('spacefill', {
          color:       'element',
          colorScheme: elemCol,
          Sele:        nearProt,
          radius:      1.0,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Nucleic Acid Ladder ────────────────────────────────────────────── */
    case 'nucleic-acid-ladder': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'nucleic',
        scale:       5.0,
      }, 'proteinRibbon');
      break;
    }

    /* ── Hydrophobicity Surface ─────────────────────────────────────────── */
    case 'hydrophobicity-surface': {
      addRep('surface', {
        color:            '#d4a017',
        opacity:          0.85,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Ribbon & Stick ─────────────────────────────────────────────────── */
    case 'ribbon-stick': {
      addRep('ribbon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        scale:       7.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ══════════════════════════════════════════════════════════════════════ */
    /*  Ligands & Binding Pockets                                            */
    /* ══════════════════════════════════════════════════════════════════════ */

    /* ── Ligand Emphasis ────────────────────────────────────────────────── */
    case 'ligand-emphasis': {
      addRep('surface', {
        color:            '#ffffff',
        opacity:          0.2,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.4,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ── Pocket Surface ──────────────────────────────────────────────────── */
    case 'pocket-surface': {
      if (nearProt) {
        addRep('surface', {
          color:       'element',
          colorScheme: elemCol,
          surfaceType: 'av',
          Sele:        nearProt,
        }, 'proteinRibbon');
      }
      break;
    }

    /* ── Pharmacophore Map ──────────────────────────────────────────────── */
    case 'pharmacophore-map': {
      addRep('licorice', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        ligandOnly,
      }, 'ligandAtoms');
      addRep('spacefill', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        ligandOnly,
        radius:      0.1,
      }, 'ligandAtoms');
      break;
    }

    /* ── Polar Contacts ─────────────────────────────────────────────────── */
    case 'polar-contacts': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Halogen Bonds ──────────────────────────────────────────────────── */
    case 'halogen-bonds': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         'F or CL or BR or I',
      }, 'proteinAtoms');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── Pi-Pi Stacking ──────────────────────────────────────────────────── */
    case 'pi-pi-stacking': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        scale:       2.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         `ARO${nearProt ? ` and (${nearProt})` : ''}`,
      }, 'proteinAtoms');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ── Steric Clash Map ────────────────────────────────────────────────── */
    case 'steric-clash-map': {
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.5,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.5,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      addRep('contact', {
        color:       '#ff4444',
        Sele:        ligandOnly,
        radius:      0.5,
      }, 'proteinAtoms');
      break;
    }

    /* ── Receptor Cavity Mesh ────────────────────────────────────────────── */
    case 'receptor-cavity-mesh': {
      addRep('surface', {
        color:            '#cccccc',
        opacity:          0.15,
        surfaceType:       'ms',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ── Solvent-Excluded Ligand ────────────────────────────────────────── */
    case 'solvent-excluded-ligand': {
      addRep('dot', {
        color:  '#ffffff',
        Sele:   ligandOnly,
        dotSize: 0.5,
      }, 'ligandAtoms');
      break;
    }

    /* ── Docking Score Gradient ──────────────────────────────────────────── */
    case 'docking-score-gradient': {
      addRep('ball+stick', {
        color:        'bfactor',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ══════════════════════════════════════════════════════════════════════ */
    /*  Physicochemical & Electrostatic                                      */
    /* ══════════════════════════════════════════════════════════════════════ */

    /* ── Electrostatic (Coulombic) ──────────────────────────────────────── */
    case 'electrostatic-coulombic': {
      addRep('surface', {
        color:            'electrostatic',
        opacity:          0.8,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Poisson-Boltzmann Surface ───────────────────────────────────────── */
    case 'poisson-boltzmann': {
      addRep('surface', {
        color:            'electrostatic',
        opacity:          0.75,
        surfaceType:       'ms',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Molecular Lipophilicity Potential ──────────────────────────────── */
    case 'mlp': {
      addRep('surface', {
        color:            '#c9a84c',
        opacity:          0.7,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Evolutionary Conservation ───────────────────────────────────────── */
    case 'conservation-consurf': {
      addRep('cartoon', {
        color:       'occupancy',
        Sele:        'protein',
        scale:       4.0,
      }, 'proteinRibbon');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── Partial Charge Map ──────────────────────────────────────────────── */
    case 'partial-charge-map': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.2,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Aromaticity Highlight ──────────────────────────────────────────── */
    case 'aromaticity-highlight': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         `(ARO and (${nearProt}))`,
        }, 'proteinAtoms');
      }
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ── pKa Shift Surface ───────────────────────────────────────────────── */
    case 'pka-shift-surface': {
      addRep('surface', {
        color:            '#c9a84c',
        opacity:          0.7,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Dipole Moment Vector ────────────────────────────────────────────── */
    case 'dipole-moment-vector': {
      addRep('backbone', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'CA',
        radius:      0.3,
      }, 'proteinRibbon');
      break;
    }

    /* ── Solvation Free Energy ───────────────────────────────────────────── */
    case 'solvation-free-energy': {
      addRep('surface', {
        color:            '#5b7db1',
        opacity:          0.7,
        surfaceType:       'sas',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Isoelectric Surface Point ───────────────────────────────────────── */
    case 'isoelectric-surface-point': {
      addRep('surface', {
        color:            '#8b5cf6',
        opacity:          0.7,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ══════════════════════════════════════════════════════════════════════ */
    /*  Molecular Dynamics & Ensembles                                       */
    /* ══════════════════════════════════════════════════════════════════════ */

    /* ── RMSF Putty ──────────────────────────────────────────────────────── */
    case 'rmsf-putty': {
      addRep('tube', {
        color:  'bfactor',
        Sele:   'CA',
        radius: 0.5,
      }, 'proteinRibbon');
      break;
    }

    /* ── PCA Porcupine ───────────────────────────────────────────────────── */
    case 'pca-porcupine': {
      addRep('backbone', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'CA',
        radius:      0.3,
      }, 'proteinRibbon');
      break;
    }

    /* ── Trajectory Density Grid ─────────────────────────────────────────── */
    case 'trajectory-density-grid': {
      addRep('surface', {
        color:            '#66c2a5',
        opacity:          0.3,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Hydration Site Iso-surface ──────────────────────────────────────── */
    case 'hydration-site-iso': {
      addRep('surface', {
        color:            '#80b1d3',
        opacity:          0.3,
        surfaceType:       'av',
        surfaceSelection:  'HOH',
      }, 'ligandRibbon');
      break;
    }

    /* ── Dynamic Cross-Correlation Map ──────────────────────────────────── */
    case 'dccm': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.15,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.12,
          multipleBond:  true,
          Sele:         nearProt,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Lipid Bilayer ──────────────────────────────────────────────────── */
    case 'lipid-bilayer': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
      }, 'proteinRibbon');
      addRep('line', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'not (protein or HOH)',
      }, 'ligandAtoms');
      break;
    }

    /* ── Ion Permeation Track ────────────────────────────────────────────── */
    case 'ion-permeation-track': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        scale:       4.0,
      }, 'proteinRibbon');
      addRep('spacefill', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'NA or K or CL or CA or MG',
        radius:      0.5,
      }, 'ligandAtoms');
      break;
    }

    /* ── Trajectory Ribbon Overlay ───────────────────────────────────────── */
    case 'trajectory-ribbon-overlay': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        scale:       3.0,
      }, 'proteinRibbon');
      break;
    }

    /* ── Salt Bridge Network ─────────────────────────────────────────────── */
    case 'salt-bridge-network': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      if (nearProt) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         `((ASP or GLU or LYS or ARG or HIS) and (${nearProt}))`,
        }, 'proteinAtoms');
      }
      break;
    }

    /* ── Unfolding Pathway ───────────────────────────────────────────────── */
    case 'unfolding-pathway': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        scale:       2.0,
        opacity:     0.5,
      }, 'proteinRibbon');
      break;
    }

    /* ══════════════════════════════════════════════════════════════════════ */
    /*  Advanced Meshes & Specialized                                         */
    /* ══════════════════════════════════════════════════════════════════════ */

    /* ── Cryo-EM Density Fit ────────────────────────────────────────────── */
    case 'cryoem-density': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('surface', {
        color:            '#e0e0e0',
        opacity:          0.15,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── X-ray Diffraction (2Fo-Fc) ─────────────────────────────────────── */
    case 'xray-2fofc': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
      }, 'proteinRibbon');
      addRep('surface', {
        color:            '#4a90d9',
        opacity:          0.12,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Difference Map (Fo-Fc) ──────────────────────────────────────────── */
    case 'difference-map-fofc': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('surface', {
        color:            '#ff6b6b',
        opacity:          0.15,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ── Ambient Occlusion Surface ───────────────────────────────────────── */
    case 'ambient-occlusion': {
      addRep('surface', {
        color:            '#c4b998',
        opacity:          0.85,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      break;
    }

    /* ── Depth-Cued Fog ──────────────────────────────────────────────────── */
    case 'depth-cued-fog': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        scale:       3.0,
      }, 'proteinRibbon');
      break;
    }

    /* ── Non-Covalent Interactions ───────────────────────────────────────── */
    case 'nci': {
      addRep('surface', {
        color:            '#e5c494',
        opacity:          0.7,
        surfaceType:       'av',
        surfaceSelection:  'protein',
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         ligandOnly,
      }, 'ligandAtoms');
      break;
    }

    /* ── SASA Dot Map ──────────────────────────────────────────────────── */
    case 'sasa-dot-map': {
      addRep('dot', {
        color:   '#8da0cb',
        Sele:    'protein',
        dotSize: 0.4,
      }, 'proteinRibbon');
      break;
    }

    /* ── AlphaFold Confidence (pLDDT) ────────────────────────────────────── */
    case 'alphafold-plddt': {
      addRep('cartoon', {
        color:       'bfactor',
        Sele:        'protein',
        scale:       4.0,
      }, 'proteinRibbon');
      if (nearLigand) {
        addRep('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.3,
          multipleBond:  true,
          Sele:         ligandOnly,
        }, 'ligandAtoms');
      }
      break;
    }

    /* ── Disulfide Bridges ──────────────────────────────────────────────── */
    case 'disulfide-bridges': {
      addRep('backbone', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'CA',
        radius:      0.3,
      }, 'proteinRibbon');
      addRep('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.4,
        multipleBond:  true,
        Sele:         'SG',
      }, 'ligandAtoms');
      break;
    }

    /* ── Ramachandran Outliers ───────────────────────────────────────────── */
    case 'ramachandran-outliers': {
      addRep('cartoon', {
        color:       'element',
        colorScheme: elemCol,
        Sele:        'protein',
        smoothSheet: true,
        subdiv:      5,
        scale:       3.0,
      }, 'proteinRibbon');
      addRep('spacefill', {
        color:  '#ff0000',
        Sele:   'CA',
        radius: 0.6,
      }, 'proteinAtoms');
      break;
    }
  }

  setTimeout(() => {
    try { component.autoView(400); } catch { /* noop */ }
  }, 100);
}

export default function MolecularViewer({ className, projectId }: MolecularViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  } = useStore();

  /**
   * NGL selection string for all non-protein atoms in the loaded structure.
   * Used to derive the "within 8A of ligand" protein sub-selection.
   * Reset to '' on every new molecule load.
   */
  const ligandAtomsSel = useRef<string>('');

  /**
   * Store to track representations per category for visibility toggling.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reprStoreRef = useRef<Record<string, any[]>>({
    proteinRibbon: [],
    proteinAtoms: [],
    ligandAtoms: [],
    ligandRibbon: [],
  });

  /* ── NGL init ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || stageRef.current) return;
    let destroyed = false;

    const initNGL = async () => {
      try {
        const NGL = await import('ngl');
        if (destroyed || !containerRef.current) return;

        const stage = new NGL.Stage(containerRef.current, {
          backgroundColor: '#f9f7f4',
        });
        stageRef.current = stage;
        stage.handleResize();
        setNglReady(true);

        try {
          const comp = await stage.loadFile('rcsb://1crn', { defaultRepresentation: false });
          if (comp) {
            // 1crn is a pure protein — no near-ligand atoms
            ligandAtomsSel.current = '';
            await applyPreset(comp, 'dynacule', stage, '', reprStoreRef.current);
            comp.setName('default-sample');
            setTimeout(() => {
              try { stage.autoView(400); } catch { /* noop */ }
            }, 100);
          }
        } catch {
          // offline / CORS — empty canvas is acceptable
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
  const loadMolecule = useCallback(async (molId: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    try {
      setLoadStatus('Loading…');
      const { pdb } = await moleculeApi.getPdb(molId);

      stage.eachComponent((c: any) => {
        if (c.name?.startsWith('highlight-') || c.name === '__measurements__') return;
        stage.removeComponent(c);
      });

      const blob = new Blob([pdb], { type: 'text/plain' });
      const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });

      if (comp) {
        comp.setName('loaded-molecule');

        // 'not protein' captures ligands, waters, ions, metals, cofactors, etc.
        ligandAtomsSel.current = 'not protein';

        await applyPreset(comp, viewPreset, stage, ligandAtomsSel.current, reprStoreRef.current);
      }

      setLoadStatus('');
    } catch (err) {
      console.warn('Failed to load molecule:', err);
      setLoadStatus('Load failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPreset]);

  /* ── Watch selected molecule ───────────────────────────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    loadMolecule(selectedMolecule.id);
  }, [selectedMolecule, nglReady, loadMolecule]);

  /* ── Re-apply preset when it changes (no molecule reload needed) ──────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    const stage = stageRef.current;
    if (!stage) return;

    stage.eachComponent((c: any) => {
      if (c.name === 'loaded-molecule') {
        applyPreset(c, viewPreset, stage, ligandAtomsSel.current, reprStoreRef.current);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPreset, nglReady]);

  /* ── Visibility flags → toggle representations ─────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;

    ['proteinRibbon', 'proteinAtoms', 'ligandAtoms', 'ligandRibbon'].forEach((cat) => {
      const visible = visibilityFlags[cat as keyof typeof visibilityFlags];
      const reprs = reprStoreRef.current[cat] || [];
      reprs.forEach((repr: any) => {
        try { repr.setVisibility(visible); } catch {}
      });
    });
  }, [visibilityFlags, nglReady, selectedMolecule]);

  /* ── Color scheme → re-color all representations ──────────────────── */
  useEffect(() => {
    if (!nglReady || !stageRef.current || !selectedMolecule) return;
    const stage = stageRef.current;

    const colorMap: Record<string, string> = {
      element: 'element',
      chain: 'chainindex',
      secstruct: 'secstruct',
      bfactor: 'bfactor',
      residueindex: 'residueindex',
      occupancy: 'occupancy',
    };

    const nglColor = colorMap[colorScheme] || 'element';

    stage.eachComponent((c: any) => {
      if (c.name !== 'loaded-molecule') return;

      c.eachRepresentation((repr: any) => {
        try {
          // Only recolor element-colored reps — skip special-color reps
          const t = (repr.type || '').toLowerCase();
          const isBackbone = ['cartoon', 'ribbon', 'tube', 'backbone'].includes(t);

          if (nglColor === 'element') {
            repr.setParameters({ color: 'element', colorScheme: elementColorScheme() });
          } else {
            // For non-element schemes, no custom colorScheme needed
            repr.setParameters({ color: nglColor });
          }
        } catch {
          // skip reps that don't support setParameters
        }
      });
    });
  }, [colorScheme, nglReady, selectedMolecule]);

  /* ── Viz command handling (docking overlay, MD traj, QM) ───────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trajCompRef = useRef<any>(null);

  useEffect(() => {
    if (!nglReady || !stageRef.current) return;
    const stage = stageRef.current;

    if (!vizCommand) return;

    const handleCommand = async () => {
      try {
        if (vizCommand.type === 'clear' || vizCommand.type === 'qm') {
          if (overlayRef.current) {
            try { stage.removeComponent(overlayRef.current); } catch { /* noop */ }
            overlayRef.current = null;
          }
          if (trajCompRef.current) {
            try { stage.removeComponent(trajCompRef.current); } catch { /* noop */ }
            trajCompRef.current = null;
          }
          setLoadStatus('');
          return;
        }

        if (vizCommand.type === 'docking' && vizCommand.pdbData) {
          if (overlayRef.current) {
            try { stage.removeComponent(overlayRef.current); } catch { /* noop */ }
          }

          setLoadStatus('Loading ligand…');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });

          if (comp) {
            comp.addRepresentation('ball+stick', {
              color:        'element',
              colorScheme:  elementColorScheme(),
              radius:        0.3,
              multipleBond:  true,
              opacity:       1,
            });
            comp.addRepresentation('label', {
              labelType:  'text',
              color:      '#e67e22',
              fontSize:   0.5,
              showOption: 0,
            });
            comp.setName('docking-ligand');
            overlayRef.current = comp;
          }
          setLoadStatus('');
        }

        if (vizCommand.type === 'md' && vizCommand.pdbData) {
          if (trajCompRef.current) {
            try { stage.removeComponent(trajCompRef.current); } catch { /* noop */ }
          }

          setLoadStatus('Loading trajectory…');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, {
            ext:               'pdb',
            defaultRepresentation: false,
            asTrajectory:      true,
          });

          if (comp) {
            comp.addRepresentation('ribbon', {
              color:   'element',
              colorScheme: elementColorScheme(),
              subdiv:   2,
              opacity:  1,
            });
            comp.addRepresentation('ball+stick', {
              color:  'element',
              colorScheme: elementColorScheme(),
              radius: 0.2,
              Sele:   'not protein',
            });
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
    try {
      trajCompRef.current.setFrame(trajFrame);
    } catch { /* noop */ }
  }, [trajFrame]);

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

      setSelectedAtom({
        index:   atom.index,
        serial:   atom.serial,
        name:     atom.atomname,
        element:  atom.element,
        x:        atom.x,
        y:        atom.y,
        z:        atom.z,
      });
    };

    stage.signals.clicked.add(onClick);
    return () => {
      try { stage.signals.clicked.remove(onClick); } catch { /* noop */ }
    };
  }, [nglReady, setSelectedAtom]);

  /* ── Selected-atom highlight ───────────────────────────────────────────── */
  useEffect(() => {
    if (!stageRef.current || !selectedAtom) return;
    const stage = stageRef.current;

    stage.eachComponent((c: any) => {
      if (c.name?.startsWith('highlight-')) stage.removeComponent(c);
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NGL = require('ngl');
      const shape = new NGL.Shape('highlight-sphere');
      shape.addSphere(
        [selectedAtom.x, selectedAtom.y, selectedAtom.z],
        [1, 1, 0], // yellow
        0.5,
        'Selected atom',
      );
      const comp = stage.addComponentFromObject(shape);
      comp.addRepresentation('buffer', { opacity: 0.6 });
      comp.setName(`highlight-${selectedAtom.index}`);
    } catch { /* noop */ }
  }, [selectedAtom]);

  /* ── Picking mode actions ──────────────────────────────────────────────── */
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

      {/* ── Loading status ─────────────────────────────────────────────── */}
      {loadStatus && (
        <div className="absolute top-2 left-2 bg-navy/80 text-cream text-xs font-mono px-2 py-1 rounded">
          {loadStatus}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {nglReady && !selectedMolecule && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-navy/30 font-mono text-sm">No molecule loaded</p>
            <p className="text-navy/20 font-mono text-[10px] mt-1">
              Enter a SMILES string or upload a file
            </p>
          </div>
        </div>
      )}

      {/* ── Preset toolbar ──────────────────────────────────────────────── */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 max-w-[240px]">
          {/* Quick-access buttons for top 6 presets */}
          <div className="flex gap-1 flex-wrap justify-end">
            {['dynacule', 'rainbow', 'secondary-structure', 'surface', 'cpk', 'alphafold-plddt'].map((p) => (
              <button
                key={p}
                onClick={() => {
                  (setViewPreset as (p: string) => void)(p);
                  setPresetDropdownOpen(false);
                }}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  viewPreset === p
                    ? 'bg-gold text-navy font-semibold'
                    : 'bg-navy/80 text-cream/80 hover:bg-navy hover:text-cream'
                }`}
              >
                {PRESET_LABELS[p] || p}
              </button>
            ))}
          </div>
          {/* Full preset dropdown */}
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
                        onClick={() => {
                          (setViewPreset as (p: string) => void)(p);
                          setPresetDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                          viewPreset === p
                            ? 'bg-gold/20 text-cream font-semibold'
                            : 'text-cream/70 hover:bg-gold/10 hover:text-cream'
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

      {/* ── Picking mode toolbar ──────────────────────────────────────── */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 left-2 flex gap-1 text-xs font-mono">
          <button
            onClick={pickDistance}
            className={`px-2 py-1 rounded ${pickingMode === 'distance' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}
          >
            Dist
          </button>
          <button
            onClick={pickAngle}
            className={`px-2 py-1 rounded ${pickingMode === 'angle' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}
          >
            Angle
          </button>
          <button
            onClick={pickTorsion}
            className={`px-2 py-1 rounded ${pickingMode === 'torsion' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}
          >
            Torsion
          </button>
          <button
            onClick={pickNone}
            className="px-2 py-1 rounded bg-navy/80 text-cream hover:bg-navy transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* ── Picking mode badge ────────────────────────────────────────── */}
      {pickingMode && (
        <div className="absolute top-2 left-2 mt-8 bg-amber-400 text-navy text-xs font-mono px-2 py-1 rounded">
          Picking: {pickingMode}
        </div>
      )}
    </div>
  );
}
