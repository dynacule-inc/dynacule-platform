"""Utility package — graceful imports for optional dependencies."""

try:
    from . import cheminformatics
except ImportError:
    cheminformatics = None  # type: ignore

# openmm_workflows, vina_docking, qm_workflows require packages only in Modal
# They are imported inside Celery tasks that run on Modal, not in the API container.