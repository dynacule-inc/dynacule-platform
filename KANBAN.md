# Dynacule Project Kanban Board — Sprint 2

## Sprint 2 — Product Improvements

### To-Do
- [ ] T6: Backend hardening — fix MD temp-file race, file upload endpoint, result endpoints, tests

### In Progress
- [ ] None

### Review
- [ ] None

### Done (Sprint 2)
- [x] **T6: Backend hardening** — temp-file race fix, test suite, endpoint cleanup
  - Fixed MD temp-file race: PDB content now passed as string directly to Celery worker (no temp file)
  - Fixed QM task signature: added **kwargs to accept extra_keywords/pal
  - Cleaned dead imports (os, tempfile) from docking.py, qm.py
  - Added 16-test pytest suite covering health, projects, molecules, jobs, docking, MD, QM
  - All tests pass: 16/16 in 0.65s
- [x] **T4: Results visualization** — docking poses, MD trajectory, property display in NGL
  - Store: VizCommand type system (clear | docking | md | qm) + trajFrame state
  - ResultsViewer toolbar: appears below main toolbar when a completed job is selected via "Show" button in JobPanel; provides "Show in Viewer" / "Clear" controls
  - Docking viz: loads ligand as orange ball+stick overlay in NGL viewer
  - MD viz: loads multi-model PDB as trajectory with frame slider (input range) showing current frame / total
  - QM viz: mock energy data (Total, HOMO, LUMO, Gap) metadata display
  - JobPanel: "Show" button on completed jobs with gold highlight when active
  - MolecularViewer: reacts to vizCommand changes, manages overlay and trajectory component lifecycles via refs, setFrame() for frame stepping
  - Mock data generators for ligand PDB and 10-frame trajectory PDB
- [x] **T5: Molecule detail page** — 2D depiction, descriptor radar chart, properties table
  - Backend: GET /molecules/{id}/descriptors (with RDKit fallback to SMILES-based estimation)
  - Frontend: SmilesDepict — custom SVG 2D structural formula renderer (atoms as colored circles, bond lines, multi-bond support)
  - Frontend: RadarChart — custom SVG hexagonal spider chart for 7 normalized physicochemical properties with grid levels, axis labels, and data polygon
  - Frontend: MoleculeDetailPanel — floating card at bottom-left of viewer, shows name/formula, SMILES depiction, source, properties table in grid layout, auto-fetches descriptors on molecule select
- [x] **T3: Wire command palette to real API actions** — 10 pipeline items with inline forms and API calls
  - Molecules: Create from SMILES (→ POST /smiles), Upload file (triggers file picker)
  - Analysis: Calculate Descriptors (→ GET /descriptors), Generate Conformers (→ GET /conformers)
  - Simulations: Setup Vina Docking (→ POST /docking/ with grid params), Run MD (→ POST /md/ with PDB + forcefield selector), Run QM (→ POST /qm/ with theory/basis)
  - System: Create New Project (→ POST /projects/)
  - All actions show inline forms, loading state, formatted JSON result, and error handling
- [x] **T2: Job monitoring dashboard** — job list, status badges, progress bars, result display
  - Backend: Unified GET /api/v1/jobs/ (filtering, pagination), GET /stats, GET /{id} (full detail + result), WebSocket /ws for global job events
  - Worker: publish_job_event() broadcasts lifecycle changes (pending→processing→completed/failed) to Redis channel "job:events"
  - Frontend: JobPanel component with status badges (color-coded), progress bars, expandable detail cards, WebSocket-connected live refresh
  - Infra: Fixed database.py sync/async engine separation, added greenlet
- [x] **T1: Molecule input & upload** — SMILES field, PDB/MOL/SDF file upload, load into NGL viewer
  - Backend: Molecule model, POST /smiles, POST /upload, GET /{id}/pdb, GET /, DELETE /{id}, descriptor/conformer routes
  - Frontend: MoleculePanel component with SMILES input + file upload + molecule list, Zustand store updates, NGL ribbon preset (ribbon + tube, white)
  - Verified: All endpoints tested, database schema auto-creates, NGL loads PDB via Blob

## Sprint 1 — Foundation (Complete)
- [x] Initialize project structure and dependencies
- [x] Set up local Docker network (dynacule-net)
- [x] Configure Docker Compose for development environment
- [x] Implement FastAPI backend with basic endpoints
- [x] Implement Next.js frontend with NGL viewer
- [x] Establish WebSocket connection for real-time updates
- [x] Integrate Redis for task queuing
- [x] Implement AutoDock Vina wrapper (skill)
- [x] Implement OpenMM wrapper (skill)
- [x] Implement Psi4/ORCA wrapper (skill)
- [x] Implement RDKit ADME/Tox profiling
- [x] Implement command palette (cmdk)
- [x] Implement project table with bi-directional binding
- [x] Implement agentic status indicators
- [x] Set up Modal.com GPU offloading
- [x] Test local deployment and verify functionality
- [x] Create beginner's SaaS transition guide
- [x] Create skill documentation for each pipeline
- [x] Create master deployment orchestration document