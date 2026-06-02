"""
Modal status endpoint for Dynacule API.
Reports Modal GPU compute connectivity and available functions.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

router = APIRouter()


class ModalStatusResponse(BaseModel):
    modal_configured: bool
    deployed_app: str
    status: str
    message: str
    functions: Optional[List[str]] = None


async def get_modal_status() -> Dict[str, Any]:
    """
    Check Modal connectivity and deployed function status.
    
    Returns
    -------
    dict
        Status of Modal service and available functions.
    """
    import os

    MODAL_TOKEN_ID = os.environ.get("MODAL_TOKEN_ID") or None
    MODAL_TOKEN_SECRET = os.environ.get("MODAL_TOKEN_SECRET") or None
    MODAL_API_TOKEN = os.environ.get("MODAL_API_TOKEN") or None
    # Check if Modal is configured via either token pair or combined key
    USE_MODAL = (
        bool(MODAL_TOKEN_ID) and bool(MODAL_TOKEN_SECRET)
    ) or (bool(MODAL_API_TOKEN) and len(MODAL_API_TOKEN) > 0)
    MODAL_DEPLOYED_APP_NAME = os.environ.get("MODAL_APP_NAME", "dynacule-compute")
    # Strip workspace prefix if present (e.g. "shabab747/dynacule-compute" → "dynacule-compute")
    if "/" in MODAL_DEPLOYED_APP_NAME:
        MODAL_DEPLOYED_APP_NAME = MODAL_DEPLOYED_APP_NAME.split("/")[-1]

    status = {
        "modal_configured": USE_MODAL,
        "deployed_app": MODAL_DEPLOYED_APP_NAME,
        "functions": [],
        "status": "unknown",
        "message": "",
    }

    if not USE_MODAL:
        status["status"] = "not_configured"
        status["message"] = "MODAL_API_TOKEN not set - using local compute fallback"
        return status

    try:
        import modal
        
        # Try to lookup the deployed app
        try:
            app = modal.App.lookup(MODAL_DEPLOYED_APP_NAME)
        except Exception:
            status["status"] = "not_deployed"
            status["message"] = (
                f"App '{MODAL_DEPLOYED_APP_NAME}' not found. "
                f"Deploy with: modal deploy backend/modal/app.py --name dynacule-compute"
            )
            return status

        # Try to call health_check
        try:
            # Import from the modal app module
            import sys
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/../../")
            from backend.modal.app import health_check
            result = health_check.remote()
            status["status"] = "healthy"
            status["functions"] = result.get("functions", [])
            status["message"] = "Modal GPU compute is operational"
        except Exception as e:
            status["status"] = "deployed_but_unreachable"
            status["message"] = f"App is deployed but health check failed: {str(e)}"

    except ImportError:
        status["status"] = "not_installed"
        status["message"] = "modal package not installed in this environment"
    except Exception as e:
        status["status"] = "error"
        status["message"] = str(e)

    return status


@router.get("/status", response_model=ModalStatusResponse)
async def modal_status():
    """
    Get Modal GPU compute status.
    
    Returns the status of Modal cloud connectivity and available compute functions.
    """
    status_data = await get_modal_status()
    return ModalStatusResponse(**status_data)


@router.get("/functions")
async def list_functions():
    """
    List all available Modal compute functions.
    """
    status_data = await get_modal_status()
    
    available_functions = {
        "rdkit_cheminformatics": [
            "compute_descriptors",
            "get_scaffold", 
            "compute_similarity",
            "generate_fingerprint",
            "check_pains",
            "filter_lipinski",
            "detect_functional_groups",
            "generate_conformers",
            "react_smarts",
            "batch_descriptors",
            "screen_pains",
        ],
        "openmm_molecular_dynamics": [
            "run_openmm_simulation",
            "compute_md_properties",
        ],
        "autodock_vina_docking": [
            "run_vina_docking",
            "prepare_ligand_pdbqt",
        ],
        "quantum_mechanics": [
            "run_psi4_calculation",
        ],
    }
    
    return {
        "status": status_data.get("status"),
        "modal_configured": status_data.get("modal_configured"),
        "deployed_app": status_data.get("deployed_app"),
        "functions": available_functions,
        "note": "Functions are deployed to Modal GPU cloud - see /modal/status for deployment health",
    }


@router.post("/dispatch/cheminformatics")
async def dispatch_cheminformatics(
    func_name: str,
    smiles: str,
    smiles2: Optional[str] = None,
):
    """
    Dispatch a cheminformatics function to Modal GPU.
    
    Parameters
    ----------
    func_name : str
        Name of the function to call.
    smiles : str
        SMILES string of the molecule.
    smiles2 : str, optional
        Second SMILES for similarity calculations.
    """
    from app.utils.modal_client import dispatch_cheminformatics as dispatch
    
    kwargs = {}
    if smiles2:
        kwargs["smiles2"] = smiles2
    
    result = await dispatch(func_name, smiles, **kwargs)
    return result


@router.post("/dispatch/docking")
async def dispatch_docking(
    ligand_pdbqt: str,
    receptor_pdbqt: str,
    center_x: float,
    center_y: float,
    center_z: float,
    size_x: float,
    size_y: float,
    size_z: float,
    exhaustiveness: int = 8,
    num_modes: int = 10,
):
    """
    Dispatch a Vina docking job to Modal GPU.
    """
    from app.utils.modal_client import dispatch_docking as dispatch
    
    result = await dispatch(
        ligand_pdbqt=ligand_pdbqt,
        receptor_pdbqt=receptor_pdbqt,
        center_x=center_x,
        center_y=center_y,
        center_z=center_z,
        size_x=size_x,
        size_y=size_y,
        size_z=size_z,
        exhaustiveness=exhaustiveness,
        num_modes=num_modes,
    )
    return result


@router.post("/dispatch/md")
async def dispatch_md(
    pdb_content: str,
    forcefield: str = "amber14-all.xml",
    solvent: str = "tip3p",
    minimization_steps: int = 500,
    equilibration_steps: int = 1000,
    production_steps: int = 50000,
    temperature: float = 300.0,
):
    """
    Dispatch an OpenMM MD job to Modal GPU.
    """
    from app.utils.modal_client import dispatch_md as dispatch
    
    result = await dispatch(
        pdb_content=pdb_content,
        forcefield=forcefield,
        solvent=solvent,
        minimization_steps=minimization_steps,
        equilibration_steps=equilibration_steps,
        production_steps=production_steps,
        temperature=temperature,
    )
    return result


@router.post("/dispatch/qm")
async def dispatch_qm(
    molecule_data: dict,
    task: str = "single_point",
    theory: str = "b3lyp",
    basis_set: str = "6-31g*",
    charge: int = 0,
    multiplicity: int = 1,
):
    """
    Dispatch a Psi4 QM calculation to Modal.
    """
    from app.utils.modal_client import dispatch_qm as dispatch
    
    result = await dispatch(
        molecule_data=molecule_data,
        task=task,
        theory=theory,
        basis_set=basis_set,
        charge=charge,
        multiplicity=multiplicity,
    )
    return result