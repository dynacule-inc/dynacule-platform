# SKILL_VINA_SETUP.md

## AutoDock Vina Setup Skill

### Overview
This skill provides a complete pipeline for setting up and running AutoDock Vina molecular docking within the Dynacule platform. It includes input generation, job submission (local or via Modal.com), and result parsing.

### Components
1. **Input Generation**: Functions to convert ligand and receptor structures to PDBQT format and generate Vina configuration files.
2. **Job Execution**: Local execution of Vina (for development/testing) and Modal.com GPU offloading (for production).
3. **Result Parsing**: Extraction of binding energies, poses, and logs from Vina output.
4. **Integration**: Celery tasks and API endpoints for asynchronous job processing.

### Files
- `backend/vina_docking.py`: Core docking pipeline functions.
- `backend/test_vina_docking.py`: Unit tests for the Vina pipeline.
- `backend/app/api/docking.py`: API endpoints for docking jobs.
- `backend/app/worker/tasks.py`: Celery task for docking (`docking_task`).
- `backend/modal/vina_modal.py`: Modal.com wrapper for Vina docking.

### Key Functions
#### `vina_docking.py`
- `VinaConfig`: Dataclass holding docking parameters.
- `generate_vina_config()`: Creates Vina configuration file from a `VinaConfig`.
- `run_vina_locally()`: Executes Vina command line tool.
- `parse_vina_log()`: Extracts binding energies from Vina log.
- `dock_vina()`: High-level function that runs docking and returns results.
- `dock_vina_modal()`: Stub for Modal.com integration.

#### Celery Task (`backend/app/worker/tasks.py`)
```python
@celery_app.task(bind=True)
def docking_task(self, job_id: int, ligand_smiles: str, receptor_pdb_path: str, 
                 center_x: float, center_y: float, center_z: float, 
                 size_x: float, size_y: float, size_z: float, exhaustiveness: int = 8):
    # Updates job status, runs docking via `run_vina_docking`, stores results.
```

#### API Endpoint (`backend/app/api/docking.py`)
- `POST /api/v1/docking/run`: Creates a docking job and returns job ID.
- `GET /api/v1/docking/{job_id}`: Retrieves job status and results.

### Usage
1. Prepare ligand (SMILES or PDBQT) and receptor (PDBQT).
2. Define docking box (center and size).
3. Submit job via API or directly call the Celery task.
4. Monitor job status via WebSocket or polling.
5. Retrieve results (binding energies, poses) upon completion.

### Modal.com Integration
For production deployment, the `dock_vina_modal()` function (or the Celery task) can be replaced with a call to the Modal function:
```python
from backend.modal.vina_modal import run_vina_docking
result = run_vina_docking.remote(ligand_pdbqt, receptor_pdbqt, center_x, center_y, center_z, size_x, size_y, size_z, exhaustiveness)
```
The Modal function runs in a GPU-enabled container with Vina pre-installed.

### Dependencies
- AutoDock Vina (v1.2.5 or later)
- Python packages: `numpy`, `pydantic`
- For Modal: `modal` client

### Testing
Run `python -m pytest backend/test_vina_docking.py` to verify the pipeline.

### Notes
- The local Vina execution requires the `vina` executable to be in the system PATH.
- The Modal integration is designed as a drop-in replacement for the local function.
- Error handling includes job failure status updates and detailed error messages.