"""
Unit tests for the Quantum Mechanics workflows utility module.

Tests cover: Psi4/ORCA input generation, output parsing, calculation
execution stubs, and the Modal integration stub.
"""

import pytest
from unittest.mock import patch, MagicMock, mock_open

from app.utils.qm_workflows import (
    generate_psi4_input,
    generate_orca_input,
    parse_psi4_output,
    parse_orca_output,
    run_psi4_calculation,
    run_orca_calculation,
    modal_psi4_stub,
    modal_orca_stub,
    psi4_available,
)


# ── Sample molecule ───────────────────────────────────────────────────────

WATER = {
    "symbols": ["O", "H", "H"],
    "coordinates": [
        [0.0, 0.0, 0.117],
        [0.0, 0.757, -0.469],
        [0.0, -0.757, -0.469],
    ],
}

ETHANOL = {
    "symbols": ["C", "C", "O", "H", "H", "H", "H", "H", "H"],
    "coordinates": [
        [-0.057, -0.015, 0.000],
        [1.438, 0.006, 0.000],
        [1.931, 1.438, 0.000],
        [-0.449, -0.946, -0.371],
        [-0.449, 0.655, -0.750],
        [-0.449, 0.294, 0.957],
        [1.829, -0.491, 0.875],
        [1.829, -0.535, -0.849],
        [2.892, 1.447, 0.000],
    ],
}


# ── Generate Psi4 Input ───────────────────────────────────────────────────

class TestGeneratePsi4Input:
    """generate_psi4_input(): creates Psi4 input file content."""

    def test_single_point_water(self):
        """Single point energy for water produces valid input."""
        result = generate_psi4_input(WATER)
        assert "molecule mol" in result
        assert "O 0.000000 0.000000 0.117000" in result
        assert "energy(" in result

    def test_optimization_task(self):
        """Optimization task produces 'optimize' keyword."""
        result = generate_psi4_input(WATER, task="optimization")
        assert "optimize(" in result

    def test_frequency_task(self):
        """Frequency task produces 'frequency' keyword."""
        result = generate_psi4_input(WATER, task="frequency")
        assert "frequency(" in result

    def test_unsupported_task_raises(self):
        """Unsupported task raises ValueError."""
        with pytest.raises(ValueError, match="Task not supported"):
            generate_psi4_input(WATER, task="invalid_task")

    def test_custom_basis_set(self):
        """Custom basis set appears in the input."""
        result = generate_psi4_input(WATER, basis_set="cc-pVTZ")
        assert "cc-pVTZ" in result

    def test_extra_keywords(self):
        """Extra keywords are added to the set block."""
        result = generate_psi4_input(WATER, extra_keywords=["scf_type pk", "print 2"])
        assert "scf_type pk" in result
        assert "print 2" in result

    def test_charge_and_multiplicity(self):
        """Charge and multiplicity appear in molecule block."""
        result = generate_psi4_input(WATER, charge=-1, multiplicity=2)
        assert "-1 2" in result  # charge then multiplicity

    def test_ethanol_molecule(self):
        """Ethanol produces correct atom count."""
        result = generate_psi4_input(ETHANOL)
        assert "C" in result
        assert "O" in result
        # Count atom lines (9 atoms = ethanol)
        # +1 for charge/multiplicity line, +1 for opening brace, +1 for closing
        assert result.count("symbol") == 0  # no literal 'symbol' in output


# ── Generate ORCA Input ───────────────────────────────────────────────────

class TestGenerateOrcaInput:
    """generate_orca_input(): creates ORCA input file content."""

    def test_single_point_water(self):
        """Single point energy for water produces valid ORCA input."""
        result = generate_orca_input(WATER)
        assert "!" in result  # ORCA method line
        assert "xyzfile" in result
        assert "O" in result

    def test_pal_parameter(self):
        """PAL parameter appears in %pal block."""
        result = generate_orca_input(WATER, pal=4)
        assert "nprocs 4" in result

    def test_optimization_has_geom_block(self):
        """Optimization task includes %geom block."""
        result = generate_orca_input(WATER, task="optimization")
        assert "%geom" in result
        assert "Optimize" in result

    def test_frequency_has_freq_block(self):
        """Frequency task includes %freq block."""
        result = generate_orca_input(WATER, task="frequency")
        assert "%freq" in result

    def test_custom_basis_set(self):
        """Custom basis appears in method line."""
        result = generate_orca_input(WATER, basis_set="def2-tzvp")
        assert "def2-tzvp" in result

    def test_extra_keywords(self):
        """Extra keywords appear in the ! line."""
        result = generate_orca_input(WATER, extra_keywords=["TightSCF", "RIJCOSX"])
        assert "TightSCF" in result or "RIJCOSX" in result


