# Dynacule QC/QA Framework

## Overview

The `qa/` directory contains the complete Quality Control and Quality Assurance framework for the Dynacule computational chemistry platform. It covers backend API contracts, utility function correctness, Celery task routing, frontend component integrity, computational pipeline validation, and Docker integration smoke tests.

---

## Directory Structure

```
qa/
├── pytest.ini                           # Global pytest configuration
├── vitest.config.ts                     # Frontend vitest configuration
│
├── backend/
│   ├── conftest.py                      # TestClient, mock Redis/Celery, fixtures
│   ├── test_api/
│   │   ├── test_projects.py             # Projects CRUD API
│   │   ├── test_molecules.py            # Molecules + descriptors/conformers
│   │   ├── test_docking.py              # Docking job lifecycle
│   │   ├── test_md.py                   # Molecular dynamics job lifecycle
│   │   ├── test_qm.py                   # Quantum mechanics job lifecycle
│   │   ├── test_websocket.py            # WebSocket connect/disconnect/messaging
│   │   └── test_health.py               # /health, /, OpenAPI schema
│   ├── test_utils/
│   │   ├── test_cheminformatics.py      # RDKit descriptor/conformer/Lipinski tests
│   │   ├── test_vina_docking.py         # Vina docking contract tests
│   │   ├── test_openmm_workflows.py     # OpenMM workflow contract tests
│   │   └── test_qm_workflows.py         # QM input/output/parse tests
│   └── test_worker/
│       └── test_tasks.py                # Celery task dispatch/error/progress
│
├── frontend/
│   ├── setup.ts                         # Vitest global setup + mocks
│   ├── components/
│   │   ├── MolecularViewer.test.tsx     # NGL viewer shell tests
│   │   ├── CommandPalette.test.tsx      # Cmd+K palette open/close/select
│   │   ├── ProjectTable.test.tsx        # Project list/select lifecycle
│   │   └── StatusBar.test.tsx           # WebSocket status indicator tests
│   └── lib/
│       ├── store.test.ts                # Zustand store state management
│       └── projectApi.test.ts           # API client fetch/map/error
│
├── pipeline/
│   ├── test_accuracy.py                 # Computational pipeline contract validation
│   └── reference/                       # Reference data files (future)
│
└── smoke/
    ├── conftest.py                      # Docker compose fixture + health waits
    └── test_integration.py              # Docker integration smoke tests
```

## Running Tests

### All backend tests

```bash
# From the project root (Dynacule Sprint 2/)
cd /path/to/Dynacule\ Sprint\ 2

# Run all backend tests
python -m pytest qa/backend/ -v

# With coverage
python -m pytest qa/backend/ -v --cov=backend/app

# Specific test file
python -m pytest qa/backend/test_api/test_docking.py -v

# Specific test class
python -m pytest qa/backend/test_api/test_docking.py::TestCreateDockingJob -v

# Specific test
python -m pytest qa/backend/test_api/test_docking.py::TestCreateDockingJob::test_create_success -v
```

### Pipeline tests

```bash
# Computational pipeline contract validation
python -m pytest qa/pipeline/ -v -m pipeline
```

### Frontend tests

```bash
# Run vitest with frontend config
npx vitest run --config qa/vitest.config.ts

# Watch mode
npx vitest --config qa/vitest.config.ts
```

### Docker smoke tests

```bash
# These spin up the full Docker stack — requires Docker running
python -m pytest qa/smoke/ -v -m smoke

# Warning: These tests modify your local Docker state (build/start/stop)
```

### All tests

```bash
python -m pytest qa/ -v --ignore=qa/smoke
```

## Test Categories

| Marker | Category | Description |
|--------|----------|-------------|
| `api` | API Integration | FastAPI endpoint behavior via TestClient |
| `unit` | Unit Tests | Pure function tests, no external deps |
| `worker` | Celery Tasks | Task dispatch with mocked compute backends |
| `pipeline` | Pipeline | Computational module contract validation |
| `smoke` | Smoke Tests | Full-stack Docker integration |
| `slow` | Slow Tests | Tests taking >10s (excluded by default) |

