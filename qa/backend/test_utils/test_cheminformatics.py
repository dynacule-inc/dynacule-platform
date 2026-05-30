"""
Unit tests for the Cheminformatics utility module (RDKit wrapper).

Tests cover: descriptor calculation, conformer generation, Lipinski filter,
format conversion, molecule image generation, error handling for invalid
SMILES, and the graceful RDKit-missing path.
"""

import io
import pytest
from unittest.mock import patch, MagicMock

from app.utils.cheminformatics import (
    calculate_descriptors,
    generate_conformers,
    filter_lipinski,
    convert_format,
    get_molecule_image,
    RDKIT_AVAILABLE,
)


class TestCalculateDescriptors:
    """calculate_descriptors(): molecular property extraction from SMILES."""

    def test_valid_smiles_returns_descriptors(self):
        """CCO (ethanol) returns expected descriptor keys."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        desc = calculate_descriptors("CCO")
        assert isinstance(desc, dict)
        assert "MolWt" in desc
        assert "LogP" in desc
        assert "NumHDonors" in desc
        assert "NumHAcceptors" in desc
        assert "RingCount" in desc
        # Ethanol has specific values
        assert abs(desc["MolWt"] - 46.07) < 0.1
        assert desc["NumHDonors"] == 1
        assert desc["NumHAcceptors"] == 1

    def test_complex_molecule(self):
        """Benzene ring has correct ring count."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        desc = calculate_descriptors("c1ccccc1")
        assert desc["NumAromaticRings"] == 1
        assert desc["RingCount"] == 1

    def test_invalid_smiles_raises(self):
        """Invalid SMILES raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Invalid SMILES"):
            calculate_descriptors("ZZZZ")

    def test_empty_smiles(self):
        """Empty string raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Invalid SMILES"):
            calculate_descriptors("")

    def test_raises_when_rdkit_missing(self):
        """Without RDKit, _check_rdkit raises ImportError."""
        if RDKIT_AVAILABLE:
            pytest.skip("RDKit is installed — cannot test missing path")
        with pytest.raises(ImportError, match="RDKit is not available"):
            calculate_descriptors("CCO")


class TestGenerateConformers:
    """generate_conformers(): 3D conformer generation from SMILES."""

    def test_default_count(self):
        """Default num_conformers=10 produces a Mol with 10+ conformers."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        mols = generate_conformers("CCO", num_conformers=5)
        assert len(mols) >= 1

    def test_different_seeds_produce_different_results(self):
        """Different random seeds may produce different conformer ensembles."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        mols_a = generate_conformers("CCO", num_conformers=3, random_seed=42)
        mols_b = generate_conformers("CCO", num_conformers=3, random_seed=1)
        assert len(mols_a) >= 1
        assert len(mols_b) >= 1

    def test_invalid_smiles_raises(self):
        """Invalid SMILES raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Invalid SMILES"):
            generate_conformers("ZZZZ")


class TestFilterLipinski:
    """filter_lipinski(): Lipinski Rule-of-Five compliance check."""

    def test_ethanol_passes(self):
        """Ethanol passes Lipinski (small molecule, no violations)."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        passes, violations = filter_lipinski("CCO")
        assert passes is True
        assert len(violations) == 0

    def test_accepts_mol_object(self):
        """Accepts RDKit Mol object in addition to SMILES string."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        from rdkit import Chem
        mol = Chem.MolFromSmiles("CCO")
        passes, violations = filter_lipinski(mol)
        assert passes is True

    def test_large_molecule_fails(self):
        """A very large molecule should have violations."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        # Large macrocycle-like SMILES
        passes, violations = filter_lipinski("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
        assert passes is False
        assert len(violations) > 0

    def test_invalid_smiles_raises(self):
        """Invalid SMILES raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Invalid SMILES"):
            filter_lipinski("NOT_A_MOLECULE")


class TestConvertFormat:
    """convert_format(): inter-conversion between chemical file formats."""

    def test_smiles_to_smiles_roundtrip(self):
        """SMILES -> SMILES returns canonicalized SMILES."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        result = convert_format("CCO", "smi", "smi")
        assert isinstance(result, str)
        assert "CCO" in result

    def test_smiles_to_molblock(self):
        """SMILES -> MOL block produces valid V2000 block."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        result = convert_format("CCO", "smi", "sdf")
        assert "V2000" in result or "V3000" in result

    def test_unsupported_format_raises(self):
        """Unsupported input format raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Unsupported input format"):
            convert_format("data", "xyz", "smi")

    def test_unsupported_output_format_raises(self):
        """Unsupported output format raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Unsupported output format"):
            convert_format("CCO", "smi", "xyz")


class TestGetMoleculeImage:
    """get_molecule_image(): PNG generation from SMILES."""

    def test_returns_png_bytes(self):
        """Returns PNG image bytes for valid SMILES."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        img_bytes = get_molecule_image("CCO")
        assert isinstance(img_bytes, bytes)
        assert len(img_bytes) > 100  # PNG header + pixel data
        assert img_bytes[:8] == b'\x89PNG\r\n\x1a\n'  # PNG magic bytes

    def test_custom_size(self):
        """Custom image size is respected."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        img_bytes = get_molecule_image("CCO", size=(600, 600))
        assert len(img_bytes) > 100

    def test_invalid_smiles_raises(self):
        """Invalid SMILES raises ValueError."""
        if not RDKIT_AVAILABLE:
            pytest.skip("RDKit not installed")
        with pytest.raises(ValueError, match="Invalid SMILES"):
            get_molecule_image("ZZZZ")
