  case 'electrostatic-coulombic': {
    addRep('surface', { color: 'electrostatic', opacity: 0.8, surfaceType: 'av', roughness: 0.1, metalness: 0.8, surfaceSelection: 'protein' }, 'proteinRibbon');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: LM, radius: 0.3, multipleBond: true }, 'ligandAtoms');
    addRep('ball+stick', { color: 'element', colorScheme: E, sele: NP, radius: 0.18, multipleBond: true }, 'proteinAtoms');
    break;
  }