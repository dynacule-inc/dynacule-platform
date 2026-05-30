#!/bin/bash
# Dynacule Onboarding Setup Script
# This script sets up the Dynacule project for local development and SaaS transition preparation.

set -e  # Exit on any error

echo "============================================================"
echo "🚀 Dynacule Onboarding Setup"
echo "============================================================"
echo "This script will:"
echo "  1. Check prerequisites"
echo "  2. Set up backend (FastAPI)"
echo "  3. Set up frontend (Next.js)"
echo "  4. Configure environment variables"
echo "  5. Start required services (PostgreSQL, Redis)"
echo "  6. Provide instructions for running the application"
echo ""
echo "⚠️  Prerequisites: Python 3.12+, Node.js 18+, Docker & Docker Compose"
echo ""

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
  echo "❌ Please do not run this script as root/sudo"
  exit 1
fi

# Function to check prerequisites
check_prerequisites() {
  echo "🔍 Checking prerequisites..."
  
  # Check Python version
  if ! command -v python3.12 &> /dev/null; then
    echo "❌ Python 3.12 is required but not found."
    echo "   Please install Python 3.12 (e.g., via pyenv or official installer)"
    exit 1
  fi
  
  # Check Node.js
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not found."
    echo "   Please install Node.js >=18 (https://nodejs.org)"
    exit 1
  fi
  
  # Check npm
  if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not found."
    exit 1
  fi
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not found."
    echo "   Please install Docker Desktop (https://www.docker.com/products/docker-desktop)"
    exit 1
  fi
  
  # Check Docker Compose
  if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is required but not found."
    echo "   Docker Compose v2 should be included with Docker Desktop"
    exit 1
  fi
  
  echo "✅ All prerequisites satisfied"
}

# Function to set up backend
setup_backend() {
  echo ""
  echo "🔧 Setting up backend (FastAPI)..."
  cd backend
  
  # Create virtual environment if not exists
  if [ ! -d "venv" ]; then
    echo "   Creating Python virtual environment..."
    python3.12 -m venv venv
  fi
  
  # Activate virtual environment
  source venv/bin/activate
  
  # Upgrade pip and install dependencies
  echo "   Installing Python dependencies..."
  pip install --upgrade pip
  
  # Install from requirements.txt if exists, otherwise try pyproject.toml
  if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
  elif [ -f "pyproject.toml" ]; then
    pip install .
  else
    echo "   ⚠️  No requirements.txt or pyproject.toml found. Trying to install known dependencies..."
    # Install core dependencies based on project needs
    pip install fastapi uvicorn[standard] sqlalchemy psycopg2-binary alembic pytest python-dotenv pydantic[email] redis celery[redis] modal-client
  fi
  
  # Deactivate virtual environment (we'll activate when running)
  deactivate
  echo "   ✅ Backend setup complete"
  cd ..
}

# Function to set up frontend
setup_frontend() {
  echo ""
  echo "🎨 Setting up frontend (Next.js)..."
  cd frontend
  
  # Install Node.js dependencies
  echo "   Installing npm dependencies..."
  npm ci || npm install
  
  echo "   ✅ Frontend setup complete"
  cd ..
}

# Function to set up environment variables
setup_env() {
  echo ""
  echo "🔐 Setting up environment variables..."
  
  # Check for .env.example
  if [ -f ".env.example" ]; then
    if [ ! -f ".env" ]; then
      echo "   Creating .env from .env.example..."
      cp .env.example .env
      echo "   ⚠️  Please edit .env to add your actual API keys and credentials"
    else
      echo "   .env already exists, skipping creation"
    fi
  else
    # Create a basic .env file if .env.example doesn't exist
    if [ ! -f ".env" ]; then
      echo "   Creating basic .env file..."
      cat > .env << EOF
# Dynacule Environment Variables
# =============================

# Application
ENVIRONMENT=development
DEBUG=True
SECRET_KEY=your-super-secret-key-change-in-production

# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=dynacule
POSTGRES_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Modal.com (for GPU offloading)
MODAL_API_TOKEN=your-modal-api-token-here
MODAL_API_SECRET=your-modal-api-secret-here

# OpenRouter (for AI chat companion)
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
EOF
      echo "   ⚠️  Please edit .env to add your actual API keys and credentials"
    else
      echo "   .env already exists, skipping creation"
    fi
  fi
  
  echo "   ✅ Environment variables configured"
}

# Function to start required services
start_services() {
  echo ""
  echo "🐳 Starting required services (PostgreSQL, Redis)..."
  
  # Check if docker-compose.yml exists
  if [ -f "docker-compose.yml" ]; then
    echo "   Starting services with docker-compose..."
    docker compose up -d postgres redis
    
    # Wait for services to be ready
    echo "   Waiting for services to be healthy..."
    sleep 10
    
    # Check if services are running
    if docker compose ps postgres redis | grep -q "Up"; then
      echo "   ✅ Services started successfully"
    else
      echo "   ⚠️  Services may not be fully ready. Check with: docker compose ps"
    fi
  else
    echo "   ⚠️  docker-compose.yml not found. Please ensure PostgreSQL and Redis are running:"
    echo "      - PostgreSQL: localhost:5432 (user: postgres, password: postgres, db: dynacule)"
    echo "      - Redis: localhost:6379"
  fi
  
  echo ""
}

# Function to provide final instructions
final_instructions() {
  echo ""
  echo "============================================================"
  echo "🎉 Setup Complete!"
  echo "============================================================"
  echo ""
  echo "Next Steps:"
  echo ""
  echo "1. Configure your .env file:"
  echo "   - Add your Modal.com API credentials (required for GPU offloading)"
  echo "   - Add your OpenRouter API key (for AI chat companion)"
  echo "   - Adjust database credentials if needed"
  echo ""
  echo "2. Start the services in separate terminals:"
  echo ""
  echo "   Terminal 1 - Backend:"
  echo "     cd backend"
  echo "     source venv/bin/activate"
  echo "     uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
  echo ""
  echo "   Terminal 2 - Frontend:"
  echo "     cd frontend"
  echo "     npm run dev"
  echo ""
  echo "   Terminal 3 - Celery Worker (for background tasks):"
  echo "     cd backend"
  echo "     source venv/bin/activate"
  echo "     celery -A worker.celery_app worker --loglevel=info"
  echo ""
  echo "3. Access the application:"
  echo "   - Frontend: http://localhost:3000"
  echo "   - Backend API: http://localhost:8000"
  echo "   - API Docs: http://localhost:8000/docs"
  echo ""
  echo "4. For SaaS transition preparation:"
  echo "   - Review BEGINNER_SAAS_GUIDE.md for deployment instructions"
  echo "   - See MASTER_DYNACULE_DEPLOY.md for production deployment steps"
  echo "   - Update docker-compose.yml for production (remove dev flags, add TLS, etc.)"
  echo ""
  echo "📚 Documentation:"
  echo "   - BEGINNER_SAAS_GUIDE.md: Jargon-free guide for beginners"
  echo "   - KANBAN.md: Project tracking board"
  echo "   - SKILL_*_SETUP.md: Technical setup guides for computational pipelines"
  echo ""
  echo "💡 Tips:"
  echo "   - Heavy computations (Vina, OpenMM, QM) run via Modal.com GPU offloading"
  echo "   - Real-time updates use WebSocket via Redis Pub/Sub"
  echo "   - Molecular visualization uses NGL Viewer with bidirectional binding"
  echo ""
  echo "============================================================"
}

# Main execution
main() {
  check_prerequisites
  setup_backend
  setup_frontend
  setup_env
  start_services
  final_instructions
}

# Run main function
main "$@"