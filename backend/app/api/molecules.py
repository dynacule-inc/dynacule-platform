"""
Router for molecule-related endpoints.

Supports SMILES entry, PDB/MOL/SDF file upload, and RDKit-powered
descriptor calculation with graceful degradation when RDKit is absent.
"""

import io
import re
import math
import random
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Depends
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import SessionLocal, get_db
from app.models.job import Molecule

router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────────────────

def _smiles_to_pdb(smiles: str) -> str:
    """
    Convert SMILES to PDB format, using RDKit when available.
    Falls back to a simple 2D coordinate layout without RDKit.
    """
    from app.utils import cheminformatics

    # Try RDKit first
    if getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        from rdkit import Chem
        from rdkit.Chem import AllChem, Descriptors
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError(f"Invalid SMILES string: {smiles}")
        mol = Chem.AddHs(mol)
        # Generate 3D coordinates
        params = AllChem.ETKDGv3()
        params.randomSeed = 42
        status = AllChem.EmbedMolecule(mol, params)
        if status == -1:
            # Fall back to 2D coords
            AllChem.Compute2DCoords(mol)
        else:
            AllChem.MMFFOptimizeMolecule(mol)
        return Chem.MolToPDBBlock(mol)

    # Fallback: generate a rough 3D layout from SMILES atom count
    # Simple approach: place atoms in a rough helical pattern
    elements = []
    i = 0
    while i < len(smiles):
        if i + 1 < len(smiles) and smiles[i + 1].islower():
            elements.append(smiles[i:i+2])
            i += 2
        elif smiles[i].isalpha() and smiles[i].isupper():
            elements.append(smiles[i])
            i += 1
        else:
            elements.append("C")
            i += 1

    elements = [e for e in elements if e.isalpha() and e[0].isupper()]
    if not elements:
        elements = ["C", "C", "C"]

    lines = []
    lines.append("HEADER     Generated SMILES structure")
    lines.append("COMPND     UNNAMED")
    lines.append(f"AUTHOR     Dynacule (SMILES: {smiles[:60]})")
    for idx, elem in enumerate(elements[:200]):
        angle = idx * 1.5
        radius = 1.5 + idx * 0.8
        x = radius * math.cos(angle)
        y = radius * math.sin(angle) * 0.6
        z = idx * 1.2
        serial = idx + 1
        resname = elem[:3].ljust(3)
        atomname = elem[:1] + str(serial).rjust(3)[:3]
        lines.append(
            f"ATOM  {serial:>5} {atomname:<4} {resname} A{1:>4}    "
            f"{x:>8.3f}{y:>8.3f}{z:>8.3f}  1.00  0.00          {elem[:2]:>2}"
        )
    lines.append("END")
    return "\n".join(lines)


def _compute_formula(pdb_content: str) -> str:
    """Extract molecular formula from PDB ATOM records."""
    element_counts: dict[str, int] = {}
    for line in pdb_content.splitlines():
        if line.startswith("ATOM") or line.startswith("HETATM"):
            elem = line[76:78].strip() or line[12:14].strip()[:1]
            if elem:
                element_counts[elem] = element_counts.get(elem, 0) + 1
    order = ["C", "H", "O", "N", "S", "P", "F", "Cl", "Br", "I", "B", "Si", "Se", "Te"]
    parts = []
    for e in order:
        if e in element_counts:
            parts.append(f"{e}{element_counts[e]}" if element_counts[e] > 1 else e)
    for e, c in sorted(element_counts.items()):
        if e not in order:
            parts.append(f"{e}{c}" if c > 1 else e)
    return " ".join(parts) if parts else "Unknown"


def _extract_name_from_filename(filename: str) -> str:
    """Strip extension from a filename for use as molecule name."""
    name = filename.rsplit(".", 1)[0] if "." in filename else filename
    return name.replace("_", " ").replace("-", " ").title()


# ── Endpoints ────────────────────────────────────────────────────────────

@router.get("/")
async def list_molecules(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """List all molecules, optionally filtered by project."""
    query = db.query(Molecule)
    if project_id is not None:
        query = query.filter(Molecule.project_id == project_id)
    molecules = query.order_by(Molecule.created_at.desc()).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "smiles": m.smiles,
            "formula": m.formula,
            "source": m.source,
            "project_id": m.project_id,
            "created_at": str(m.created_at) if m.created_at else None,
        }
        for m in molecules
    ]


# ── Static routes MUST come before parameterized /{molecule_id} ────────────

