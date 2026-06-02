"""
Modal.com AutoDock Vina docking functions for Dynacule.

Usage:
    from backend.modal.vina_modal import run_vina_docking

    result = run_vina_docking.remote(
        ligand_pdbqt=ligand_pdbqt_content,
        receptor_pdbqt=receptor_pdbqt_content,
        center_x=0.0, center_y=0.0, center_z=0.0,
        size_x=20.0, size_y=20.0, size_z=20.0,
        exhaustiveness=8
    )

The actual Vina functions are defined in backend/modal/app.py and deployed
to Modal cloud GPU instances.
"""

__all__ = [
    "run_vina_docking",
    "prepare_ligand_pdbqt",
]