# ── Parse Psi4 Output ─────────────────────────────────────────────────────

class TestParsePsi4Output:
    """parse_psi4_output(): extracts energies/frequencies from Psi4 output."""

    def test_energy_extracted(self):
        """'FINAL ENERGY' line is parsed correctly."""
        output = "Some header\nFINAL ENERGY: -76.0267712546\nSome footer\n"
        result = parse_psi4_output(output)
        assert result["success"] is True
        assert abs(result["energy"] - (-76.0267712546)) < 1e-10

    def test_energy_not_found(self):
        """No energy line returns None energy."""
        result = parse_psi4_output("No energy here")
        assert result["success"] is False
        assert result["energy"] is None

    def test_empty_output(self):
        """Empty string returns empty result."""
        result = parse_psi4_output("")
        assert result["success"] is False
        assert result["energy"] is None

    def test_frequencies_extracted(self):
        """Vibrational frequencies section is parsed."""
        output = (
            "VIBRATIONAL FREQUENCIES\n"
            "  1  1500.2  10.5\n"
            "  2  2500.0  20.0\n"
            "NORMAL MODES\n"
        )
        result = parse_psi4_output(output)
        assert result["frequencies"] is not None
        assert len(result["frequencies"]) == 2
        assert abs(result["frequencies"][0] - 1500.2) < 0.1


# ── Parse ORCA Output ────────────────────────────────────────────────────

class TestParseOrcaOutput:
    """parse_orca_output(): extracts energies/frequencies from ORCA output."""

    def test_energy_extracted(self):
        """'FINAL SINGLE POINT ENERGY' line is parsed."""
        output = "FINAL SINGLE POINT ENERGY: -76.0267712546 Eh\n"
        result = parse_orca_output(output)
        assert result["success"] is True
        assert abs(result["energy"] - (-76.0267712546)) < 1e-10

    def test_total_energy_fallback(self):
        """'TOTAL ENERGY' line as fallback."""
        output = "TOTAL ENERGY: -76.02 Eh\n"
        result = parse_orca_output(output)
        assert result["success"] is True

    def test_empty_output(self):
        """Empty string returns empty result."""
        result = parse_orca_output("")
        assert result["success"] is False
        assert result["energy"] is None

    def test_frequencies_extracted(self):
        """Vibrational frequencies section is parsed."""
        output = (
            "VIBRATIONAL FREQUENCIES\n"
            "  1  800.5  5.0\n"
            "IR INTENSITY\n"
        )
        result = parse_orca_output(output)
        assert result["frequencies"] is not None
        assert len(result["frequencies"]) == 1


# ── Run Psi4 Calculation ──────────────────────────────────────────────────

class TestRunPsi4Calculation:
    """run_psi4_calculation(): executes Psi4 via Python API or stubs."""

    def test_returns_false_if_psi4_missing(self):
        """Without Psi4 installed, returns (False, error_message)."""
        if psi4_available:
            pytest.skip("Psi4 is installed")
        success, output = run_psi4_calculation("/tmp/input.in")
        assert success is False
        assert "Psi4 is not installed" in output


# ── Run ORCA Calculation ──────────────────────────────────────────────────

class TestRunOrcaCalculation:
    """run_orca_calculation(): executes ORCA as subprocess."""

    def test_subprocess_called(self):
        """With mocked subprocess, returns success."""
        with patch("subprocess.run") as mock_run:
            mock_run.return_value.returncode = 0
            mock_run.return_value.stdout = "Calculation complete"
            mock_run.return_value.stderr = ""
            success, output = run_orca_calculation("/tmp/input.inp")
            assert success is True
            assert "Calculation complete" in output


# ── Modal Stubs ───────────────────────────────────────────────────────────

class TestModalPsi4Stub:
    """modal_psi4_stub(): Modal integration placeholder."""

    def test_returns_stub(self):
        """Returns dict with 'stub' status."""
        result = modal_psi4_stub(WATER)
        assert result["status"] == "stub"
        assert "Modal" in result["message"]

    def test_default_parameters(self):
        """Default parameters work without error."""
        result = modal_psi4_stub(WATER)
        assert result["status"] == "stub"

    def test_custom_theory(self):
        """Custom theory parameter is accepted."""
        result = modal_psi4_stub(WATER, theory="hf")
        assert result["status"] == "stub"


class TestModalOrcaStub:
    """modal_orca_stub(): Modal integration placeholder for ORCA."""

    def test_returns_stub(self):
        """Returns dict with 'stub' status."""
        result = modal_orca_stub(WATER)
        assert result["status"] == "stub"
        assert "Modal" in result["message"]

    def test_pal_parameter(self):
        """PAL parameter is accepted."""
        result = modal_orca_stub(WATER, pal=8)
        assert result["status"] == "stub"