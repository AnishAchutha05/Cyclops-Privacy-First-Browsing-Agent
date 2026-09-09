"""
Cyclops — Privacy-First Browsing Agent
FastAPI application entry point.

Business logic lives in api/, agent/, and providers/.
This file only wires things together.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agent, health, providers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)

app = FastAPI(
    title="Cyclops Backend",
    description=(
        "Remote reasoning layer for the Cyclops Privacy-First Browsing Agent. "
        "Receives sanitized browser context, invokes the selected LLM provider, "
        "and returns a structured action plan."
    ),
    version="0.1.0",
)

# Allow the browser extension to reach the backend.
# chrome-extension:// origins are scheme-based; CORS middleware handles them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Restrict in production if needed
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(providers.router)
app.include_router(agent.router)
