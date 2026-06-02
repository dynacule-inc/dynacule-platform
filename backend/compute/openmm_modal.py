"""
Modal.com OpenMM molecular dynamics functions for Dynacule.

Usage:
    from backend.modal.openmm_modal import run_openmm_simulation

    result = run_openmm_simulation.remote(
        pdb_content=pdb_file_content,
        forcefield="amber14-all.xml",
        solvent="tip3p",
        minimization_steps=500,
        production_steps=50000,
        temperature=300.0
    )

The actual OpenMM functions are defined in backend/modal/app.py and deployed
to Modal cloud GPU instances with NVIDIA A10G or H100 GPUs.
"""

__all__ = [
    "run_openmm_simulation",
    "compute_md_properties",
]