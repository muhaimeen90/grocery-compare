# Grocery Price Comparison Backend

FastAPI backend for the grocery price comparison application.

## Features

- RESTful API for product browsing and filtering
- Asynchronous live price scraping with Playwright
- SQLite database with SQLAlchemy ORM
- Automatic database updates when prices are scraped
- Background task processing for concurrent scraping

## Setup

### Prerequisites

- Python 3.11+
- pip

### Installation

1. Create and activate virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Install Playwright browsers:

```bash
playwright install
```

4. Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

5. Run CSV migration (one-time setup):

```bash
python migrate_csv.py
```

This will create the SQLite database and import all CSV data from the `week 2` folder.

### Running the Server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Products

- `GET /api/products` - List products with pagination and filters
  - Query params: `store`, `category`, `search`, `brand`, `sort`, `page`, `limit`
- `GET /api/products/{id}` - Get single product
- `GET /api/products/stores/list` - List all stores
- `GET /api/products/categories/list` - List categories with counts
- `GET /api/products/brands/list` - List brands

### Scraping

- `POST /api/scrape` - Scrape single product price
  - Body: `{ "product_id": 123 }`
  - Returns: `{ "task_id": "...", "status": "pending" }`
- `GET /api/scrape/{task_id}` - Get scrape task status
- `POST /api/scrape/batch` - Scrape multiple products
  - Body: `{ "product_ids": [1, 2, 3] }`

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Configuration
│   ├── database.py          # Database setup
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── api/
│   │   ├── products.py      # Product endpoints
│   │   └── scraping.py      # Scraping endpoints
│   ├── services/
│   │   └── scraper_service.py  # Scraper integration
│   └── utils/
│       ├── csv_importer.py  # CSV migration
│       └── price_parser.py  # Price utilities
├── data/
│   └── grocery_prices.db    # SQLite database
├── migrate_csv.py           # Migration script
├── requirements.txt
└── README.md
```

## Database Schema

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    price_numeric REAL,
    brand TEXT,
    category TEXT NOT NULL,
    store TEXT NOT NULL,
    product_url TEXT,
    image_url TEXT,
    last_scraped DATETIME,
    created_at DATETIME,
    updated_at DATETIME
);
```

## Development

### Adding New Endpoints

1. Create route in `app/api/`
2. Add router to `app/main.py`
3. Test with interactive docs at `/docs`

### Database Changes

If you modify models:

```bash
# Drop and recreate (development only)
rm data/grocery_prices.db
python migrate_csv.py
```

## Notes

- Price scraping updates the database automatically
- Background tasks run asynchronously
- Task results stored in memory (use Redis in production)
- Supports up to 10 concurrent scrapes per batch
