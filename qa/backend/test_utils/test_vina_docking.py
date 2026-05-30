"""
Unit tests for the Vina Docking utility module.

Tests the mock `run_vina_docking` function: return shape, parameter
forwarding, and the mock result contract.
"""

import pytest
from app.utils.vina_docking import run_vina_docking


class TestRunVinaDocking:
    """run_vina_docking(): validates the mock docking function contract."""

    def test_returns_dict_with_keys(self):
        """Result dict contains all expected keys."""
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
            exhaustiveness=8,
        )
        assert isinstance(result, dict)
        expected_keys = {"success", "energies", "output_pdbqt", "log"}
        assert expected_keys.issubset(result.keys())

    def test_success_flag(self):
        """success is always True (mock implementation)."""
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
        )
        assert result["success"] is True

    def test_energies_are_floats(self):
        """Energies are a list of floats (binding energies in kcal/mol)."""
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
        )
        assert isinstance(result["energies"], list)
        for e in result["energies"]:
            assert isinstance(e, float)

    def test_different_exhaustiveness(self):
        """Default exhaustiveness is 8, calling with different value works."""
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
            exhaustiveness=16,
        )
        assert result["success"] is True

    def test_negative_coordinates(self):
        """Docking box can have negative center coordinates."""
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=-5.0, center_y=-10.0, center_z=3.0,
            size_x=15.0, size_y=15.0, size_z=15.0,
        )
        assert result["success"] is True

    def test_string_smiles_preserved(self):
        """The function accepts any str as ligand identifier."""
        result = run_vina_docking(
            ligand_smiles="c1ccccc1",  # benzene
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
        )
        assert result["success"] is True

    def test_output_paths_returned(self):
        """output_pdbqt and log are file paths (strings)."""
        result = run_vina_docking(
            ligand_smiles="CCO",
            receptor_pdb_path="/tmp/receptor.pdb",
            center_x=0.0, center_y=0.0, center_z=0.0,
            size_x=20.0, size_y=20.0, size_z=20.0,
        )
        assert isinstance(result["output_pdbqt"], str)
        assert result["output_pdbqt"].endswith(".pdbqt")
        assert isinstance(result["log"], str)
        assert result["log"].endswith(".log")
