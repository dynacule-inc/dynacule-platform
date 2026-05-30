"""
Pipeline accuracy smoke tests for Dynacule computational modules.

Validates that the computational pipeline wrappers produce expected
output shapes, consistent results, and graceful handling when
heavy dependencies (OpenMM, RDKit, Psi4) are not installed.

These tests run in the local test environment where compute packages
are optional — they verify contracts, not numerical accuracy (that
happens on Modal GPU runners with reference data).
"""

import json
import pytest
from pathlib import Path

# Reference data directory
REFERENCE_DIR = Path(__file__).resolve().parent / "reference"

pytestmark = [pytest.mark.pipeline]


class TestVinaContract:
    """Validate the docking function contract (signature + return shape)."""

    def test_imports_cleanly(self):
        """vina_docking imports without error."""
        from app.utils import vina_docking
        assert vina_docking is not None

    def test_run_vina_contract(self):
        """run_vina_docking returns expected shape."""
        from app.utils.vina_docking import run_vina_docking
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
        )
        assert isinstance(result, dict)
        assert set(result.keys()) == {"success", "energies", "output_pdbqt", "log"}
        assert isinstance(result["energies"], list)
        # Energies should be negative (binding affinities)
        assert all(e < 0 for e in result["energies"])


class TestOpenMMContract:
    """Validate OpenMM workflow function contracts."""

    def test_imports_cleanly(self):
        """openmm_workflows imports without error."""
        from app.utils import openmm_workflows
        assert openmm_workflows is not None

    def test_functions_exist(self):
        """All expected functions are present in the module."""
        from app.utils import openmm_workflows as ow
        expected = [
            "generate_system_from_pdb",
            "energy_minimization",
            "equilibration",
            "production_md",
            "compute_rmsd",
            "compute_radius_of_gyration",
            "modal_openmm_simulation_stub",
        ]
        for name in expected:
            assert hasattr(ow, name), f"Missing function: {name}"

    def test_graceful_degradation(self):
        """Without OpenMM, functions raise ImportError (not AttributeError)."""
        from app.utils.openmm_workflows import openmm
        if openmm is None:
            from app.utils.openmm_workflows import generate_system_from_pdb
            with pytest.raises(ImportError):
                generate_system_from_pdb("/tmp/test.pdb")

    def test_modal_stub_contract(self):
        """modal_openmm_simulation_stub returns expected keys."""
        from app.utils.openmm_workflows import modal_openmm_simulation_stub
        result = modal_openmm_simulation_stub(pdb_file="/tmp/test.pdb")
        assert "status" in result
        assert "message" in result
        assert "outputs" in result


class TestQMContract:
    """Validate QM workflow function contracts."""

    def test_imports_cleanly(self):
        """qm_workflows imports without error."""
        from app.utils import qm_workflows
        assert qm_workflows is not None

    def test_functions_exist(self):
        """All expected functions are present."""
        from app.utils import qm_workflows as qm
        expected = [
            "generate_psi4_input",
            "generate_orca_input",
            "parse_psi4_output",
            "parse_orca_output",
            "run_psi4_calculation",
            "run_orca_calculation",
            "modal_psi4_stub",
            "modal_orca_stub",
        ]
        for name in expected:
            assert hasattr(qm, name), f"Missing function: {name}"

    def test_input_generation_water(self):
        """Water molecule generates valid Psi4 input."""
        from app.utils.qm_workflows import generate_psi4_input
        water = {
            "symbols": ["O", "H", "H"],
            "coordinates": [[0, 0, 0.117], [0, 0.757, -0.469], [0, -0.757, -0.469]],
        }
        result = generate_psi4_input(water)
        assert "O" in result
        assert "energy(" in result

    def test_orca_input_generation(self):
        """ORCA input is valid for water."""
        from app.utils.qm_workflows import generate_orca_input
        water = {
            "symbols": ["O", "H", "H"],
            "coordinates": [[0, 0, 0.117], [0, 0.757, -0.469], [0, -0.757, -0.469]],
        }
        result = generate_orca_input(water)
        assert "!" in result
        assert "xyzfile" in result

    def test_modal_stubs(self):
        """Modal stubs return expected shapes."""
        from app.utils.qm_workflows import modal_psi4_stub, modal_orca_stub
        water = {"symbols": ["O", "H", "H"], "coordinates": [[0, 0, 0], [0, 0, 1], [0, 0, -1]]}
        for stub in [modal_psi4_stub, modal_orca_stub]:
            result = stub(water)
            assert "status" in result
            assert result["status"] == "stub"


class TestRDKitContract:
    """Validate RDKit-based cheminformatics function contracts."""

    def test_functions_exist(self):
        """All expected functions are present."""
        from app.utils import cheminformatics as chem
        expected = [
            "calculate_descriptors",
            "generate_conformers",
            "filter_lipinski",
            "convert_format",
            "get_molecule_image",
        ]
        for name in expected:
            assert hasattr(chem, name), f"Missing function: {name}"

    def test_descriptor_names_consistent(self):
        """Descriptor dict keys are consistent across calls to same SMILES."""
        from app.utils.cheminformatics import RDKIT_AVAILABLE, calculate_descriptors
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        d1 = calculate_descriptors("CCO")
        d2 = calculate_descriptors("CCO")
        assert d1.keys() == d2.keys()

    def test_lipinski_rejects_oversized(self):
        """filter_lipinski correctly identifies violations on large molecules."""
        from app.utils.cheminformatics import RDKIT_AVAILABLE, filter_lipinski
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        # A heavy molecule that should violate
        passes, violations = filter_lipinski("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
        assert passes is False
        assert len(violations) >= 1


# ── Reference data validation ─────────────────────────────────────────────

class TestReferenceData:
    """Validate reference data files are present and well-formed."""

    def test_reference_dir_exists(self):
        """qa/pipeline/reference/ directory exists."""
        assert REFERENCE_DIR.exists(), f"Reference dir not found: {REFERENCE_DIR}"
