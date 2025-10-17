# Docker Deployment Guide

## Quick Deploy to Render

1. **Commit and push to GitHub:**
   ```bash
   git add backend/Dockerfile backend/.dockerignore backend/render.yaml
   git commit -m "Add Docker configuration for Render deployment"
   git push origin main
   ```

2. **Render will auto-deploy** using the `render.yaml` configuration.

## What's Included

- **Dockerfile**: Uses Microsoft's Playwright Python image (Python 3.11 + Chromium pre-installed)
- **.dockerignore**: Excludes unnecessary files from Docker image
- **render.yaml**: Render deployment configuration

## Local Testing (Optional)

If you have Docker installed:

```bash
cd backend

# Build image
docker build -t grocery-api .

# Run container
docker run -p 8000:8000 -v $(pwd)/data:/app/data grocery-api

# Test API
curl http://localhost:8000/health
curl http://localhost:8000/api/products?limit=5
```

## Environment Variables

The following are set automatically by Render:

- `DATABASE_URL`: sqlite:///./data/grocery_prices.db
- `PORT`: 8000

## Persistent Storage

- Disk mount: `/app/data` (1GB)
- SQLite database stored here

## Build Time

- Expected: 2-3 minutes
- Docker layer caching speeds up subsequent builds

## Troubleshooting

If build fails:
1. Check Render logs
2. Verify `requirements.txt` is compatible with Python 3.11
3. Ensure `app/main.py` exists and has FastAPI app

## No Database Setup Needed

The SQLite database will be created automatically on first run. To populate it:

1. SSH into Render service (via dashboard shell)
2. Run: `python migrate_csv.py`

Or upload your existing database to the disk mount.
