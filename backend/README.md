# Dynacule Backend

This is the backend for the Dynacule molecular modeling platform.

## Features

- FastAPI application with RESTful API endpoints
- WebSocket support for real-time communication
- RDKit integration for cheminformatics tasks
- Celery worker queue with Redis broker for asynchronous job processing
- API routers for molecules, docking, molecular dynamics (MD), and quantum mechanics (QM)
- Configuration management with Pydantic settings
- Modular structure for easy extension

## Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── molecules.py      # Molecule-related endpoints
│   │   ├── docking.py        # Docking-related endpoints
│   │   ├── md.py             # Molecular dynamics endpoints
│   │   ├── qm.py             # Quantum mechanics endpoints
│   │   └── websocket.py      # WebSocket endpoints
│   ├── core/
│   │   ├── config.py         # Application configuration
│   │   └── celery.py         # Celery configuration
│   ├── models/               # Database models (to be implemented)
│   ├── schemas/              # Pydantic schemas (to be implemented)
│   ├── utils/
│   │   └── cheminformatics.py # RDKit utilities
│   └── worker/
│       └── tasks.py          # Celery tasks
├── main.py                   # FastAPI application entry point
└── requirements.txt          # Python dependencies
```

## Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set up environment variables (create a `.env` file):
   ```
   POSTGRES_SERVER=localhost
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=dynacule
   POSTGRES_PORT=5432
   REDIS_HOST=localhost
   REDIS_PORT=6379
   SECRET_KEY=your_secret_key_here
   ```

3. Run the application:
   ```bash
   uvicorn app.main:app --reload
   ```

4. Start Celery worker:
   ```bash
   celery -A app.core.celery.celery_app worker --loglevel=info
   ```

5. Start Redis (if not running):
   ```bash
   redis-server
   ```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## WebSocket Endpoint

Connect to: `ws://localhost:8000/ws/{client_id}`

## Asynchronous Jobs

Tasks are processed by Celery workers. Example tasks include:
- Molecular property calculation
- Docking simulations
- Molecular dynamics simulations
- Quantum mechanics calculations

## License

MIT