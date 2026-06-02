"""Cheminformatics utilities using RDKit.

All functions gracefully degrade when RDKit is unavailable.
"""

from __future__ import annotations

from typing import List, Optional, Tuple, Union, Dict, Any
import io
import math

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, AllChem, Draw, rdMolDescriptors
    from rdkit.Chem.Draw import MolToImage
    from rdkit.Chem.Scaffolds import MurckoScaffold
    from rdkit.Chem.Fingerprints import FingerprintMols
    from rdkit import DataStructs
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
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


# ── Scaffold Analysis ──────────────────────────────────────────────────────────

def get_murcko_scaffold(smiles: str) -> Dict[str, Any]:
    """
    Compute Murcko scaffold and Bemis-Murcko framework for a molecule.

    Args:
        smiles: SMILES string of the molecule.

    Returns:
        Dictionary with original, murcko_scaffolds, and bemis_murcko_smiles.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "murcko_smiles": None,
            "bemis_murcko_smiles": None,
            "note": "RDKit not available",
        }
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    # Murcko scaffold (generic skeleton with atom types removed)
    murcko_smiles = MurckoScaffold.MurckoScaffoldSmiles(mol=mol, includeChirality=False)

    # Bemis-Murcko framework (骨架 only, no side chains)
    framework = MurckoScaffold.MurckoScaffoldSmiles(
        mol=mol, includeChirality=False, makingFramework=False
    )

    return {
        "smiles": smiles,
        "murcko_smiles": murcko_smiles,
        "bemis_murcko_smiles": framework,
    }


# ── Similarity Search ─────────────────────────────────────────────────────────

def calculate_similarity(
    smiles1: str, smiles2: str, metric: str = "tanimoto"
) -> Dict[str, Any]:
    """
    Calculate pairwise similarity between two molecules.

    Args:
        smiles1: SMILES of first molecule.
        smiles2: SMILES of second molecule.
        metric: Similarity metric — 'tanimoto' (default), 'dice', 'tversky'.

    Returns:
        Dictionary with metric, similarity score, and fingerprint info.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles1": smiles1,
            "smiles2": smiles2,
            "metric": metric,
            "similarity": None,
            "note": "RDKit not available",
        }

    mol1 = Chem.MolFromSmiles(smiles1)
    mol2 = Chem.MolFromSmiles(smiles2)
    if mol1 is None or mol2 is None:
        raise ValueError("Invalid SMILES string(s)")

    # Use Morgan fingerprint (ECFP4) for similarity
    fp1 = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol1, radius=2, nBits=2048)
    fp2 = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol2, radius=2, nBits=2048)

    metric_lower = metric.lower()
    if metric_lower == "tanimoto":
        similarity = DataStructs.TanimotoSimilarity(fp1, fp2)
    elif metric_lower == "dice":
        similarity = DataStructs.DiceSimilarity(fp1, fp2)
    elif metric_lower == "tversky":
        similarity = DataStructs.TverskySimilarity(fp1, fp2)
    else:
        similarity = DataStructs.TanimotoSimilarity(fp1, fp2)

    return {
        "smiles1": smiles1,
        "smiles2": smiles2,
        "metric": metric_lower,
        "similarity": round(similarity, 4),
        "fingerprint_type": "Morgan2",
        "fingerprint_size": 2048,
    }


def search_similar_molecules(
    smiles: str,
    molecules_list: List[str],
    metric: str = "tanimoto",
    top_n: int = 10,
) -> List[Dict[str, Any]]:
    """
    Find the most similar molecules from a list to a query molecule.

    Args:
        smiles: Query molecule SMILES.
        molecules_list: List of candidate SMILES strings.
        metric: Similarity metric — 'tanimoto' (default), 'dice'.
        top_n: Number of top results to return.

    Returns:
        Sorted list of dicts with smiles and similarity scores.
    """
    if not RDKIT_AVAILABLE:
        return {
            "query_smiles": smiles,
            "results": [],
            "note": "RDKit not available",
        }

    query_mol = Chem.MolFromSmiles(smiles)
    if query_mol is None:
        raise ValueError(f"Invalid query SMILES: {smiles}")

    fp_query = rdMolDescriptors.GetMorganFingerprintAsBitVect(
        query_mol, radius=2, nBits=2048
    )

    results = []
    for cand in molecules_list:
        mol = Chem.MolFromSmiles(cand)
        if mol is None:
            continue
        fp_cand = rdMolDescriptors.GetMorganFingerprintAsBitVect(
            mol, radius=2, nBits=2048
        )
        if metric.lower() == "dice":
            sim = DataStructs.DiceSimilarity(fp_query, fp_cand)
        else:
            sim = DataStructs.TanimotoSimilarity(fp_query, fp_cand)
        results.append({"smiles": cand, "similarity": round(sim, 4)})

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_n]


