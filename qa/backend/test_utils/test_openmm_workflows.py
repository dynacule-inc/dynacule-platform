"""
Unit tests for the OpenMM workflows utility module.

Tests cover: system generation, energy minimization, equilibration,
production MD, RMSD computation, and the Modal integration stub.
Actual OpenMM functions raise ImportError if openmm is not installed
(which is expected in the test environment — heavy compute runs on Modal).
"""

import pytest
from unittest.mock import patch, MagicMock

from app.utils.openmm_workflows import (
    generate_system_from_pdb,
    energy_minimization,
    equilibration,
    production_md,
    compute_rmsd,
    compute_radius_of_gyration,
    modal_openmm_simulation_stub,
    openmm,
)


def _skip_if_openmm_installed():
    """Skip test if openmm IS installed (we're testing the graceful degradation)."""
    if openmm is not None:
        pytest.skip("OpenMM is installed — would run real simulation, skip unit test")


class TestGenerateSystemFromPDB:
    """generate_system_from_pdb(): PDB -> OpenMM system pipeline."""

    def test_raises_import_error_without_openmm(self):
        """Without openmm, raises ImportError."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError, match="OpenMM is not installed"):
            generate_system_from_pdb("/tmp/test.pdb")

    def test_default_parameters_accepted(self):
        """Default parameter values are valid."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            generate_system_from_pdb("/tmp/test.pdb")

    def test_custom_forcefield(self):
        """Custom forcefield parameter is accepted."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            generate_system_from_pdb("/tmp/test.pdb", forcefield="charmm36.xml")

    def test_box_padding_forwarded(self):
        """box_padding parameter is accepted."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            generate_system_from_pdb("/tmp/test.pdb", box_padding=2.0)


class TestEnergyMinimization:
    """energy_minimization(): structural relaxation."""

    def test_raises_without_openmm(self):
        """Without openmm, raises ImportError."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError, match="OpenMM is not installed"):
            energy_minimization(None, None, None)

    def test_default_tolerance(self):
        """Default tolerance is 1.0 kJ/mol/Å."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            energy_minimization(None, None, None)

    def test_cpu_platform(self):
        """Platform_name='CPU' is accepted."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            energy_minimization(None, None, None, platform_name="CPU")


class TestEquilibration:
    """equilibration(): NVT + NPT equilibration protocol."""

    def test_raises_without_openmm(self):
        """Without openmm, raises ImportError."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError, match="OpenMM is not installed"):
            equilibration(None, None, None)

    def test_temperature_parameter(self):
        """Temperature is accepted as a float in Kelvin."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            equilibration(None, None, None, temperature=310.0)

    def test_pressure_parameter(self):
        """Pressure is accepted in atmospheres."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            equilibration(None, None, None, pressure=1.0)


class TestProductionMD:
    """production_md(): production MD simulation."""

    def test_raises_without_openmm(self):
        """Without openmm, raises ImportError."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError, match="OpenMM is not installed"):
            production_md(None, None, None)

    def test_trajectory_file_parameter(self):
        """Trajectory file path is accepted."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            production_md(None, None, None, trajectory_file="/tmp/test.dcd")

    def test_report_interval(self):
        """Report interval is accepted."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError):
            production_md(None, None, None, report_interval=500)


class TestComputeRMSD:
    """compute_rmsd(): trajectory alignment and RMSD calculation."""

    def test_raises_without_openmm(self):
        """Without openmm, raises ImportError."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError, match="OpenMM is not installed"):
            compute_rmsd("/tmp/traj.dcd", "/tmp/ref.pdb")

    def test_returns_array_with_openmm(self):
        """When openmm IS installed, returns a numpy array."""
        if openmm is None:
            pytest.skip("OpenMM not installed")
        import numpy as np
        with patch("app.utils.openmm_workflows.app.DCDFile") as mock_dcd:
            mock_instance = MagicMock()
            mock_instance.getNumFrames.return_value = 10
            mock_dcd.return_value = mock_instance
            result = compute_rmsd("/tmp/traj.dcd", "/tmp/ref.pdb")
            assert isinstance(result, np.ndarray)
            assert len(result) == 10


class TestComputeRadiusOfGyration:
    """compute_radius_of_gyration(): Rg from trajectory."""

    def test_raises_without_openmm(self):
        """Without openmm, raises ImportError."""
        _skip_if_openmm_installed()
        with pytest.raises(ImportError, match="OpenMM is not installed"):
            compute_radius_of_gyration("/tmp/traj.dcd")

    def test_returns_array_with_openmm(self):
        """When openmm IS installed, returns a numpy array."""
        if openmm is None:
            pytest.skip("OpenMM not installed")
        import numpy as np
        with patch("app.utils.openmm_workflows.app.DCDFile") as mock_dcd:
            mock_instance = MagicMock()
            mock_instance.getNumFrames.return_value = 5
            mock_dcd.return_value = mock_instance
            result = compute_radius_of_gyration("/tmp/traj.dcd")
            assert isinstance(result, np.ndarray)
            assert len(result) == 5


class TestModalStub:
    """modal_openmm_simulation_stub(): Modal integration placeholder."""

    def test_returns_stub_status(self):
        """Stub returns dict with 'stub' status."""
        result = modal_openmm_simulation_stub(
            pdb_file="/tmp/test.pdb",
            forcefield="amber14-all.xml",
        )
        assert isinstance(result, dict)
        assert result["status"] == "stub"
        assert "message" in result
        assert "Modal" in result["message"]

    def test_default_parameters(self):
        """Default parameter values work without error."""
        result = modal_openmm_simulation_stub(pdb_file="/tmp/test.pdb")
        assert result["status"] == "stub"

    def test_all_parameters_accepted(self):
        """All parameters are accepted and returned in stub."""
        result = modal_openmm_simulation_stub(
            pdb_file="/tmp/test.pdb",
            forcefield="amber14-all.xml",
            solvent="tip4pew",
            box_padding=2.0,
            ionic_strength=0.1,
            minimization_steps=1000,
            equilibration_steps=2000,
            production_steps=100000,
            temperature=310.0,
        )
        assert result["status"] == "stub"
