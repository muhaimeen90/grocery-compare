
# 🚀 Quick Start Guide

## Complete Setup Instructions

### Prerequisites

Ensure you have:
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)

Verify installations:
```bash
python3 --version  # Should be 3.11 or higher
node --version     # Should be v18 or higher
npm --version      # Comes with Node.js
```

---

## Option 1: Automated Setup (Recommended)

### Step 1: Run Setup Script

```bash
cd /home/muhaimeen/Personal/Sysnolodge/WebApp
./setup.sh
```

This script will:
1. ✅ Check Python and Node.js versions
2. ✅ Create Python virtual environment
3. ✅ Install all backend dependencies
4. ✅ Install Playwright browsers
5. ✅ Install all frontend dependencies
6. ✅ Migrate CSV data to SQLite database
7. ✅ Create configuration files

**Time:** ~5-10 minutes (depending on internet speed)

### Step 2: Start the Application

**Option A: Single Command (Two Terminals)**

Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

**Option B: Start Script (Background)**

```bash
./start.sh
```

Press `Ctrl+C` to stop both servers.

### Step 3: Open Application

- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs

---

## Option 2: Manual Setup

### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Create virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Install Playwright browsers:**
```bash
playwright install
```

5. **Create environment file:**
```bash
cp .env.example .env
```
6. **Run database migration:**
```bash
python migrate_csv.py
```

This will:
- Create `data/grocery_prices.db`
- Import all CSV files from `week 2/` folder
- Should import 15,000+ products

7. **Start backend server:**
```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

This will install:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Axios
- Lucide Icons

3. **Create environment file:**
```bash
cp .env.example .env.local
```

4. **Start development server:**
```bash
npm run dev
```

---

## Testing the Setup

### Option 1: Manual Testing

1. Open http://localhost:3000
2. Click on a store (IGA, Woolworths, or Coles)
3. Select a category
4. Browse products
5. Try searching for a product
6. Click "Update Price" on any product

### Option 2: Automated Testing

```bash
python test_api.py
```

This will test:
- ✅ Health endpoint
- ✅ Stores list
- ✅ Categories list
- ✅ Products pagination
- ✅ Single product fetch

Expected output:
```
🧪 Testing Grocery Price Comparison API
==================================================

1️⃣  Testing health endpoint...
✅ Health check: {'status': 'healthy'}

2️⃣  Testing stores endpoint...
✅ Found 3 stores: ['IGA', 'Woolworths', 'Coles']

3️⃣  Testing categories endpoint...
✅ Found 45 categories

4️⃣  Testing products endpoint...
✅ Found 15234 total products
   Retrieved 5 products (page 1)

5️⃣  Testing single product endpoint (ID: 1)...
✅ Product: Coca-Cola Classic Soft Drink Bottle 2L
   Price: $4.20
   Store: Coles

==================================================
🎉 All tests passed!
```

---

## Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

---

**Problem:** `playwright._impl._errors.Error: Executable doesn't exist`

**Solution:**
```bash
playwright install
```

---

**Problem:** `Database file not found`

**Solution:**
- Ensure `backend/data/grocery_prices.db` exists (pull latest repository or request the seeded snapshot if missing)

---

**Problem:** Port 8000 already in use

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000
# Kill process
kill -9 <PID>
# Or use different port
uvicorn app.main:app --reload --port 8001
```

---

### Frontend Issues

**Problem:** `Cannot find module 'next'`

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

**Problem:** `Module not found: Can't resolve '@/lib/api'`

**Solution:**
This is normal before packages are installed. Run:
```bash
npm install
```

---

**Problem:** Port 3000 already in use

**Solution:**
```bash
# Next.js will automatically offer port 3001
# Or kill existing process
lsof -i :3000
kill -9 <PID>
```

---

**Problem:** API connection failed

**Solution:**
1. Ensure backend is running on port 8000
2. Check `.env.local` has correct API URL
3. Check browser console for CORS errors
4. Verify `next.config.js` rewrites are correct

---

### Database Issues

**Problem:** No products showing up

**Solution:**
- Confirm `backend/data/grocery_prices.db` exists and contains data (check file size > 0)

---

**Problem:** Migration fails with "CSV files not found"

**Solution:**
Ensure `week 2/` folder exists with CSV files:
```bash
ls -la "../week 2/"
```

---

### Common Errors

**Error:** `EADDRINUSE: address already in use`
- Port is already occupied
- Use different port or kill existing process

**Error:** `ModuleNotFoundError`
- Dependencies not installed
- Activate venv and run pip install

**Error:** `Cannot GET /api/products`
- Backend not running
- Check backend is on port 8000

---

## Verifying Installation

### Backend Checklist

- [ ] Virtual environment activated
- [ ] All dependencies installed (`pip list`)
- [ ] Playwright browsers installed
- [ ] Database file exists (`ls data/grocery_prices.db`)
- [ ] Server running on http://localhost:8000
- [ ] Can access http://localhost:8000/docs

### Frontend Checklist

- [ ] Node modules installed (`ls node_modules/`)
- [ ] Can run `npm run dev` without errors
- [ ] Server running on http://localhost:3000
- [ ] Homepage loads with 3 store cards
- [ ] Can navigate to stores and categories

---

## Next Steps

Once everything is running:

1. **Browse Products**
   - Go to http://localhost:3000
   - Click on IGA, Woolworths, or Coles
   - Explore different categories

2. **Test Search**
   - Use search bar to find products
   - Try filtering by brand
   - Sort by price

3. **Test Live Scraping**
   - Click "Update Price" on any product
   - Watch loading state
   - See updated price

4. **Explore API**
   - Go to http://localhost:8000/docs
   - Try different endpoints
   - Test filters and pagination

---

## Production Deployment

### Backend

```bash
cd backend
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend

```bash
cd frontend
npm run build
npm start
```

Or deploy to Vercel:
```bash
npm install -g vercel
vercel
```

---

## Need Help?

1. **Check logs:**
   - Backend: Terminal running uvicorn
   - Frontend: Terminal running npm dev
   - Browser: DevTools Console (F12)

2. **Check documentation:**
   - Main README: `/home/muhaimeen/Personal/Sysnolodge/WebApp/README.md`
   - Backend README: `backend/README.md`
   - Frontend README: `frontend/README.md`

3. **API Documentation:**
   - Interactive: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

4. **Common commands:**
   ```bash
   # Restart backend
   cd backend && source venv/bin/activate && uvicorn app.main:app --reload
   
   # Restart frontend
   cd frontend && npm run dev
   
   # Check database
   sqlite3 backend/data/grocery_prices.db "SELECT COUNT(*) FROM products;"
   
   # Test API
   python test_api.py
   ```

---

## Summary

You should now have:
- ✅ Backend API running on port 8000
- ✅ Frontend app running on port 3000
- ✅ Database populated with 15,000+ products
- ✅ Live price scraping functional
- ✅ Modern, responsive UI

**Enjoy comparing grocery prices! 🛒🎉**