# ── PAINS Filter ──────────────────────────────────────────────────────────────

# PAINS substructure SMARTS patterns (A.卖出 et al., J. Chem. Inf. Model, 2006)
_PAINS_PATTERNS = {
    "PAINS-A": [
        "c1ccc(O)nc1N",
        "c1cc(O)nc(O)n1",
        "c1cnc(N)nc1N",
    ],
    "PAINS-B": [
        "[O-][N+](=O)c1ccc(O)cc1",
        "[O-][N+](=O)c1cccc(O)c1",
    ],
    "PAINS-C": [
        "c1ccc(C=O)cc1",
        "c1ccc(C#N)cc1",
    ],
    "ALARM": [
        "c1cc(Cl)ccc1C=O",
        "c1cc(Br)ccc1C=O",
    ],
    "PAINS-H": [
        "c1ccnc(N)nc1N",
        "c1c[nH]c(=O)[nH]c1=O",
    ],
}


def check_pains(smiles: str) -> Dict[str, Any]:
    """
    Check molecule for PAINS (Pan-Assay Interference Compounds) substructures.

    Args:
        smiles: SMILES string of the molecule.

    Returns:
        Dictionary with has_pains flag and list of found alerts.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "has_pains": None,
            "pains_found": [],
            "note": "RDKit not available",
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    found = []
    for category, smarts_list in _PAINS_PATTERNS.items():
        for smarts in smarts_list:
            pattern = Chem.MolFromSmarts(smarts)
            if pattern is not None and mol.HasSubstructMatch(pattern):
                for match in mol.GetSubstructMatches(pattern):
                    found.append({
                        "category": category,
                        "smarts": smarts,
                        "atom_indices": list(match[:6]),  # limit to first 6 atoms
                    })

    return {
        "smiles": smiles,
        "has_pains": len(found) > 0,
        "pains_found": found,
    }


# ── SMARTS Matching / Functional Groups ────────────────────────────────────────

# Common functional group SMARTS patterns
_FG_PATTERNS = {
    "alcohol": "[OX2H][CX4]",
    "phenol": "[OX2H][c]",
    "ether": "[OD2]([CX4])[CX4]",
    "aldehyde": "[CX3H1](=O)[#6]",
    "ketone": "[CX3](=O)[#6]",
    "ester": "[CX3](=O)[OX2][#6]",
    "carboxylic_acid": "[CX3](=O)[OX2H1]",
    "amine_primary": "[NX3H2][CX4]",
    "amine_secondary": "[NX3H1]([CX4])[CX4]",
    "amine_tertiary": "[NX3]([CX4])([CX4])[CX4]",
    "amide": "[CX3](=O)[NX3]",
    "sulfonamide": "[SX4](=O)(=O)[NX3]",
    "halogen": "[F,Cl,Br,I]",
    "nitrile": "C#N",
    " nitro": "[O-][N+](=O)",
    "sulfone": "S(=O)(=O)",
    "heterocycle": "[!#6;!#1]",
}


def match_smarts(smiles: str, smarts_pattern: str) -> Dict[str, Any]:
    """
    Check if a SMILES matches a given SMARTS pattern.

    Args:
        smiles: SMILES string of the molecule.
        smarts_pattern: SMARTS pattern string.

    Returns:
        Dictionary with matched flag and atom indices.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "smarts": smarts_pattern,
            "matched": None,
            "matches": [],
            "note": "RDKit not available",
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    pattern = Chem.MolFromSmarts(smarts_pattern)
    if pattern is None:
        return {
            "smiles": smiles,
            "smarts": smarts_pattern,
            "matched": False,
            "matches": [],
            "error": "Invalid SMARTS pattern",
        }

    matches = mol.GetSubstructMatches(pattern)
    return {
        "smiles": smiles,
        "smarts": smarts_pattern,
        "matched": len(matches) > 0,
        "matches": [list(m) for m in matches],
    }


