# Execution Directive: Project "Dynacule" Production Build & SaaS Foundation
# Target Agent: Hermes Autonomous Stack
# Mode: Autonomous Execution / Local Docker Network Deployment -> SaaS Transition

## 1. Objective & Scope
You are tasked with the autonomous design, scaffolding, coding, integration, and local deployment of **Dynacule**—a centralized graphical user interface (GUI) portal and computational hub for an advanced open-source chemistry suite. 

**Critical Context:** The ultimate target is to deploy this as a multi-tenant SaaS application in the near future. Furthermore, I am a complete beginner regarding DevOps, AI orchestration, and production deployment. You must act as both an autonomous developer and a patient mentor. Your code must be production-grade, modular, heavily commented, and accompanied by a plain-English, step-by-step guide explaining how everything connects and how to transition this to a live SaaS.

---

## 2. Dynamic Agent Architecture & Hermes Kanban Operations
To guarantee architectural integrity and transparent progress, you must spawn the following isolated sub-agents and manage them using a **Hermes Kanban** workflow. 

**Kanban Directive:** Before writing code, you must initialize a `KANBAN.md` file in the root directory. You must continuously update this file (To-Do, In Progress, Review, Done) as sub-agents complete their tasks.

1.  **Generalist Systems Engineers:**
    * `Sub-Agent: Frontend-Generalist` -> Next.js (App Router), TypeScript, Tailwind CSS layout, and global UI state management. Must build with SaaS concepts in mind (e.g., preparing for user auth/workspaces).
    * `Sub-Agent: Backend-Generalist` -> FastAPI application shell, WebSocket servers, RDKit integrations, and the worker queue routing.
2.  **Specialized Computational Pipeline Engineers:**
    * `Sub-Agent: Docking-Specialist` -> Autonomously designs input/output pipelines for AutoDock Vina.
    * `Sub-Agent: MD-Specialist` -> Autonomously configures workflows and simulation drivers for OpenMM.
    * `Sub-Agent: QM-Specialist` -> Autonomously sets up file parsing and generation for Psi4/ORCA.

---

## 3. Technology Stack, Network Blueprint & GPU Acceleration
All core web components must run autonomously within a **Local Docker Network** (`dynacule-net`), but heavy computational tasks must be offloaded to cloud GPUs.

* **Frontend UI:** Next.js, TypeScript, Tailwind CSS, utilizing a WebGL/Three.js-based rendering canvas (e.g., `3Dmol.js` or `NGL Viewer`) for hardware-accelerated 3D structures.
* **Backend Server:** Python (FastAPI), running asynchronously with `uv` for ultra-fast dependency resolution.
* **GPU Cloud Offloading (Modal.com):** The FastAPI server must not run heavy MD or QM simulations locally. You must write the computational wrappers (OpenMM, Vina) to deploy seamlessly as serverless GPU functions via **Modal.com** (or GCP/RunPod equivalents if Modal syntax requires it). The local FastAPI backend will simply trigger these remote GPU tasks and await the results.
* **Real-Time Bridge:** **WebSockets** must be implemented to push real-time coordinate trajectories and server/HPC calculation logs continuously to the UI canvas.
* **Task Orchestration:** A lightweight async task queue (e.g., Celery) backed by Redis to manage jobs and track remote Modal execution states without blocking the API.
* **Independent AI Layer:** The embedded conversational chat companion must bypass host-level daemons and hook up independently via an **OpenRouter API client**.

---

## 4. Feature Specifications to Implement

### A. Main 3D Workspace & Interaction Modes
* Implement bi-directional data binding: Highlighting an atom/bond on the 3D canvas must instantly highlight its row in the interactive Project Table spreadsheet, and vice versa.
* Implement active "Picking" mouse modes (e.g., distance measuring, torsion modifications). Modify the cursor icon and project an active selection context indicator when toggled.

### B. Command Palette & Project Panels
* Build a global search palette (e.g., `cmdk`). Users typing a keyword like "Setup Docking Run" must instantly have the relevant workflow setup panel docked into view.
* **Project Table:** A robust grid managing molecular metadata, structural formats (`.mol2`, `.pdb`, `.sdf`), and computed scores. 
* **Agentic Status Indicators:** Wire the WebSocket connection to live status trackers showing granular background script steps (e.g., *"Dispatching to Modal GPU..."*, *"Step 2500/10000 of MD run"*).

### C. Open-Source Science Pipelines (Backend Wrappers)
* **AutoDock Vina:** Core docking workflows, grid configuration, and binding energy extraction.
* **OpenMM:** System minimization *in vacuo* or in solution, multi-component diffusion setup, and trajectory output stream parsing.
* **Psi4 / ORCA:** Partial charge distribution maps (ESP, RESP), reaction network maps, and transition state outputs.
* **Predictive ADME/Tox:** RDKit-driven early profiling for basic absorption, distribution, metabolism, excretion, and toxicity rules.

---

## 5. Post-Build Deliverables & Mentorship Guides
Upon successful compilation, execution, and local verification, you must synthesize the following documentation footprints in the root directory:

1.  **`BEGINNER_SAAS_GUIDE.md`:** A comprehensive, jargon-free guide specifically written for a beginner. It must explain exactly how to start the local Docker network, how the Modal.com GPU offloading works, how to test the app, and the exact next steps required to deploy this live as a SaaS to the public.
2.  **`KANBAN.md`:** The finalized board showing all completed operations.
3.  **`SKILL_VINA_SETUP.md`:** The compiled skill standard detailing AutoDock Vina sandbox configurations, input generation, and log parsing.
4.  **`SKILL_OPENMM_SETUP.md`:** The compiled skill file for provisioning OpenMM parameters, handling the Modal.com remote CUDA execution, and trajectory streaming.
5.  **`SKILL_QUANTUM_SETUP.md`:** The compiled skill file for wrapping Psi4/ORCA execution syntax and chemical output matrix calculations.
6.  **`MASTER_DYNACULE_DEPLOY.md`:** A master orchestration document cross-referencing the pipelines above, detailing environment variable configuration, and automated build lifecycle commands.

**Begin initialization immediately. Acknowledge your role as a mentor, initialize `KANBAN.md`, spin up your sub-agents, and generate the codebase.**