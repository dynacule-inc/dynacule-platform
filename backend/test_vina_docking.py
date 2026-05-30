"""
Test script for the Vina docking pipeline.
"""

import os
import tempfile
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vina_docking import VinaConfig, generate_vina_config, parse_vina_log, run_vina_locally, dock_vina, dock_vina_modal


def test_generate_vina_config():
    """Test generating a Vina config file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        config_path = f.name

    try:
        config = VinaConfig(
            receptor="receptor.pdbqt",
            ligand="ligand.pdbqt",
            center_x=0.0,
            center_y=0.0,
            center_z=0.0,
            size_x=10.0,
            size_y=10.0,
            size_z=10.0
        )
        generate_vina_config(config, config_path)

        # Read and check the file
        with open(config_path, 'r') as f:
            content = f.read()
        print("Generated config:")
        print(content)
        assert "receptor = receptor.pdbqt" in content
        assert "center_x = 0.0" in content
        assert "size_x = 10.0" in content
        print("✓ generate_vina_config test passed")
    finally:
        if os.path.exists(config_path):
            os.unlink(config_path)


def test_parse_vina_log():
    """Test parsing a Vina log file."""
    # Create a sample log file content
    sample_log = """
AutoDock Vina 1.1.2
...
   MODEL          ENERGY
        1        -7.8
        2        -7.5
        3        -7.2
...
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
        f.write(sample_log)
        log_path = f.name

    try:
        energies, _ = parse_vina_log(log_path)
        print(f"Parsed energies: {energies}")
        assert len(energies) == 3
        assert energies[0] == -7.8
        assert energies[1] == -7.5
        assert energies[2] == -7.2
        print("✓ parse_vina_log test passed")
    finally:
        if os.path.exists(log_path):
            os.unlink(log_path)


def test_dock_vina_mock():
    """Test the high-level dock_vina function with mocked Vina execution."""
    # We'll mock the run_vina_locally function to avoid needing actual Vina executable
    import vina_docking as vina_module

    # Save original function
    original_run = vina_module.run_vina_locally

    def mock_run_vina_locally(config_path, output_path, log_path):
        # Create dummy output files
        with open(log_path, 'w') as f:
            f.write("""
   MODEL          ENERGY
        1        -7.8
        2        -7.5
""")
        # Create a dummy output PDBQT file
        with open(output_path, 'w') as f:
            f.write("REMARK   1 MODEL     1       -7.8\n")
            f.write("ENDMDL\n")
            f.write("REMARK   1 MODEL     2       -7.5\n")
            f.write("ENDMDL\n")
        return 0  # Success

    # Monkey patch
    vina_module.run_vina_locally = mock_run_vina_locally

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create dummy receptor and ligand files (just touch them)
            receptor_path = os.path.join(tmpdir, "receptor.pdbqt")
            ligand_path = os.path.join(tmpdir, "ligand.pdbqt")
            open(receptor_path, 'a').close()
            open(ligand_path, 'a').close()

            config = VinaConfig(
                receptor=receptor_path,
                ligand=ligand_path,
                center_x=0.0,
                center_y=0.0,
                center_z=0.0,
                size_x=10.0,
                size_y=10.0,
                size_z=10.0
            )

            result = dock_vina(config)
            print(f"Docking result: {result}")
            assert result['success'] == True
            assert len(result['energies']) == 2
            assert result['energies'][0] == -7.8
            assert result['energies'][1] == -7.5
            assert result['output_pdbqt'] is not None
            assert result['log'] is not None
            print("✓ dock_vina test passed")
    finally:
        # Restore original function
        vina_module.run_vina_locally = original_run


def test_dock_vina_modal_fallback():
    """Test that dock_vina_modal falls back to local when Modal is not available."""
    # We'll mock the run_vina_locally function to avoid needing actual Vina executable
    import vina_docking as vina_module

    # Save original function
    original_run = vina_module.run_vina_locally

    def mock_run_vina_locally(config_path, output_path, log_path):
        # Create dummy output files
        with open(log_path, 'w') as f:
            f.write("""
   MODEL          ENERGY
        1        -7.8
""")
        # Create a dummy output PDBQT file
        with open(output_path, 'w') as f:
            f.write("REMARK   1 MODEL     1       -7.8\n")
            f.write("ENDMDL\n")
        return 0  # Success

    # Monkey patch
    vina_module.run_vina_locally = mock_run_vina_locally

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create dummy receptor and ligand files (just touch them)
            receptor_path = os.path.join(tmpdir, "receptor.pdbqt")
            ligand_path = os.path.join(tmpdir, "ligand.pdbqt")
            open(receptor_path, 'a').close()
            open(ligand_path, 'a').close()

            config = VinaConfig(
                receptor=receptor_path,
                ligand=ligand_path,
                center_x=0.0,
                center_y=0.0,
                center_z=0.0,
                size_x=10.0,
                size_y=10.0,
                size_z=10.0
            )

            # Since Modal is not installed, it should fall back to local
            result = dock_vina_modal(config)
            print(f"Modal docking result: {result}")
            assert result['success'] == True
            assert len(result['energies']) == 1
            assert result['energies'][0] == -7.8
            assert result['output_pdbqt'] is not None
            assert result['log'] is not None
            print("✓ dock_vina_modal fallback test passed")
    finally:
        # Restore original function
        vina_module.run_vina_locally = original_run


if __name__ == "__main__":
    test_generate_vina_config()
    test_parse_vina_log()
    test_dock_vina_mock()
    test_dock_vina_modal_fallback()
    print("\nAll tests passed!")