def detect_functional_groups(smiles: str) -> Dict[str, Any]:
    """
    Detect common functional groups in a molecule.

    Args:
        smiles: SMILES string of the molecule.

    Returns:
        Dictionary with detected groups and their atom indices.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "groups": [],
            "note": "RDKit not available",
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    detected = []
    for group_name, smarts in _FG_PATTERNS.items():
        pattern = Chem.MolFromSmarts(smarts)
        if pattern is None:
            continue
        matches = mol.GetSubstructMatches(pattern)
        if matches:
            detected.append({
                "group": group_name,
                "smarts": smarts,
                "count": len(matches),
                "atom_indices": [list(m[:8]) for m in matches],  # cap at 8 atoms
            })

    return {
        "smiles": smiles,
        "groups": detected,
    }


# ── Fingerprints ──────────────────────────────────────────────────────────────

def get_fingerprint(
    smiles: str, fp_type: str = "morgan"
) -> Dict[str, Any]:
    """
    Compute a molecular fingerprint as a hex string.

    Args:
        smiles: SMILES string.
        fp_type: Fingerprint type — 'morgan' (ECFP4, default), 'maccs', 'rdkit'.

    Returns:
        Dictionary with fp_type, bits (hex string), and size.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "fp_type": fp_type,
            "bits": None,
            "size": 0,
            "note": "RDKit not available",
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    if fp_type.lower() == "morgan":
        fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(
            mol, radius=2, nBits=2048
        )
        size = 2048
    elif fp_type.lower() == "maccs":
        from rdkit.Chem import MACCSkeys
        fp = MACCSkeys.GenMACCSKeys(mol)
        size = 167
    elif fp_type.lower() == "rdkit":
        from rdkit.Chem import RDKFingerprint
        fp = RDKFingerprint(mol)
        size = 2048
    else:
        fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(
            mol, radius=2, nBits=2048
        )
        size = 2048

    # Convert to hex string
    bits_int = DataStructs.CreateFromBitString(fp.ToBitString())
    bits_hex = bits_int.ToHexString()

    return {
        "smiles": smiles,
        "fp_type": fp_type.lower(),
        "bits": bits_hex,
        "size": size,
    }


# ── Property Distribution ──────────────────────────────────────────────────────