@router.get("/descriptors")
async def calculate_molecular_descriptors(
    smiles: str = Query(..., description="SMILES string"),
):
    """Calculate molecular descriptors (requires RDKit or Modal offload)."""
    from app.utils import cheminformatics
    if cheminformatics is None or not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "note": "RDKit not available in container — offload to Modal",
            "descriptors": {},
        }
    try:
        descriptors = cheminformatics.calculate_descriptors(smiles)
        return {"smiles": smiles, "descriptors": descriptors}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/conformers")
async def generate_molecule_conformers(
    smiles: str = Query(..., description="SMILES string"),
    num_conformers: int = Query(10, ge=1, le=100),
):
    """Generate conformers (requires RDKit or Modal offload)."""
    from app.utils import cheminformatics
    if cheminformatics is None or not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "note": "RDKit not available in container — offload to Modal",
            "conformers": 0,
        }
    try:
        mols = cheminformatics.generate_conformers(smiles, num_conformers)
        return {"smiles": smiles, "conformers": len(mols)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Parameterized routes ──────────────────────────────────────────────────

@router.post("/smiles")
async def create_from_smiles(
    smiles: str = Form(...),
    name: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Create a molecule from a SMILES string — generates 3D coordinates."""
    if not smiles or len(smiles.strip()) == 0:
        raise HTTPException(status_code=400, detail="SMILES string is required")

    pdb_content = _smiles_to_pdb(smiles.strip())
    formula = _compute_formula(pdb_content)
    mol_name = name or f"Molecule (SMILES)"

    molecule = Molecule(
        name=mol_name,
        smiles=smiles.strip(),
        formula=formula,
        pdb_content=pdb_content,
        source="smiles",
        project_id=project_id,
        created_at=datetime.utcnow(),
    )
    db.add(molecule)
    db.commit()
    db.refresh(molecule)

    return {
        "id": molecule.id,
        "name": molecule.name,
        "smiles": molecule.smiles,
        "formula": molecule.formula,
        "source": molecule.source,
        "project_id": molecule.project_id,
        "created_at": str(molecule.created_at) if molecule.created_at else None,
    }


@router.post("/upload")
async def upload_molecule_file(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a PDB, MOL, SDF, or MOL2 file and store it as a molecule."""
    allowed_exts = {".pdb", ".mol", ".sdf", ".mol2"}
    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""

    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_exts)}",
        )

    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    mol_name = name or _extract_name_from_filename(file.filename or "molecule")
    formula = _compute_formula(content)

    molecule = Molecule(
        name=mol_name,
        smiles=None,
        formula=formula,
        pdb_content=content if ext == ".pdb" else None,
        mol_content=content if ext in (".mol", ".sdf", ".mol2") else None,
        source=ext.lstrip("."),
        project_id=project_id,
        created_at=datetime.utcnow(),
    )
    db.add(molecule)
    db.commit()
    db.refresh(molecule)

    return {
        "id": molecule.id,
        "name": molecule.name,
        "formula": molecule.formula,
        "source": molecule.source,
        "project_id": molecule.project_id,
        "created_at": str(molecule.created_at) if molecule.created_at else None,
    }


@router.get("/{molecule_id}/pdb")
async def get_molecule_pdb(molecule_id: int, db: Session = Depends(get_db)):
    """Get PDB content for a molecule (convert MOL/SDF to PDB if needed)."""
    mol = db.query(Molecule).filter(Molecule.id == molecule_id).first()
    if not mol:
        raise HTTPException(status_code=404, detail="Molecule not found")

    pdb = mol.pdb_content
    if not pdb and mol.mol_content:
        # Convert MOL → PDB using RDKit if available
        from app.utils import cheminformatics
        if getattr(cheminformatics, "RDKIT_AVAILABLE", False):
            from rdkit import Chem
            rdmol = Chem.MolFromMolBlock(mol.mol_content)
            if rdmol:
                pdb = Chem.MolToPDBBlock(rdmol)
        if not pdb:
            pdb = mol.mol_content  # Fallback: serve MOL as-is

    if not pdb:
        raise HTTPException(status_code=404, detail="No structure data available")

    return {"pdb": pdb, "name": mol.name, "id": mol.id}


