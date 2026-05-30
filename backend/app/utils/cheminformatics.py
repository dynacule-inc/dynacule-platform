"""Cheminformatics utilities using RDKit."""

from __future__ import annotations

from typing import List, Optional, Tuple, Union
import io

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, AllChem
    from rdkit.Chem.Draw import MolToImage
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    # We'll define dummy types for type checking
    Chem = None  # type: ignore


def _check_rdkit():
    if not RDKIT_AVAILABLE:
        raise ImportError(
            "RDKit is not available. Please install it with: pip install rdkit"
        )


def calculate_descriptors(smiles: str) -> dict:
    """
    Calculate common molecular descriptors for a molecule given its SMILES.

    Args:
        smiles: SMILES string of the molecule.

    Returns:
        Dictionary containing descriptor names and values.
    """
    _check_rdkit()
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES string: {smiles}")

    descriptors = {
        "MolWt": Descriptors.MolWt(mol),
        "LogP": Descriptors.MolLogP(mol),
        "NumHDonors": Descriptors.NumHDonors(mol),
        "NumHAcceptors": Descriptors.NumHAcceptors(mol),
        "NumRotatableBonds": Descriptors.NumRotatableBonds(mol),
        "TPSA": Descriptors.TPSA(mol),
        "NumAromaticRings": Descriptors.NumAromaticRings(mol),
        "NumSaturatedRings": Descriptors.NumSaturatedRings(mol),
        "NumAliphaticRings": Descriptors.NumAliphaticRings(mol),
        "RingCount": Descriptors.RingCount(mol),
        "HeavyAtomCount": Descriptors.HeavyAtomCount(mol),
        "FractionCSP3": Descriptors.FractionCSP3(mol),
    }
    return descriptors


def generate_conformers(
    smiles: str, num_conformers: int = 10, random_seed: Optional[int] = None
) -> List[Chem.Mol]:
    """
    generate multiple conformers for a molecule.

    Args:
        smiles: SMILES string of the molecule.
        num_conformers: Number of conformers to generate.
        random_seed: Random seed for reproducibility.

    Returns:
        List of RDKit Mol objects with conformers.
    """
    _check_rdkit()
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES string: {smiles}")

    # Add hydrogens for conformer generation
    mol = Chem.AddHs(mol)
    # Generate conformers
    params = AllChem.ETKDGv3()
    if random_seed is not None:
        params.randomSeed = random_seed
    cids = AllChem.EmbedMultipleConfs(
        mol, numConfs=num_conformers, params=params
    )
    if not cids:
        raise RuntimeError("Failed to generate conformers")

    # Optimize conformers
    for cid in cids:
        AllChem.UFFOptimizeMolecule(mol, confId=cid)

    return [mol]


def filter_lipinski(mol: Union[Chem.Mol, str]) -> Tuple[bool, List[str]]:
    """
    Check if a molecule passes Lipinski's rule of five.

    Args:
        mol: RDKit Mol object or SMILES string.

    Returns:
        Tuple of (passes_rule, list_of_violations).
    """
    _check_rdkit()
    if isinstance(mol, str):
        mol = Chem.MolFromSmiles(mol)
        if mol is None:
            raise ValueError(f"Invalid SMILES string: {mol}")

    violations = []
    if Descriptors.MolWt(mol) > 500:
        violations.append("MolWt > 500")
    if Descriptors.MolLogP(mol) > 5:
        violations.append("LogP > 5")
    if Descriptors.NumHDonors(mol) > 5:
        violations.append("NumHDonors > 5")
    if Descriptors.NumHAcceptors(mol) > 10:
        violations.append("NumHAcceptors > 10")

    return (len(violations) == 0, violations)


def convert_format(
    input_data: str, input_format: str, output_format: str
) -> str:
    """
    Convert between chemical file formats.

    Args:
        input_data: String containing the input data (e.g., SMILES, SDF, etc.).
        input_format: Format of input_data ('smi', 'sdf', 'mol', 'pdb', etc.).
        output_format: Desired output format.

    Returns:
        String containing the converted data.
    """
    _check_rdkit()
    mol = None
    if input_format.lower() == "smi":
        mol = Chem.MolFromSmiles(input_data)
    elif input_format.lower() in ["sdf", "mol"]:
        mol = Chem.MolFromMolBlock(input_data)
    elif input_format.lower() == "pdb":
        mol = Chem.MolFromPDBBlock(input_data)
    else:
        raise ValueError(f"Unsupported input format: {input_format}")

    if mol is None:
        raise ValueError(f"Failed to parse input data in format {input_format}")

    if output_format.lower() == "smi":
        return Chem.MolToSmiles(mol)
    elif output_format.lower() in ["sdf", "mol"]:
        return Chem.MolToMolBlock(mol)
    elif output_format.lower() == "pdb":
        return Chem.MolToPDBBlock(mol)
    else:
        raise ValueError(f"Unsupported output format: {output_format}")


def get_molecule_image(smiles: str, size: Tuple[int, int] = (300, 300)) -> bytes:
    """
    Generate a PNG image of the molecule from SMILES.

    Args:
        smiles: SMILES string.
        size: Image size as (width, height).

    Returns:
        PNG image as bytes.
    """
    _check_rdkit()
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES string: {smiles}")
    img = MolToImage(mol, size=size)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    return img_bytes.getvalue()