"""Cheminformatics utilities using RDKit."""

from rdkit import Chem
from rdkit.Chem import Descriptors, Lipinski
from typing import Optional, Dict, Any


def smiles_to_mol(smiles: str) -> Optional[Chem.Mol]:
    """
    Convert SMILES string to RDKit molecule object.
    
    Args:
        smiles: SMILES string
        
    Returns:
        RDKit Mol object or None if invalid
    """
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
        return mol
    except Exception:
        return None


def mol_to_smiles(mol: Chem.Mol) -> str:
    """
    Convert RDKit molecule to SMILES string.
    
    Args:
        mol: RDKit Mol object
        
    Returns:
        SMILES string
    """
    return Chem.MolToSmiles(mol)


def calculate_molecular_properties(smiles: str) -> Dict[str, Any]:
    """
    Calculate molecular properties from SMILES.
    
    Args:
        smiles: SMILES string
        
    Returns:
        Dictionary of molecular properties
    """
    mol = smiles_to_mol(smiles)
    if mol is None:
        return {"error": "Invalid SMILES string"}
    
    try:
        properties = {
            "molecular_weight": Descriptors.ExactMolWt(mol),
            "logp": Descriptors.MolLogP(mol),
            "num_hbd": Descriptors.NumHDonors(mol),
            "num_hba": Descriptors.NumHAcceptors(mol),
            "num_rotatable_bonds": Descriptors.NumRotatableBonds(mol),
            "num_aromatic_rings": Descriptors.NumAromaticRings(mol),
            "num_saturated_rings": Descriptors.NumSaturatedRings(mol),
            "num_aliphatic_rings": Descriptors.NumAliphaticRings(mol),
            "tpsa": Descriptors.TPSA(mol),
            "labute_asa": Descriptors.LabuteASA(mol),
            "balaban_j": Descriptors.BalabanJ(mol),
            "heavy_atom_count": Descriptors.HeavyAtomCount(mol),
            "fraction_csp3": Descriptors.FractionCSP3(mol),
        }
        
        # Lipinski's rule of five
        properties["lipinski"] = {
            "mw_leq_500": properties["molecular_weight"] <= 500,
            "logp_leq_5": properties["logp"] <= 5,
            "hbd_leq_5": properties["num_hbd"] <= 5,
            "hba_leq_10": properties["num_hba"] <= 10,
            "violations": sum([
                properties["molecular_weight"] > 500,
                properties["logp"] > 5,
                properties["num_hbd"] > 5,
                properties["num_hba"] > 10
            ])
        }
        
        return properties
    except Exception as e:
        return {"error": f"Failed to calculate properties: {str(e)}"}