@router.get("/{molecule_id}/descriptors")
async def get_molecule_descriptors(molecule_id: int, db: Session = Depends(get_db)):
    """Calculate descriptors for a stored molecule using its SMILES."""
    mol = db.query(Molecule).filter(Molecule.id == molecule_id).first()
    if not mol:
        raise HTTPException(status_code=404, detail="Molecule not found")
    if not mol.smiles:
        return {
            "id": mol.id,
            "note": "No SMILES available for this molecule (uploaded as file)",
            "descriptors": {},
        }

    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        # Estimate basic properties from SMILES parsing
        desc = _estimate_descriptors(mol.smiles)
        return {"id": mol.id, "smiles": mol.smiles, "descriptors": desc, "note": "Estimated (RDKit unavailable)"}

    try:
        desc = cheminformatics.calculate_descriptors(mol.smiles)
        return {"id": mol.id, "smiles": mol.smiles, "descriptors": desc}
    except Exception as e:
        return {"id": mol.id, "smiles": mol.smiles, "descriptors": _estimate_descriptors(mol.smiles), "note": str(e)}


def _estimate_descriptors(smiles: str) -> dict:
    """Estimate molecular descriptors from SMILES without RDKit."""
    # Count heavy atoms from SMILES
    heavy = 0
    hbd = 0  # O, N atoms
    hba = 0  # O, N, F atoms
    rot = 0
    rings = 0
    i = 0
    while i < len(smiles):
        c = smiles[i]
        if c.isalpha() and c.isupper():
            elem = c
            if i + 1 < len(smiles) and smiles[i + 1].islower():
                elem += smiles[i + 1]
                i += 1
            if elem in ("C", "N", "O", "S", "P", "F", "Cl", "Br", "I", "B", "Si", "Se"):
                heavy += 1
            if elem in ("N", "O"):
                hbd += 1
            if elem in ("N", "O", "F"):
                hba += 1
        elif c == "1" or c == "2":
            rings += 1
        elif c == "-" or c == "=" or c == "#":
            rot += 1
        i += 1

    mol_wt = heavy * 14.0  # rough estimate
    logp = -0.5 + heavy * 0.3  # rough estimate
    tpsa = (hba + hbd) * 20.0  # rough estimate

    return {
        "MolWt": round(mol_wt, 2),
        "LogP": round(logp, 2),
        "NumHDonors": hbd,
        "NumHAcceptors": hba,
        "NumRotatableBonds": max(0, rot // 2),
        "TPSA": round(tpsa, 1),
        "NumAromaticRings": max(0, rings // 2),
        "NumSaturatedRings": max(0, rings // 3),
        "NumAliphaticRings": max(0, rings // 2),
        "RingCount": rings,
        "HeavyAtomCount": heavy,
        "FractionCSP3": round(max(0.0, min(1.0, heavy * 0.05)), 2),
    }


@router.get("/{molecule_id}")
async def get_molecule(molecule_id: int, db: Session = Depends(get_db)):
    """Get a specific molecule's metadata."""
    mol = db.query(Molecule).filter(Molecule.id == molecule_id).first()
    if not mol:
        raise HTTPException(status_code=404, detail="Molecule not found")
    return {
        "id": mol.id,
        "name": mol.name,
        "smiles": mol.smiles,
        "formula": mol.formula,
        "source": mol.source,
        "project_id": mol.project_id,
        "created_at": str(mol.created_at) if mol.created_at else None,
    }


@router.delete("/{molecule_id}")
async def delete_molecule(molecule_id: int, db: Session = Depends(get_db)):
    """Delete a molecule."""
    mol = db.query(Molecule).filter(Molecule.id == molecule_id).first()
    if not mol:
        raise HTTPException(status_code=404, detail="Molecule not found")
    db.delete(mol)
    db.commit()
    return {"message": f"Molecule {molecule_id} deleted"}


# ── New RDKit-powered endpoints ───────────────────────────────────────────────

@router.get("/scaffolds")
async def get_scaffolds(
    smiles: str = Query(..., description="SMILES string"),
):
    """Compute Murcko scaffold and Bemis-Murcko framework for a molecule."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "note": "RDKit not available — offload to Modal for scaffold analysis",
            "murcko_smiles": None,
            "bemis_murcko_smiles": None,
        }
    try:
        result = cheminformatics.get_murcko_scaffold(smiles)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/similarity")
async def pairwise_similarity(
    smiles1: str = Query(..., description="First SMILES"),
    smiles2: str = Query(..., description="Second SMILES"),
    metric: str = Query("tanimoto", description="Metric: tanimoto, dice, tversky"),
):
    """Calculate pairwise similarity between two molecules."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles1": smiles1,
            "smiles2": smiles2,
            "metric": metric,
            "similarity": None,
            "note": "RDKit not available",
        }
    try:
        result = cheminformatics.calculate_similarity(smiles1, smiles2, metric)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/similarity-search")
async def similarity_search(
    smiles: str = Query(..., description="Query SMILES"),
    limit: int = Query(10, ge=1, le=100, description="Number of results"),
    metric: str = Query("tanimoto", description="Metric: tanimoto or dice"),
    db: Session = Depends(get_db),
):
    """Search stored molecules for similar structures."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "query_smiles": smiles,
            "results": [],
            "note": "RDKit not available",
        }
    # Get all molecules with SMILES from DB
    db_gen = db.query(Molecule.smiles).filter(Molecule.smiles.isnot(None)).all()
    molecules_list = [m[0] for m in db_gen if m[0]]
    if not molecules_list:
        return {"query_smiles": smiles, "results": [], "note": "No stored molecules with SMILES"}
    try:
        results = cheminformatics.search_similar_molecules(
            smiles, molecules_list, metric=metric, top_n=limit
        )
        return {"query_smiles": smiles, "results": results, "total_stored": len(molecules_list)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pains")
async def check_pains_filter(
    smiles: str = Query(..., description="SMILES string"),
):
    """Check molecule for PAINS (Pan-Assay Interference) substructure alerts."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "has_pains": None,
            "pains_found": [],
            "note": "RDKit not available",
        }
    try:
        result = cheminformatics.check_pains(smiles)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/fingerprints")
async def get_fingerprints(
    smiles: str = Query(..., description="SMILES string"),
    fp_type: str = Query("morgan", description="Type: morgan, maccs, rdkit"),
):
    """Compute molecular fingerprint (Morgan/ECFP4, MACCS, or RDKit) as hex string."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "fp_type": fp_type,
            "bits": None,
            "size": 0,
            "note": "RDKit not available",
        }
    try:
        result = cheminformatics.get_fingerprint(smiles, fp_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/property-histogram")
async def property_histogram(
    property: str = Query(..., description="Property: LogP, MolWt, TPSA, NumHDonors, NumHAcceptors, NumRotatableBonds, RingCount"),
    project_id: Optional[int] = Query(None, description="Filter by project"),
    num_bins: int = Query(20, ge=5, le=100, description="Number of histogram bins"),
    db: Session = Depends(get_db),
):
    """Compute histogram distribution of a molecular property across stored molecules."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "property": property,
            "bins": [],
            "counts": [],
            "note": "RDKit not available",
        }
    # Collect SMILES from DB
    query = db.query(Molecule.smiles).filter(Molecule.smiles.isnot(None))
    if project_id is not None:
        query = query.filter(Molecule.project_id == project_id)
    molecules_smiles = [m[0] for m in query.all() if m[0]]
    try:
        result = cheminformatics.get_property_distribution(
            property, molecules_smiles, num_bins=num_bins
        )
        result["total_molecules"] = len(molecules_smiles)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/brics-fragmentation")
async def brics_fragment(
    smiles: str = Query(..., description="SMILES string"),
):
    """Fragment a molecule using BRICS (Breaking Retrosynthetically Interesting Chemical Substructures)."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "fragments": [],
            "note": "RDKit not available — offload to Modal for fragmentation",
        }
    try:
        result = cheminformatics.brics_fragmentation(smiles)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/react")
async def apply_reaction(
    smiles: str = Form(..., description="Reactant SMILES"),
    reaction_smarts: str = Form(..., description="Reaction SMARTS (e.g., '[C:1]>>[C:1]O')"),
):
    """Apply a SMARTS reaction to a molecule and return product SMILES."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "reaction_smarts": reaction_smarts,
            "products": [],
            "note": "RDKit not available",
        }
    try:
        result = cheminformatics.apply_reaction(smiles, reaction_smarts)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/functional-groups")
async def functional_groups(
    smiles: str = Query(..., description="SMILES string"),
):
    """Detect common functional groups in a molecule."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "groups": [],
            "note": "RDKit not available",
        }
    try:
        result = cheminformatics.detect_functional_groups(smiles)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/smarts-match")
async def smarts_match(
    smiles: str = Query(..., description="SMILES string"),
    smarts: str = Query(..., description="SMARTS pattern"),
):
    """Check if a SMILES matches a SMARTS pattern and return atom indices."""
    from app.utils import cheminformatics
    if not getattr(cheminformatics, "RDKIT_AVAILABLE", False):
        return {
            "smiles": smiles,
            "smarts": smarts,
            "matched": None,
            "matches": [],
            "note": "RDKit not available",
        }
    try:
        result = cheminformatics.match_smarts(smiles, smarts)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))