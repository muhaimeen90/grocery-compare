# Quick Reference Card

## 🚀 Quick Commands

### First Time Setup
```bash
cd /home/muhaimeen/Personal/Sysnolodge/WebApp
./setup.sh
```

### Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Start Frontend
```bash
cd frontend
npm run dev
```

### Test Everything
```bash
python test_api.py
```

---

## 🔗 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main application |
| **API** | http://localhost:8000 | Backend API |
| **API Docs** | http://localhost:8000/docs | Interactive API documentation |
| **ReDoc** | http://localhost:8000/redoc | Alternative API docs |

---

## 📁 Key Files

### Backend
- `backend/app/main.py` - FastAPI application entry point
- `backend/app/api/products.py` - Product endpoints
- `backend/app/api/scraping.py` - Scraping endpoints
- `backend/migrate_csv.py` - Database migration script
- `backend/requirements.txt` - Python dependencies

### Frontend
- `frontend/src/app/page.tsx` - Homepage
- `frontend/src/components/ProductCard.tsx` - Product display
- `frontend/src/lib/api.ts` - API client
- `frontend/package.json` - Node.js dependencies

### Documentation
- `README.md` - Main documentation
- `SETUP_GUIDE.md` - Installation instructions
- `MIGRATION_COMPARISON.md` - Feature comparison
- `PROJECT_SUMMARY.md` - Complete overview

---

## 🛠️ Common Tasks

### Restart Database
```bash
cd backend
rm data/grocery_prices.db
python migrate_csv.py
```

### Update Dependencies

**Backend:**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### Check Database Stats
```bash
sqlite3 backend/data/grocery_prices.db "
  SELECT 
    store,
    COUNT(*) as products
  FROM products
  GROUP BY store;
"
```

### View Logs

**Backend:**
- Check terminal running uvicorn

**Frontend:**
- Check terminal running npm dev
- Check browser console (F12)

---

## 🐛 Troubleshooting

### Backend won't start
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
playwright install
```

### Frontend won't start
```bash
cd frontend
rm -rf node_modules .next
npm install
```

### No products showing
```bash
cd backend
python migrate_csv.py
```

### Port already in use
```bash
# Find process
lsof -i :8000  # or :3000
# Kill it
kill -9 <PID>
```

---

## 📊 API Quick Reference

### Get Products
```bash
curl "http://localhost:8000/api/products?store=IGA&category=Drinks&limit=10"
```

### Get Stores
```bash
curl "http://localhost:8000/api/products/stores/list"
```

### Get Categories
```bash
curl "http://localhost:8000/api/products/categories/list?store=IGA"
```

### Scrape Price
```bash
curl -X POST "http://localhost:8000/api/scrape" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1}'
```

### Check Scrape Status
```bash
curl "http://localhost:8000/api/scrape/{task_id}"
```

---

## 🎨 UI Navigation

```
Homepage (/)
    │
    ├─→ IGA (/store/IGA)
    │       ├─→ Drinks (/store/IGA/Drinks)
    │       ├─→ Pantry (/store/IGA/Pantry)
    │       └─→ ...
    │
    ├─→ Woolworths (/store/Woolworths)
    │       ├─→ Drinks (/store/Woolworths/Drinks)
    │       └─→ ...
    │
    └─→ Coles (/store/Coles)
            ├─→ Drinks (/store/Coles/Drinks)
            └─→ ...
```

---

## ⌨️ Keyboard Shortcuts

**Browser:**
- `F12` - Open Developer Tools
- `Ctrl+R` - Refresh page
- `Ctrl+Shift+R` - Hard refresh

**Terminal:**
- `Ctrl+C` - Stop server
- `Ctrl+Z` - Pause process
- `Ctrl+L` - Clear terminal

---

## 📦 Tech Stack Summary

### Backend
- FastAPI (Python web framework)
- SQLAlchemy (Database ORM)
- SQLite (Database)
- Playwright (Web scraping)
- Pydantic (Validation)

### Frontend
- Next.js 14 (React framework)
- TypeScript (Type safety)
- Tailwind CSS (Styling)
- Axios (HTTP client)

---

## ✅ Verification Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Can access http://localhost:3000
- [ ] Can see 3 store cards on homepage
- [ ] Can click into a store
- [ ] Can see categories
- [ ] Can see products
- [ ] Search works
- [ ] Filters work
- [ ] Pagination works
- [ ] "Update Price" button works
- [ ] API docs accessible at /docs

---

## 🎯 Feature Matrix

| Feature | Status | Location |
|---------|--------|----------|
| Store browsing | ✅ | Homepage |
| Category listing | ✅ | Store pages |
| Product display | ✅ | Category pages |
| Search | ✅ | Top of category pages |
| Brand filter | ✅ | Sidebar |
| Price sort | ✅ | Sidebar |
| Pagination | ✅ | Bottom of products |
| Live scraping | ✅ | Product cards |
| Price persistence | ✅ | Database |
| Mobile responsive | ✅ | All pages |

---

## 🔄 Development Workflow

1. **Make Changes**
   - Edit files in `backend/` or `frontend/`

2. **Backend Changes**
   - Changes auto-reload (--reload flag)
   - Check terminal for errors

3. **Frontend Changes**
   - Hot reload automatic
   - Check browser console for errors

4. **Test Changes**
   - Manual: Browse application
   - API: Use /docs or curl
   - Automated: `python test_api.py`

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "Description"
   git push
   ```

---

## 📞 Getting Help

1. **Check logs**
   - Backend: Terminal running uvicorn
   - Frontend: Terminal running npm dev
   - Browser: F12 → Console

2. **Check documentation**
   - SETUP_GUIDE.md
   - API docs: /docs

3. **Common issues**
   - Port in use: Kill process
   - Module not found: Reinstall dependencies
   - Database empty: Run migration

---

## 🎉 Success!

If you can:
- ✅ Open http://localhost:3000
- ✅ See stores on homepage
- ✅ Browse products
- ✅ Update prices

**You're all set!** 🎊

---

**Print this page for quick reference while developing!**
