# SKILL_QUANTUM_SETUP.md

## Quantum Mechanics Setup Skill (Psi4/ORCA)

### Overview
This skill provides a complete pipeline for setting up and running quantum mechanics (QM) calculations within the Dynacule platform using Psi4 and/or ORCA. It includes input file generation, job submission (local or via Modal.com), and result parsing for energies, gradients, frequencies, and other quantum chemical properties.

### Components
1. **Input Generation**: Functions to generate input files for Psi4 and ORCA from molecular data (symbols and coordinates).
2. **Job Execution**: Local execution of Psi4/ORCA (for development/testing) and Modal.com CPU/GPU offloading (for production).
3. **Result Parsing**: Extraction of energies, gradients, vibrational frequencies, and normal modes from output files.
4. **Integration**: Celery tasks and API endpoints for asynchronous job processing.

### Files
- `backend/app/utils/qm_workflows.py`: Core QM workflow functions (input generation, running calculations, parsing output).
- `backend/app/api/qm.py`: API endpoints for Qm jobs.
- `backend/app/worker/tasks.py`: Celery task for QM (`qm_task`).
- `backend/modal/qm_modal.py`: Modal.com wrapper for Psi4/ORCA calculations.

### Key Functions
#### `qm_workflows.py`
- `generate_psi4_input()`: Creates a Psi4 input file string from molecular data and parameters.
- `generate_orca_input()`: Creates an ORCA input file string from molecular data and parameters.
- `run_psi4_calculation()`: Executes a Psi4 calculation given an input file (uses Python API).
- `run_orca_calculation()`: Executes an ORCA calculation given an input file (uses subprocess).
- `parse_psi4_output()`: Parses Psi4 output to extract energy, gradient, frequencies, etc.
- `parse_orca_output()`: Parses ORCA output to extract energy, gradient, frequencies, etc.
- `modal_psi4_stub()` and `modal_orca_stub()`: Stubs for Modal.com integration.

#### Celery Task (`backend/app/worker/tasks.py`)
```python
@celery_app.task(bind=True)
def qm_task(self, job_id: int, molecule_data: dict, task_type: str = 'single_point',
            theory: str = 'b3lyp', basis_set: str = '6-31g*', charge: int = 0,
            multiplicity: int = 1, software: str = 'psi4', extra_keywords: list = None,
            pal: int = 1):
    # Updates job status, prepares input, runs QM calculation via Psi4 or ORCA,
    # parses output, stores results, and publishes progress to Redis/WebSocket.
```

#### API Endpoint (`backend/app/api/qm.py`)
- `POST /api/v1/qm/run`: Creates a QM job and returns job ID.
- `GET /api/v1/qm/{job_id}`: Retrieves job status and results.

### Usage
1. Prepare molecular data: a dictionary with 'symbols' (list of element symbols) and 'coordinates' (list of [x, y, z] in Angstroms).
2. Choose software: 'psi4' or 'orca'.
3. Choose task type: 'single_point', 'optimization', or 'frequency'.
4. Select theory (e.g., 'b3lyp', 'hf', 'mp2') and basis set (e.g., '6-31g*', 'cc-pvdz').
5. Set charge and multiplicity.
6. Submit job via API or directly call the Celery task.
7. Monitor job status via WebSocket (real-time logs) or polling.
8. Retrieve results (energy, gradient, frequencies, etc.) upon completion.

### Modal.com Integration
For production deployment, the Celery task can be modified to call the Modal function for Psi4:
```python
from backend.modal.qm_modal import run_psi4_calculation
result = run_psi4_calculation.remote(molecule_data, task_type, theory, basis_set, charge, multiplicity)
```
For ORCA, a similar Modal function would be needed (requiring a custom Docker image with ORCA installed). The Modal function runs in a CPU-enabled container (or GPU if using GPU-accelerated QM software) with the necessary dependencies pre-installed.

### Dependencies
- Psi4: `psi4` (via conda or pip)
- ORCA: ORCA executable (must be installed and accessible via command line; no official Python package)
- Python packages: `numpy`, `pydantic`
- For Modal: `modal` client

### Testing
The QM workflows can be tested locally if Psi4 and/or ORCA are installed. The Celery task includes error handling and will report failures via job status.

### Notes
- The local Psi4 execution requires psi4 to be installed and accessible via Python imports.
- The local ORCA execution requires the `orca` command to be in the system PATH.
- The Modal integration for Psi4 is designed to be called from the Celery task (or directly) for scalable QM calculations.
- For ORCA, due to licensing and installation complexity, a custom Modal image may be required. The skill provides a stub that can be extended.
- Error handling includes job failure status updates and detailed error messages.