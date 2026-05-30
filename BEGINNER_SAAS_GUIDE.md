# Dynacule Beginner's Guide to Local Deployment and SaaS Transition

Welcome! This guide is designed for beginners who want to understand how to run Dynacule locally and eventually transition to a live SaaS (Software-as-a-Service) application. We'll walk through each step in plain English, avoiding jargon where possible, and explaining what each part does.

## Table of Contents
1. [What is Dynacule?](#what-is-dynacule)
2. [Local Development Setup](#local-development-setup)
3. [How the Pieces Fit Together](#how-the-pieces-fit-together)
4. [Running the Application Locally](#running-the-application-locally)
5. [Understanding Modal.com GPU Offloading](#understanding-modalcom-gpu-offloading)
6. [Testing the Application](#testing-the-application)
7. [Transitioning to SaaS](#transitioning-to-saas)
8. [Next Steps](#next-steps)

---

## What is Dynacule?

Dynacule is a centralized graphical user interface (GUI) portal and computational hub for chemistry research. Think of it as a sophisticated web application that lets scientists:

- Visualize and manipulate 3D molecular structures
- Run computational chemistry simulations (docking, molecular dynamics, quantum mechanics)
- Manage projects and track results
- Collaborate with team members

It's built using modern web technologies and leverages cloud computing for heavy calculations.

---

## Local Development Setup

Before you can run Dynacule, you need to set up your local development environment. Here's what you'll need:

### Prerequisites
1. **Docker** - Used to run the application in isolated containers
2. **Git** - For cloning the repository (if you haven't already)
3. **Basic command line familiarity** - We'll be using terminal commands

### Step-by-Step Setup

1. **Clone the Repository** (if you haven't already):
   ```bash
   git clone https://github.com/your-org/dynacule.git
   cd dynacule
   ```

2. **Set Environment Variables**:
   Create a `.env` file in the root directory with the following content:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```
   You can get an OpenRouter API key from https://openrouter.ai (free tier available).

3. **Understand the Project Structure**:
   - `frontend/` - The web interface (Next.js, React, TypeScript)
   - `backend/` - The server-side logic (FastAPI, Python)
   - `backend/modal/` - Cloud GPU integration wrappers
   - `docker-compose.yml` - Defines how to run the application

---

## How the Pieces Fit Together

Dynacule uses a microservices architecture. Here's how the components interact:

```
[User's Browser] 
        ↓ (HTTP/WebSocket)
[Frontend (Next.js)] ←→ [Backend (FastAPI)]
        ↓                    ↓
[Redis Queue] ←→ [Celery Workers] ←→ [Modal.com GPU Instances]
        ↓
[PostgreSQL Database] (for job tracking, user data, etc.)
```

Let's break down each piece:

### Frontend (Next.js)
- What you see and interact with in your browser
- Built with React and TypeScript
- Features a 3D molecular viewer (NGL Viewer)
- Includes a project table, command palette, and real-time status updates
- Communicates with the backend via REST APIs and WebSockets

### Backend (FastAPI)
- The "brain" of the operation
- Handles user requests, authentication, and business logic
- Provides REST API endpoints for all functionality
- Manages WebSocket connections for real-time updates
- Orchestrates background jobs through Celery

### Redis & Celery
- **Redis**: A fast in-memory database used as a message broker
- **Celery**: A task queue that handles background jobs
- When you submit a computation job (like docking), it goes:
  1. Frontend → Backend API
  2. Backend → Celery task (stored in Redis queue)
  3. Celery worker processes the job
  4. Results stored back in database and communicated via WebSocket

### Modal.com GPU Offloading
- Heavy computations (molecular dynamics, quantum mechanics) require powerful GPUs
- Instead of buying expensive hardware, we use Modal.com's cloud GPU infrastructure
- The backend sends computation details to Modal.com
- Modal.com runs the job on powerful GPU machines
- Results are returned to the backend when complete
- This keeps costs low (you only pay for compute time used) and gives access to supercomputer-level power

### Database
- Stores persistent information: user accounts, projects, job records, results
- We use PostgreSQL for reliability and scalability

---

## Running the Application Locally

Now let's get Dynacule running on your machine!

### Step 1: Start the Services
In the project root directory, run:
```bash
docker compose up --build
```

This command does several things:
- Builds Docker images for the frontend and backend
- Starts three containers:
  1. `frontend` - The Next.js web application (accessible at http://localhost:3000)
  2. `backend` - The FastAPI server (accessible at http://localhost:8000)
  3. `redis` - The message broker for Celery

You should see logs from all three services in your terminal.

### Step 2: Access the Application
Open your web browser and go to: http://localhost:3000

You should see the Dynacule interface with:
- A sidebar for project management
- A main 3D viewer area
- A command palette (accessible with Cmd/K or Ctrl/K)

### Step 3: Try a Simple Operation
Let's calculate some molecular properties:

1. In the command palette (Cmd/K), type "Calculate Descriptors"
2. Enter a SMILES string (e.g., "CCO" for ethanol)
3. Click "Calculate"
4. You should see molecular properties like molecular weight, logP, etc.

This demonstrates the frontend talking to the backend API, which uses RDKit for cheminformatics calculations.

---

## Understanding Modal.com GPU Offloading

This is one of the most important concepts for transitioning to SaaS.

### Why We Need GPU Offloading
- Molecular dynamics simulations can take hours or days on a regular computer
- Quantum mechanics calculations are even more computationally intensive
- Most users don't have access to powerful GPU workstations or clusters

### How Modal.com Works in Dynacule
1. **Job Submission**: When you submit a heavy computation job:
   - The backend validates your input and creates a job record
   - Instead of running the computation locally, it sends the job to Modal.com

2. **Modal.com Execution**:
   - Modal.com spins up a virtual machine with powerful GPUs
   - It installs the necessary software (OpenMM, Vina, Psi4, etc.) in a container
   - Runs your computation
   - Captures the results (and any output logs)

3. **Result Return**:
   - Modal.com sends the results back to your Dynacule backend
   - The backend stores the results in the database
   - You're notified via the WebSocket connection (real-time updates in the UI)

### What You See as a User
- When you start a computation, you'll see status updates like:
  - "Job queued"
  - "Running on Modal.com GPU..."
  - "Step 1250/50000 of MD simulation"
  - "Job completed! Results available."
- The 3D viewer may update in real-time with trajectory frames (for MD simulations)
- You can close your laptop and come back later - the job continues running in the cloud

### Cost Considerations
- Modal.com charges per second of GPU usage
- For typical chemistry jobs, costs are very low (often fractions of a cent)
- You only pay for actual compute time - no wasted IDLE time
- In a SaaS model, these costs would be covered by subscription fees or usage-based pricing

---

## Testing the Application

Let's verify that everything is working correctly:

### Test 1: Basic Interface
- Can you see the 3D viewer with a sample molecule?
- Does the sidebar show projects?
- Does the command palette open with Cmd/K?

### Test 2: Cheminformatics (RDKit)
- Use the command palette to calculate molecular descriptors for "CCO"
- Verify you get reasonable values (MW ≈ 46.07 g/mol for ethanol)

### Test 3: Docking (AutoDock Vina)
*Note: This requires AutoDock Vina to be installed locally for full testing*
- Try submitting a docking job through the interface
- You should see the job progress through stages
- If Vina isn't installed, you'll get a helpful error message guiding you on installation

### Test 4: WebSocket Real-time Updates
- Open the browser developer tools (F12)
- Go to the Network tab → WS (WebSocket) filter
- Perform an action that triggers backend processing
- You should see messages flowing through the WebSocket connection

---

## Transitioning to SaaS

Now that you understand how Dynacule works locally, let's discuss how to make it available as a live SaaS application.

### The Good News
Most of the hard work is already done! The architecture we've built locally is designed to scale to a production SaaS environment with minimal changes.

### What Needs to Change for SaaS

#### 1. **Domain and Hosting**
- Instead of `localhost:3000`, you'll need a real domain (e.g., `app.dynacule.com`)
- You'll need to host the frontend on a service like Vercel, Netlify, or AWS Amplify
- The backend will need to be deployed to a cloud provider (AWS, GCP, Azure) or a VPS

#### 2. **Database**
- Local development uses Docker volumes for data
- For SaaS, you'll need a managed PostgreSQL database:
  - AWS RDS
  - Google Cloud SQL
  - Supabase
  - Or self-hosted on a managed VPS

#### 3. **Redis**
- Local: Docker container
- SaaS: Managed Redis service (AWS ElastiCache, Redis Cloud, etc.) or self-hosted

#### 4. **Authentication**
- Currently, we have basic project-based access
- For SaaS, you'll need proper user authentication:
  - Email/password
  - Social login (Google, GitHub)
  - Subscription tier management
  - We've designed the backend to be auth-ready - you'll need to integrate an auth provider

#### 5. **Modal.com Production Setup**
- Local: Uses Modal.com development account
- SaaS: You'll need a paid Modal.com account with:
  - Private containers for your proprietary software
  - Sufficient GPU credits allocated
  - Proper secrets management for API keys

#### 6. **Environment Variables and Secrets**
- Local: `.env` file
- SaaS: Use your hosting platform's secret management:
  - Vercel Environment Variables
  - AWS Secrets Manager / Parameter Store
  - GCP Secret Manager
  - HashiCorp Vault

#### 7. **Monitoring and Logging**
- Add error tracking (Sentry, LogRocket)
- Add performance monitoring
- Set up log aggregation (ELK stack, Datadog, etc.)
- Implement health checks and uptime monitoring

#### 8. **Scaling Considerations**
- Use a process manager like PM2 for Node.js (frontend)
- Consider Kubernetes for container orchestration if you expect high scale
- Use CDN for frontend assets (Cloudflare, AWS CloudFront)
- Implement caching strategies (Redis for caching, not just queuing)

### Step-by-Step SaaS Deployment Guide

Here's a simplified roadmap for transitioning to SaaS:

#### Phase 1: Preparation
1. Choose a domain name and register it
2. Set up accounts with:
   - Cloud provider (AWS, GCP, Azure)
   - Modal.com (upgrade to paid plan if needed)
   - Database provider (if not using same cloud provider)
   - Email service (for transactional emails - SendGrid, Mailgun, etc.)
   - Error tracking service (Sentry)

#### Phase 2: Infrastructure Setup
1. Provision a managed PostgreSQL database
2. Provision a managed Redis instance
3. Set up your cloud provider account for container deployment
4. Configure DNS to point your domain to your hosting services

#### Phase 3: Backend Deployment
1. Create a production Docker image for the backend:
   ```bash
   # In the backend directory
   docker build -t dynacule-backend:prod .
   ```
2. Push the image to a container registry (AWS ECR, GCR, Docker Hub)
3. Deploy to your chosen platform:
   - Option A: AWS ECS/Fargate
   - Option B: Google Cloud Run
   - Option C: Azure Container Instances
   - Option D: Traditional VM with Docker
4. Set environment variables in your deployment platform
5. Ensure the backend can connect to your database and Redis

#### Phase 4: Frontend Deployment
1. Build the frontend for production:
   ```bash
   # In the frontend directory
   npm run build
   ```
2. Deploy to a static hosting service:
   - Vercel (recommended for Next.js)
   - Netlify
   - AWS Amplify
   - Or serve from your backend server (less ideal for scalability)
3. Configure environment variables for the frontend (API URL, etc.)

#### Phase 5: Testing and Optimization
1. Test all endpoints with your production database
2. Verify WebSocket connections work through any proxies/load balancers
3. Test Modal.com integration with real GPU jobs
4. Optimize based on performance testing
5. Set up automated backups for your database
6. Implement SSL/TLS certificates (Let's Encrypt is free and easy)

#### Phase 6: Launch!
1. Announce your SaaS to your target audience
2. Monitor closely for the first few days/weeks
3. Gather user feedback and iterate
4. Consider implementing usage-based billing or subscription tiers

---

## Next Steps

Congratulations! You now understand how Dynacule works and how to transition it to a SaaS product. Here are some recommended next steps:

### For Beginners
1. **Explore the Code**: Take time to read through the codebase, especially:
   - `backend/app/main.py` - See how everything is wired together
   - `frontend/src/lib/store.ts` - Understand the state management
   - `backend/app/utils/` - See how the scientific pipelines work

2. **Run Experiments**: Try different molecular inputs and see how the tools behave
   - Try docking different ligands to a protein
   - Run short MD simulations on small systems
   - Calculate energies for different molecules with QM

3. **Learn the Technologies**: Each component is a valuable skill to learn:
   - Docker and containerization
   - Next.js and React
   - FastAPI and Python async programming
   - Celery and distributed task queues
   - WebSockets for real-time communication
   - Cloud GPU computing with Modal.com

### For Aspiring SaaS Founders
1. **Study Successful Scientific SaaS**: Look at platforms like:
   - Benchling (life sciences R&D)
   - Schrödinger (drug discovery suite)
   - CDD Vault (chemistry data management)
   - LabArchives (electronic lab notebooks)

2. **Understand Pricing Models**: Scientific SaaS often uses:
   - Seat-based subscription (per user/month)
   - Usage-based pricing (per compute hour)
   - Tiered plans (free, professional, enterprise)
   - Add-on modules for specialized tools

3. **Consider Compliance**: If handling sensitive data, you may need:
   - GDPR/CCPA compliance for data protection
   - SOC 2 certification for security
   - HIPAA compliance for health-related data
   - 21 CFR Part 11 for electronic records in pharmaceuticals

4. **Plan Your Go-to-Market Strategy**:
   - Identify your target users (academic labs, pharma companies, biotech startups)
   - Develop a content marketing strategy (blogs, webinars, tutorials)
   - Consider offering free tiers or academic discounts
   - Build partnerships with scientific organizations

### Need Help?
If you get stuck, remember:
- The code is your best documentation - read it!
- Each major component has explanatory comments
- The skills we've created (SKILL_*.md files) provide detailed implementation guides
- Don't hesitate to ask questions in the community or consult the technology documentation

Happy computing, and welcome to the world of scientific SaaS!

--- 

*This guide was last updated: $(date)*  
*For the most current information, please refer to the repository README and documentation.*