Slow tests are excluded by default. Run with `--runslow` to include them:

```bash
python -m pytest qa/ -v --runslow
```

## Test Design Principles

### Backend API Tests
- Use FastAPI `TestClient`, not real HTTP
- Mock Redis (`publish_progress_sync`) and Celery (`.delay()`) at the conftest level
- Test success paths, validation errors (422), not-found (404), and edge cases
- Each router test file covers: create, get, list, validation

### Utility Tests
- Functions tested in isolation — no database, no network
- RDKit-dependent tests auto-skip when `rdkit` is not installed
- OpenMM-dependent tests verify ImportError graceful degradation
- QM tests verify input generation format and output parsing

### Frontend Tests
- NGL, WebSocket, and cmdk are mocked at the vitest setup level
- Store tests verify Zustand state transitions
- API client tests verify fetch/map/error handling
- Component tests verify render, interaction, and lifecycle

### Pipeline Tests
- Verify computational module import contracts
- Verify function signatures and return shapes
- Validate that missing dependencies (OpenMM, RDKit) produce clear errors

## Coverage Targets

| Layer | Current | Target |
|-------|---------|--------|
| Backend API routers | ~85% | 90%+ |
| Backend utilities | ~80% | 85%+ |
| Celery tasks | ~90% | 95%+ |
| Frontend components | ~70% | 80%+ |
| Frontend store/client | ~90% | 90%+ |

Coverage reports are generated to `qa/coverage_html/` (backend) and `qa/coverage_frontend/` (frontend).

## Adding New Tests

### New API endpoint
1. Add a test file in `qa/backend/test_api/` following the `test_{router}.py` pattern
2. Use the existing `client`, `db_session`, and sample_data fixtures from `conftest.py`
3. Cover: success, validation error, not-found, and edge cases

### New utility function
1. Add tests in `qa/backend/test_utils/` following `test_{module}.py`
2. Mark tests `@pytest.mark.unit`
3. Use `pytest.skip` for optional dependency guards

### New frontend component
1. Add tests in `qa/frontend/components/`
2. Mock external dependencies in `setup.ts`
3. Test: render, interaction, state changes, error states

## CI Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run backend tests
  run: python -m pytest qa/backend/ -v --cov=backend/app

- name: Run frontend tests
  run: npx vitest run --config qa/vitest.config.ts
```

## Known Issues & Technical Debt

1. **QM function signature mismatch**: `run_psi4_calculation()` takes `(input_file, ...)` but `tasks.py` calls it as `run_psi4_calculation(molecule_data, task_type=..., ...)`. Same for `run_orca_calculation`. These are bugs — the task layer and the utility layer have different contracts.
2. **Vina docking function**: `run_vina_docking()` in `vina_docking.py` requires `ligand_smiles` but `tasks.py` doesn't pass it. The mock function ignores it but production would need it.
3. **Store contract mismatch**: `MolecularViewer.tsx` uses `selectedAtom`/`setSelectedAtom` from the Zustand store, but the store only defines `projects`/`selectedProjectId`. The store needs extension.
4. **Docker smoke tests**: Require a running Docker daemon. The `compose_stack` fixture does `docker compose up -d --build` which needs Docker installed and the user in the docker group.

## Pipeline Accuracy Validation Protocol

When running computational pipelines on Modal GPUs:

1. **Vina Docking**: Compare docking energies against known reference values (±0.5 kcal/mol)
2. **OpenMM MD**: Verify energy conservation (total energy drift < 0.1% per ns)
3. **Psi4/ORCA QM**: Verify single-point energies match reference calculations
4. **RDKit ADME/Tox**: Compare descriptors against published values

Reference data lives in `qa/pipeline/reference/`. Add reference JSON/CSV files for each pipeline with expected output ranges.