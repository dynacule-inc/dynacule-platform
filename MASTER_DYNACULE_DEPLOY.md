# MASTER_DYNACULE_DEPLOY.md

# Master Dynacule Deployment Guide

This document provides a comprehensive overview of the Dynacule deployment process, cross-referencing the various skills and components we've built. It includes environment variable configuration, build commands, and lifecycle management instructions.

## Table of Contents
1. [Environment Variables](#environment-variables)
2. [Build and Lifecycle Commands](#build-and-lifecycle-commands)
3. [Service Dependencies](#service-dependencies)
4. [Cross-Reference to Skills](#cross-reference-to-skills)
5. [Local Development Workflow](#local-development-workflow)
6. [Production Deployment Considerations](#production-deployment-considerations)
7. [Troubleshooting](#troubleshooting)

---

## Environment Variables

Dynacule relies on several environment variables for configuration. These should be set in a `.env` file in the project root (for local development) or configured in your deployment platform (for production).

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | API key for accessing OpenRouter's LLM APIs (used by the AI companion) | `sk-or-...` |
| `REDIS_URL` | Connection string for Redis (used by Celery) | `redis://localhost:6379` |
|| `DATABASE_URL` | Database URL (SQLite for dev, PostgreSQL for production) | `sqlite+aiosqlite:///./dynacule.db` (dev) / `postgresql://...` (prod) |
| `NEXT_PUBLIC_API_URL` | Base URL for the backend API (used by frontend) | `http://localhost:8000` |

### Optional Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `MODAL_TOKEN_ID` | Modal.com token ID (for production GPU offloading) | `your_modal_token_id` |
| `MODAL_TOKEN_SECRET` | Modal.com token secret (for production GPU offloading) | `your_modal_token_secret` |
| `CELERY_BROKER_URL` | Override for Redis URL (if different from main Redis) | `redis://redis:6379/1` |
| `CELERY_RESULT_BACKEND` | Result backend for Celery (can be Redis or database) | `redis://redis:6379/2` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `ENVIRONMENT` | Deployment environment (development, staging, production) | `development` |

### Notes
- For local development using `docker compose`, the `REDIS_URL` is automatically set via Docker networking.
- The `DATABASE_URL` is not used in local development by default (we use SQLite for simplicity), but is required for production.
- The `NEXT_PUBLIC_API_URL` must be set to the backend's URL so the frontend knows where to make API requests.

---

## Build and Lifecycle Commands

Here are the essential commands for building, starting, stopping, and managing the Dynacule application.

### Local Development (Docker Compose)
```bash
# Build and start all services
docker compose up --build

# Start in detached mode (background)
docker compose up -d --build

# Stop and remove containers, networks, and volumes
docker compose down

# Stop containers but preserve volumes and networks
docker compose stop

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f redis

# Rebuild a specific service
docker compose build frontend
docker compose build backend

# Run a one-off command in a service (e.g., run migrations)
docker compose run backend python manage.py migrate
```

### Backend Management (Outside Docker)
If you need to manage the backend outside of Docker (for debugging, etc.):
```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run Celery worker
celery -A app.core.celery worker --loglevel=info

# Run Celery beat (for periodic tasks, if any)
celery -A app.core.celery beat --loglevel=info
```

### Frontend Management (Outside Docker)
```bash
# Install dependencies (pinned versions in package.json)
cd frontend
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

> **Note:** NGL is loaded dynamically in the browser (WebGL only).
> It is NOT server-side rendered. The `next.config.mjs` handles this via
> `serverExternalPackages` and webpack externals.

### Testing
```bash
# Run backend tests
cd backend
python -m pytest

# Run frontend tests
cd frontend
npm test
```

### Skill-Specific Commands
Each skill has its own testing and usage patterns:

#### Vina Docking Skill
```bash
# Test the Vina pipeline
cd backend
python -m pytest test_vina_docking.py -v

# Example usage (from Python)
from app.utils.vina_docking import dock_vina
result = dock_vina(
    ligand_smiles="CCO",
    receptor_pdb_path="/path/to/receptor.pdbqt",
    center_x=0.0, center_y=0.0, center_z=0.0,
    size_x=20.0, size_y=20.0, size_z=20.0
)
```

#### OpenMM Skill
```bash
# Test OpenMM workflows (requires OpenMM installation)
cd backend
python -c "from app.utils.openmm_workflows import generate_system_from_pdb; print('OpenMM imported successfully')"

# Example usage
from app.utils.openmm_workflows import generate_system_from_pdb, energy_minimization
modeller, system, topology = generate_system_from_pdb("input.pdb")
positions_min, info = energy_minimization(system, topology, modeller.positions)
```

#### QM Skill
```bash
# Test QM workflows (requires Psi4 and/or ORCA)
cd backend
python -c "from app.utils.qm_workflows import generate_psi4_input; print('QM workflows imported successfully')"

# Example usage
from app.utils.qm_workflows import generate_psi4_input, run_psi4_calculation
input_str = generate_psi4_input(
    molecule={'symbols': ['C', 'O'], 'coordinates': [[0,0,0], [1.1,0,0]]},
    task='single_point',
    theory='b3lyp',
    basis_set='6-31g*'
)
```

---

## Service Dependencies

Dynacule relies on several external services. Understanding these dependencies is crucial for deployment and troubleshooting.

### 1. **Redis**
- Purpose: Message broker for Celery and pub/sub for real-time updates
- Local: Provided by Docker Compose (`redis` service)
- Production: Can be self-hosted or managed (AWS ElastiCache, Redis Cloud, etc.)
- Port: 6379
- Health Check: `redis-cli ping` should return `PONG`

### 2. **PostgreSQL** (Production)
- Purpose: Persistent storage for users, projects, jobs, results
- Local: Not used by default (we use SQLite for simplicity in development)
- Production: Required for durability and scalability
- Port: 5432
- Health Check: `pg_isready -h localhost -p 5432` should accept connections

### 3. **Modal.com** (GPU Offloading)
- Purpose: Heavy computation workloads (MD, QM, docking at scale)
- Local: Uses development account (free tier limited)
- Production: Requires paid account with sufficient GPU credits
- Integration: Via API tokens (`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`)
- Health Check: Test a simple Modal function to ensure connectivity

### 4. **OpenRouter** (AI Companion)
- Purpose: Provides access to LLMs for the embedded chat companion
- Local/Production: Requires API key (`OPENROUTER_API_KEY`)
- Health Check: Make a simple API call to verify key validity

### 5. **Web Browsers** (Frontend)
- Purpose: User interface
- Supported: Modern browsers (Chrome, Firefox, Safari, Edge)
- Features Used: WebSockets, WebGL (via NGL Viewer), LocalStorage, Service Workers (for PWA potential)

---

## Cross-Reference to Skills

This section maps the deployment components to the skills we've created, showing how each piece fits into the overall system.

| Component | Related Skill(s) | Description |
|-----------|------------------|-------------|
| **Frontend (Next.js)** | - | Built with skills from frontend-generalist work: NGL Viewer integration, Zustand store, bidirectional picking, command palette |
| **Backend (FastAPI)** | - | Core API, WebSocket router, dependency injection |
| **Cheminformatics (RDKit)** | `SKILL_VINA_SETUP.md` (indirectly), but primarily from RDKit integration task | Molecular descriptors, conformer generation, Lipinski filtering, format conversion |
| **AutoDock Vina** | `SKILL_VINA_SETUP.md` | Docking pipeline, input generation, log parsing, Celery task, Modal.com wrapper |
| **OpenMM (MD)** | `SKILL_OPENMM_SETUP.md` | System generation, minimization, equilibration, production, analysis, Celery task, Modal.com wrapper |
| **QM (Psi4/ORCA)** | `SKILL_QUANTUM_SETUP.md` | Input generation, calculation execution, output parsing, Celery task, Modal.com wrapper |
| **Celery/RabbitMQ** | - | Task queue for asynchronous jobs (see `backend/app/worker/tasks.py`) |
| **WebSocket/Redis Pub/Sub** | - | Real-time bridge for logs and trajectories (see `backend/app/api/websocket.py`) |
| **Modal.com GPU Offloading** | `SKILL_VINA_SETUP.md`, `SKILL_OPENMM_SETUP.md`, `SKILL_QUANTUM_SETUP.md` | Wrappers for deploying scientific workflows to Modal GPU instances |
| **AI Companion** | - | Independent OpenRouter API client for chat (see `backend/app/utils/` for potential integration) |
| **Project Table & 3D Viewer Binding** | - | Bidirectional data binding between frontend components (Zustand store) |

### Skill Files Location
- `SKILL_VINA_SETUP.md` - AutoDock Vina setup and usage
- `SKILL_OPENMM_SETUP.md` - OpenMM molecular dynamics setup
- `SKILL_QUANTUM_SETUP.md` - Quantum mechanics (Psi4/ORCA) setup
- `BEGINNER_SAAS_GUIDE.md` - Comprehensive guide for beginners on local development and SaaS transition
- `KANBAN.md` - Progress tracking board (updated throughout development)

---

## Local Development Workflow

Here's a recommended workflow for developing and testing Dynacule locally:

1. **Start the Environment**
   ```bash
   docker compose up -d
   ```

2. **Make Changes**
   - Edit frontend code in `/frontend`
   - Edit backend code in `/backend`
   - Skills are in `/backend/app/utils/` and `/backend/modal/`

3. **Test Changes**
   - Frontend: Automatic reload via Next.js dev server (if running outside Docker) or rebuild Docker image
   - Backend: 
     - For API changes: Restart backend container (`docker compose restart backend`)
     - For Celery task changes: Restart worker (`docker compose restart backend` - assumes worker is part of backend service in compose)
   - For skill changes: Run the skill's specific test suite (see Skill-Specific Commands above)

4. **View Logs**
   ```bash
   docker compose logs -f -t  # Follow logs with timestamps
   ```

5. **Reset Environment** (if needed)
   ```bash
   docker compose down -v  # Removes volumes, giving a clean state
   docker compose up -d
   ```

6. **Access Application**
   - Frontend: http://localhost:3001 (port 3001 to avoid conflicts with other services)
   - Backend API docs: http://localhost:8000/docs (Swagger UI)
   - Backend ReDocs: http://localhost:8000/redoc
   - Backend health: http://localhost:8000/health

---

## Production Deployment Considerations

When moving from local development to a production SaaS environment, consider the following:

### 1. **Infrastructure**
- Use managed services where possible (managed PostgreSQL, Redis)
- Consider Kubernetes for orchestration if managing many services
- Use a CDN for frontend assets (Cloudflare, AWS CloudFront)
- Implement proper load balancing and health checks

### 2. **Security**
- Use environment variables or secret managers for all secrets (never commit to repo)
- Enable HTTPS everywhere (use Let's Encrypt or cloud provider certificates)
- Implement proper CORS policies
- Regularly update dependencies to patch vulnerabilities
- Consider a Web Application Firewall (WAF)

### 3. **Scaling**
- Frontend: Easily scalable via CDN and horizontal pod autoscaling (if using K8s)
- Backend: Scale based on worker count (Celery workers can be scaled independently)
- Database: Use read replicas for heavy read loads
- Redis: Consider clustering for high availability
- Modal.com: Already scales automatically - you pay for what you use

### 4. **Monitoring & Logging**
- Aggregate logs (ELK stack, Fluentd, Datadog, etc.)
- Monitor key metrics: API latency, job queue depth, worker utilization, error rates
- Set up alerts for critical issues (high failure rate, system downtime)
- Use application performance monitoring (APM) tools

### 5. **Backup & Disaster Recovery**
- Regular automated backups of PostgreSQL database
- Test restore procedures regularly
- Consider cross-region replication for disaster recovery
- For Modal.com: Results should be stored in persistent storage (database or object store) not just in Modal's transient storage

### 6. **CI/CD Pipeline**
- Automated testing on pull requests
- Automated builds and deployments to staging
- Manual approval for production deployments
- Blue/green or canary deployment strategies to minimize downtime

### 7. **Cost Optimization**
- Right-size your infrastructure (don't over-provision)
- Use spot instances or preemptible VMs for fault-tolerant workloads
- Schedule non-critical jobs during off-peak hours
- Monitor Modal.com usage and set budget alerts
- Consider reserving instances for predictable baseline loads

---

## Troubleshooting

Here are common issues and their solutions:

### 1. **Container Won't Start**
- **Symptom**: `docker compose up` fails or containers exit immediately
- **Solution**: 
  - Check logs: `docker compose logs [service]`
  - Common causes: Port already in use, missing dependencies, syntax errors in Dockerfile
  - Ensure required ports (3000, 8000, 6379) are free

### 2. **Frontend Can't Connect to Backend**
- **Symptom**: API errors in browser console, empty data in UI
- **Solution**:
  - Verify `NEXT_PUBLIC_API_URL` is correct in frontend environment
  - Check backend is running and accessible: `curl http://localhost:8000/docs`
  - Ensure Docker network allows frontend to reach backend (they should be on same network via compose)
  - Check for CORS issues in backend

### 3. **Celery Tasks Not Processing**
- **Symptom**: Jobs stay in PENDING state, no worker activity
- **Solution**:
  - Check Redis is running: `docker compose logs redis`
  - Verify Celery worker is running: `docker compose logs backend` (look for Celery logs)
  - Ensure `REDIS_URL` is correct and accessible from backend
  - Check for errors in task definition that prevent worker from starting

### 4. **Modal.com Integration Failing**
- **Symptom**: Jobs fail with Modal-related errors
- **Solution**:
  - Verify Modal.com account has sufficient credits
  - Check `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` are set correctly
  - Test a simple Modal function to ensure basic connectivity
  - Check logs in Modal.com dashboard for detailed error messages

### 5. **Database Connection Issues**
- **Symptom**: Backend fails to start or throws database errors
- **Solution** (for production with PostgreSQL):
  - Verify `DATABASE_URL` is correct
  - Ensure database server is running and accessible
  - Check that the database exists and user has proper permissions
  - Run migrations if needed: `docker compose run backend python manage.py migrate`

### 6. **Performance Problems**
- **Symptom**: Slow API responses, laggy UI
- **Solution**:
  - Check backend logs for slow queries or blocking operations
  - Monitor Redis memory usage and eviction policies
  - Consider adding database indexes for frequently queried fields
  - For frontend: Use React DevTools to check for unnecessary re-renders
  - Enable caching where appropriate (e.g., for molecular descriptors)

### 7. **WebSocket Connection Issues**
- **Symptom**: No real-time updates, disconnected status in UI
- **Solution**:
  - Check browser console for WebSocket error messages
  - Verify backend WebSocket endpoint is reachable: `ws://localhost:8000/ws/...`
  - Ensure any proxies/load balancers support WebSocket connections
  - Check Redis pub/sub configuration if using for message broadcasting

---

## Conclusion

This guide provides the foundation for deploying and managing Dynacule in both local and production environments. By following the instructions in this document and referencing the specific skills for each component, you should be able to:

1. Set up a local development environment quickly
2. Understand how each service interacts with the others
3. Deploy to production with confidence
4. Troubleshoot common issues effectively
5. Plan for scaling and optimization as your user base grows

Remember that the key to Dynacule's architecture is the separation of concerns:
- The frontend handles user interaction and visualization
- The backend manages orchestration and business logic
- Celery and Redis handle asynchronous job processing
- Modal.com provides scalable GPU computing for heavy workloads
- Skills encapsulate domain-specific knowledge for each scientific pipeline

With this modular approach, you can evolve each component independently while maintaining a cohesive and powerful application for computational chemistry research.

Happy deploying!