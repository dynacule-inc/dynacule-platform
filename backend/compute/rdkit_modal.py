"""
Modal.com RDKit cheminformatics functions for Dynacule.

Usage:
    from backend.modal.rdkit_modal import compute_descriptors

    # Call remotely on Modal
    result = compute_descriptors.remote("CCO")  # ethanol

The actual RDKit functions are defined in backend/modal/app.py and deployed
to Modal cloud. This module provides a convenient import interface for the
backend API layer.
"""

__all__ = [
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
]