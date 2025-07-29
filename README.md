# Pinterest AI Content Discovery

A full-stack, AI-powered system that accepts visual prompts, warms up Pinterest accounts, scrapes relevant content, and validates images using AI.

## Overview

End-to-end agentic workflow:
1. Accepts visual prompts (e.g., "boho minimalist bedroom")
2. Warms up Pinterest accounts to align recommendations
3. Scrapes top image results based on the prompt
4. Validates images using AI for alignment with user intent
5. Displays results in a filterable UI with match quality scores

## System Architecture

**Frontend (React + TypeScript)** ↔ **Backend (FastAPI + Python)** ↔ **MongoDB Atlas**
- Pinterest Service: Playwright for web scraping
- AI Validation: OpenAI GPT-4o-mini for image analysis

## AI Model Selection

**OpenAI GPT-4o-mini** - Cost-effective multimodal model ($0.15 vs $30 per 1M tokens compared to GPT-4) with native image analysis capabilities. Provides reliable visual-semantic alignment scoring with explanations for validation decisions.

## Pinterest Warm-up Strategy

**Authentic User Simulation** - Performs 3-5 searches with prompt-related keywords, views pin details, saves pins, and simulates natural browsing patterns. This creates temporary interest signals that align Pinterest's algorithm with the target aesthetic before scraping, improving result quality.

## Setup Instructions

### Prerequisites
- Python 3.9+, Node.js 18+, MongoDB Atlas account, OpenAI API key, Pinterest account

### Installation
```bash
# Clone and setup backend
git clone https://github.com/danielhuf/oleve-assessment.git
cd oleve-assessment
python -m venv venv
source venv/bin/activate
cd backend && pip install -r requirements.txt
playwright install

# Setup frontend
cd ../frontend && npm install

# Create .env file in project root:
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/pinterest_ai
OPENAI_API_KEY=sk-your-openai-api-key
PINTEREST_EMAIL=your@email.com
PINTEREST_PASSWORD=your_password
```

### Run Application
```bash
# Terminal 1: Backend
cd backend && source ../venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm start
```

Access: http://localhost:3000

 