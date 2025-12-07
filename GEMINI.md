# Grocery Price Comparison WebApp

## Project Overview

This project is a modern full-stack web application designed for comparing grocery prices across major Australian supermarkets: **IGA, Woolworths, and Coles**. It features real-time price scraping, advanced search capabilities (hybrid vector + keyword search), and a responsive UI.

### Architecture

The application follows a client-server architecture:

*   **Frontend:** Built with **Next.js 14 (App Router)**, **TypeScript**, and **Tailwind CSS**. It provides a responsive interface for browsing products, filtering by store/category/brand, and managing a shopping cart.
*   **Backend:** A **FastAPI** (Python) application that serves a RESTful API. It handles database operations, web scraping (via Playwright), and search logic.
*   **Database:** **SQLite** (`backend/data/grocery_prices.db`) stores product data, prices, and scrape history.
*   **Search Engine:** Implements a hybrid search system using **Pinecone** (vector search) and **BM25** (keyword search), with a fallback to standard SQL `LIKE` queries if the vector service is unavailable.

## Directory Structure

```
WebApp/
├── backend/                 # FastAPI Backend
│   ├── app/
│   │   ├── api/             # API Route Handlers (products, scraping, cart)
│   │   ├── services/        # Business Logic (vector search, scraper)
│   │   ├── models.py        # SQLAlchemy Database Models
│   │   ├── schemas.py       # Pydantic Response/Request Models
│   │   └── main.py          # Application Entry Point
│   ├── data/                # Database and CSV Data Sources
│   ├── requirements.txt     # Python Dependencies
│   └── migrate_vector_fast.py # Script for populating the vector index
│
├── frontend/                # Next.js Frontend
│   ├── src/
│   │   ├── app/             # App Router Pages & Layouts
│   │   ├── components/      # Reusable React Components
│   │   ├── hooks/           # Custom React Hooks
│   │   └── lib/             # API Client & Utilities
│   ├── package.json         # Node.js Dependencies & Scripts
│   └── next.config.js       # Next.js Configuration
│
└── README.md                # General Project Documentation
```

## Setup & Development

### 1. Backend Setup

The backend requires Python 3.11+.

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers (for scraping)
playwright install

# Run the server (runs on http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

**Key Backend Commands:**
*   **Start Server:** `uvicorn app.main:app --reload`
*   **API Docs:** Visit `http://localhost:8000/docs`
*   **Populate Vector Index:** `python migrate_vector_fast.py` (requires Pinecone API key)

### 2. Frontend Setup

The frontend requires Node.js 18+.

```bash
cd frontend

# Install dependencies
npm install

# Run development server (runs on http://localhost:3000)
npm run dev
```

**Key Frontend Commands:**
*   **Dev Server:** `npm run dev`
*   **Build:** `npm run build`
*   **Lint:** `npm run lint`

## Development Conventions

*   **Styling:** Use Tailwind CSS for all styling. No custom CSS files unless absolutely necessary (use `globals.css` sparingly).
*   **State Management:** Use React Hooks and Context for local state. The URL is used as the source of truth for search and filter state.
*   **API Interaction:** All API calls should go through `frontend/src/lib/api.ts` using the typed `apiClient`.
*   **Backend Typing:** Use Pydantic models (`schemas.py`) for request/response validation. Ensure database models (`models.py`) match the schema.
*   **Search Logic:** The `VectorSearchService` in the backend handles the complexity of hybrid search. Ensure environment variables for Pinecone are set if working on search features.

## Key Features & Files

*   **Live Scraping:** `backend/app/services/scraper_service.py` handles the Playwright logic to fetch real-time prices.
*   **Vector Search:** `backend/app/services/vector_search_service.py` manages the Pinecone connection and embedding generation.
*   **Database Models:** `backend/app/models.py` defines the `Product` table and relationships.
*   **Frontend Components:** `ProductCard.tsx` and `ProductGrid.tsx` are the core display components. `FilterSidebar.tsx` handles the faceting logic.
