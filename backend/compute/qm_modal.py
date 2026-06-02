"""
Modal.com QM (Psi4) calculation functions for Dynacule.

Usage:
    from backend.modal.qm_modal import run_psi4_calculation

    molecule_data = {
        "symbols": ["C", "H", "H", "H", "H"],
        "coordinates": [[0, 0, 0], [0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0]]
    }
    result = run_psi4_calculation.remote(
        molecule_data=molecule_data,
        task="single_point",
        theory="b3lyp",
        basis_set="6-31g*"
    )

The actual QM functions are defined in backend/modal/app.py and deployed
to Modal cloud instances.
"""

__all__ = [
    "run_psi4_calculation",
]