def get_property_distribution(
    property_name: str,
    molecules_smiles: Optional[List[str]] = None,
    num_bins: int = 20,
) -> Dict[str, Any]:
    """
    Compute histogram bins/counts for a molecular property distribution.

    Args:
        property_name: Name of the property (e.g., 'LogP', 'MolWt', 'TPSA').
        molecules_smiles: List of SMILES strings. If None, uses a built-in
                          representative set for approximate ranges.
        num_bins: Number of histogram bins.

    Returns:
        Dictionary with bins (edges) and counts.
    """
    if not RDKIT_AVAILABLE:
        return {
            "property": property_name,
            "bins": [],
            "counts": [],
            "note": "RDKit not available",
        }

    # Default reference ranges when no molecules provided
    default_ranges = {
        "LogP": (-2, 8),
        "MolWt": (50, 1000),
        "TPSA": (0, 200),
        "NumHDonors": (0, 10),
        "NumHAcceptors": (0, 15),
        "NumRotatableBonds": (0, 20),
        "RingCount": (0, 6),
    }

    if molecules_smiles is None:
        # Return empty distribution with default range
        lo, hi = default_ranges.get(property_name, (0, 100))
        bins = [lo + (hi - lo) * i / num_bins for i in range(num_bins + 1)]
        return {
            "property": property_name,
            "bins": [round(b, 2) for b in bins],
            "counts": [0] * num_bins,
            "note": "No molecules provided; returned default range",
        }

    values = []
    for smi in molecules_smiles:
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            continue
        try:
            if property_name == "LogP":
                values.append(Descriptors.MolLogP(mol))
            elif property_name == "MolWt":
                values.append(Descriptors.MolWt(mol))
            elif property_name == "TPSA":
                values.append(Descriptors.TPSA(mol))
            elif property_name == "NumHDonors":
                values.append(Descriptors.NumHDonors(mol))
            elif property_name == "NumHAcceptors":
                values.append(Descriptors.NumHAcceptors(mol))
            elif property_name == "NumRotatableBonds":
                values.append(Descriptors.NumRotatableBonds(mol))
            elif property_name == "RingCount":
                values.append(Descriptors.RingCount(mol))
            else:
                values.append(float(getattr(Descriptors, property_name, lambda m: 0)(mol)))
        except Exception:
            continue

    if not values:
        return {
            "property": property_name,
            "bins": [],
            "counts": [],
            "note": "No valid values computed",
        }

    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        max_val = min_val + 1.0
    bin_width = (max_val - min_val) / num_bins

    bins = [min_val + bin_width * i for i in range(num_bins + 1)]
    counts = [0] * num_bins
    for v in values:
        idx = min(int((v - min_val) / bin_width), num_bins - 1)
        counts[idx] += 1

    return {
        "property": property_name,
        "bins": [round(b, 3) for b in bins],
        "counts": counts,
    }


# ── BRICS Fragmentation ───────────────────────────────────────────────────────

def brics_fragmentation(smiles: str) -> Dict[str, Any]:
    """
    Fragment a molecule using the BRICS (Breaking Retrosynthetically
    Interesting Chemical Substructures) algorithm.

    Args:
        smiles: SMILES string of the molecule.

    Returns:
        Dictionary with list of fragment SMILES and link atom info.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "fragments": [],
            "note": "RDKit not available",
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    # BRICS decomposition via RDKit's reaction library
    from rdkit.Chem import rdChemReactions
    from rdkit.Chem import BRICS

    # Get BRICS fragments
    fragments = BRICS.BRICSDecompose(mol)

    fragment_list = []
    for frag in fragments:
        frag_mol = Chem.MolFromSmiles(frag)
        if frag_mol is None:
            continue
        # Count link atoms (atoms that were cut)
        link_info = []
        for atom in frag_mol.GetAtoms():
            if atom.GetSymbol() == "*":
                link_info.append(atom.GetIdx())
        fragment_list.append({
            "smiles": frag,
            "num_atoms": frag_mol.GetNumAtoms(),
            "link_atoms": link_info,
        })

    return {
        "smiles": smiles,
        "fragments": fragment_list,
    }


# ── Reaction SMARTS ────────────────────────────────────────────────────────────

def apply_reaction(smiles: str, reaction_smarts: str) -> Dict[str, Any]:
    """
    Apply a SMARTS-based reaction to a molecule and return products.

    Args:
        smiles: SMILES string of the reactant.
        reaction_smarts: Reaction SMARTS string (e.g., '[C:1]>>[C:1]O').

    Returns:
        Dictionary with list of product SMILES.
    """
    if not RDKIT_AVAILABLE:
        return {
            "smiles": smiles,
            "reaction_smarts": reaction_smarts,
            "products": [],
            "note": "RDKit not available",
        }

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    rxn = AllChem.ReactionFromSmarts(reaction_smarts)
    if rxn is None:
        return {
            "smiles": smiles,
            "reaction_smarts": reaction_smarts,
            "products": [],
            "error": "Invalid reaction SMARTS",
        }

    products = rxn.RunReactants([mol])
    product_smiles = []
    for p_list in products:
        for p_mol in p_list:
            # Clean up product
            Chem.SanitizeMol(p_mol)
            product_smiles.append(Chem.MolToSmiles(p_mol))

    return {
        "smiles": smiles,
        "reaction_smarts": reaction_smarts,
        "products": product_smiles,
        "num_products": len(product_smiles),
    }