# SKILL_OPENMM_SETUP.md

## OpenMM Setup Skill

### Overview
This skill provides a complete pipeline for setting up and running OpenMM molecular dynamics simulations within the Dynacule platform. It includes system generation, minimization, equilibration, production runs, and analysis of trajectories. Heavy computations are offloaded to Modal.com GPU instances.

### Components
1. **System Generation**: Functions to load PDB files, add solvent and ions, and create OpenMM systems with force fields.
2. **Simulation Protocols**: Energy minimization, NVT/NPT equilibration, and production MD.
3. **Analysis Tools**: Computation of RMSD, radius of gyration, and other properties from trajectories.
4. **Job Execution**: Local execution (development/testing) and Modal.com GPU offloading (production).
5. **Integration**: Celery tasks and API endpoints for asynchronous job processing.

### Files
- `backend/app/utils/openmm_workflows.py`: Core OpenMM workflow functions.
- `backend/app/api/md.py`: API endpoints for MD jobs.
- `backend/app/worker/tasks.py`: Celery task for MD (`md_task`).
- `backend/modal/openmm_modal.py`: Modal.com wrapper for OpenMM simulations.

### Key Functions
#### `openmm_workflows.py`
- `generate_system_from_pdb()`: Creates OpenMM system from PDB with solvent and ions.
- `energy_minimization()`: Runs steepest descent or conjugate gradient minimization.
- `equilibration()`: Runs NVT then NPT equilibration.
- `production_md()`: Runs production MD and writes trajectory to DCD file.
- `compute_rmsd()`: Computes RMSD relative to a reference (placeholder).
- `compute_radius_of_gyration()`: Computes radius of gyration for each frame (placeholder).
- `modal_openmm_simulation_stub()`: Stub for Modal.com integration.

#### Celery Task (`backend/app/worker/tasks.py`)
```python
@celery_app.task(bind=True)
def md_task(self, job_id: int, pdb_file_path: str, forcefield: str = 'amber14-all.xml',
            solvent: str = 'tip3p', box_padding: float = 1.0, ionic_strength: float = 0.15,
            minimization_steps: int = 500, equilibration_steps: int = 1000,
            production_steps: int = 50000, temperature: float = 300.0):
    # Updates job status, runs MD simulation via OpenMM workflows,
    # computes properties, stores results, and publishes progress to Redis/WebSocket.
```

#### API Endpoint (`backend/app/api/md.py`)
- `POST /api/v1/md/run`: Creates an MD job and returns job ID.
- `GET /api/v1/md/{job_id}`: Retrieves job status and results (including trajectory info).

### Usage
1. Prepare a PDB file of the system (protein, ligand, complex).
2. Choose force field (e.g., amber14-all.xml) and solvent model (e.g., tip3p).
3. Define simulation parameters (box padding, ionic strength, steps, temperature).
4. Submit job via API or directly call the Celery task.
5. Monitor job status via WebSocket (real-time logs) or polling.
6. Retrieve results (final energy, trajectory file, computed properties) upon completion.

### Modal.com Integration
For production deployment, the Celery task can be modified to call the Modal function:
```python
from backend.modal.openmm_modal import run_openmm_simulation
# Read PDB content from file or database
pdb_content = open(pdb_file_path).read()
result = run_openmm_simulation.remote(pdb_content, forcefield, solvent, box_padding, ionic_strength,
                                      minimization_steps, equilibration_steps, production_steps, temperature)
```
The Modal function runs in a GPU-enabled container (A10G) with OpenMM pre-installed via conda.

### Dependencies
- OpenMM (with default plugins)
- Python packages: `numpy`, `simtk-openmm`, `simtk-unit`
- For Modal: `modal` client
- Optional for analysis: `mdtraj` (for RMSD/Rg computation)

### Testing
The OpenMM workflows can be tested locally if OpenMM is installed. The Celery task includes error handling and will report failures via job status.

### Notes
- The local OpenMM execution requires OpenMM to be installed and accessible via Python imports.
- The Modal integration is designed to be called from the Celery task (or directly) for scalable GPU-accelerated simulations.
- Trajectory files can be large; in production, consider storing them in Modal's cloud storage or a dedicated object store (e.g., AWS S3) and returning a reference.
- Error handling includes job failure status updates and detailed error messages.