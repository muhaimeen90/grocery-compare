# Grocery Price Comparison Application

A modern web application for comparing grocery prices across IGA, Woolworths, and Coles.

## 🎯 Features

- **Multi-Store Comparison:** Browse products from IGA, Woolworths, and Coles
- **Live Price Scraping:** Get real-time prices directly from store websites
- **Advanced Filtering:** Search by name, filter by brand, sort by price
- **Modern UI:** Responsive design with Tailwind CSS
- **Fast Performance:** Next.js 14 with server-side rendering
- **RESTful API:** FastAPI backend with automatic documentation

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Axios
- Lucide Icons

**Backend:**
- FastAPI (Python)
- SQLAlchemy ORM
- SQLite Database
- Playwright (web scraping)
- Pydantic (validation)

## 📁 Project Structure

```
WebApp/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utilities
│   │   ├── models.py       # Database models
│   │   ├── schemas.py      # Pydantic schemas
│   │   └── main.py         # FastAPI app
│   ├── data/               # SQLite database
│   ├── requirements.txt
│   └── README.md
│
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # Pages (App Router)
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities
│   ├── package.json
│   └── README.md
│
└── week 2/                # Original CSV data
    ├── IGA/
    ├── Woolworths/
    ├── Coles/
    └── price_scrapers.py  # Scraping logic
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:

```bash
cd backend
```

2. Create and activate virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
playwright install
```

4. Start the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend will be available at:
- API: http://localhost:8000
- Interactive Docs: http://localhost:8000/docs

### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

Frontend will be available at http://localhost:3000

## 📊 Database

The application uses SQLite with the following schema:

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price TEXT NOT NULL,              -- Raw price (e.g., "$12.99")
    price_numeric REAL,                -- Numeric for sorting
    brand TEXT,
    category TEXT NOT NULL,
    store TEXT NOT NULL,               -- 'IGA', 'Woolworths', 'Coles'
    product_url TEXT,
    image_url TEXT,
    last_scraped DATETIME,             -- Last price update
    created_at DATETIME,
    updated_at DATETIME
);
```

**Initial Data:** ~20,000+ products imported from CSV files

## 🔌 API Endpoints

### Products

```http
GET    /api/products                 # List products (with filters)
GET    /api/products/{id}            # Get single product
GET    /api/products/stores/list     # List all stores
GET    /api/products/categories/list # List categories
GET    /api/products/brands/list     # List brands
```

### Scraping

```http
POST   /api/scrape                   # Scrape single product
GET    /api/scrape/{task_id}         # Get scrape status
POST   /api/scrape/batch             # Scrape multiple products
```

**Example:**

```bash
# Get IGA drinks
curl "http://localhost:8000/api/products?store=IGA&category=Drinks&limit=10"

# Scrape live price
curl -X POST "http://localhost:8000/api/scrape" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 123}'
```

## 🎨 UI Features

### Homepage
- Store selection cards
- Feature highlights
- Modern gradient hero section

### Store Pages
- Category listing with product counts
- Responsive grid layout

### Product Pages
- Advanced search bar
- Brand filtering
- Price sorting (Low-High, High-Low, Name)
- Pagination (30 products per page)
- Live price update buttons
- Product images with fallbacks
- Store badges

### Product Cards
- High-quality product images
- Brand and category info
- Live price with last update time
- "Update Price" button with loading states
- External link to store website

## ⚡ Live Price Scraping

The application uses Playwright to scrape live prices from store websites:

1. User clicks "Update Price" button
2. Backend creates background task
3. Playwright scrapes store website
4. Price is extracted and validated
5. Database is updated with new price
6. Frontend polls for status updates
7. UI shows success/error message

**Supported Stores:**
- ✅ IGA (fully implemented)
- ⏳ Woolworths (planned)
- ⏳ Coles (planned)

## 🛠️ Development

### Adding New Features

**Backend:**
1. Add endpoint in `backend/app/api/`
2. Add business logic in `backend/app/services/`
3. Update schemas in `backend/app/schemas.py`
4. Test with `/docs`

**Frontend:**
1. Create component in `src/components/`
2. Add page in `src/app/`
3. Update types in `src/lib/types.ts`
4. Style with Tailwind CSS

### Code Style

**Backend:**
- Python 3.11+ syntax
- Type hints (Pydantic, typing)
- Docstrings for functions
- PEP 8 formatting

**Frontend:**
- TypeScript strict mode
- Functional components
- Tailwind CSS (no custom CSS)
- ESLint rules

## 📝 Migration from Streamlit

This application replaces the original Streamlit app (`week 2/streamlit_app.py`) with:

**Improvements:**
- ✅ Faster performance (Next.js SSR)
- ✅ Better UX (modern React components)
- ✅ Persistent database (SQLite vs CSV)
- ✅ RESTful API (can be used by mobile apps)
- ✅ Scalable architecture (separate frontend/backend)
- ✅ Auto-updating prices (database persistence)

**Feature Parity:**
- ✅ All stores (IGA, Woolworths, Coles)
- ✅ All categories
- ✅ Search and filtering
- ✅ Price sorting
- ✅ Live price scraping
- ✅ Pagination (30 per page)
- ✅ Product images
- ✅ Raw price display

## 🔧 Configuration

### Backend (`.env`)

```env
DATABASE_URL=sqlite:///./data/grocery_prices.db
CORS_ORIGINS=http://localhost:3000
MAX_CONCURRENT_SCRAPES=5
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🐛 Troubleshooting

### Backend won't start
- Check Python version: `python --version` (must be 3.11+)
- Install Playwright browsers: `playwright install`
- Check port 8000 is available

### Frontend won't start
- Check Node version: `node --version` (must be 18+)
- Clear cache: `rm -rf .next node_modules && npm install`
- Check port 3000 is available

### CORS errors
- Add frontend URL to backend `config.py` CORS_ORIGINS
- Restart backend server

## 📚 Documentation

- **Backend API:** http://localhost:8000/docs (Swagger UI)
- **Backend Code:** See `backend/README.md`
- **Frontend Code:** See `frontend/README.md`

## 🚧 Future Enhancements

- [ ] Add Woolworths and Coles scraper implementations
- [ ] Price history tracking and charts
- [ ] Product comparison mode
- [ ] Shopping list feature
- [ ] User authentication (optional)
- [ ] Mobile app (React Native)
- [ ] Redis caching for scraping tasks
- [ ] Celery for distributed scraping
- [ ] PostgreSQL for production
- [ ] Docker deployment

## 📄 License

MIT

## 👥 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 🎉 Acknowledgments

- Original Streamlit app in `week 2/`
- Store websites for product data
- Open source libraries and frameworks
