FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Use browsers bundled with the Playwright base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install Python dependencies (Playwright already provided by base image)
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Manually install Playwright Python package without triggering postinstall scripts
RUN pip download --no-deps playwright==1.40.0 && \
    python - <<'PY'
import sys
from pathlib import Path
import zipfile
import shutil

wheel_path = next(Path('.').glob('playwright-*.whl'))
extract_dir = Path('/tmp/playwright')
extract_dir.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(wheel_path) as zf:
    zf.extractall(extract_dir)

site_packages = next(Path(p) for p in sys.path if 'site-packages' in p)
for name in ['playwright', 'playwright-1.40.0.dist-info']:
    src = extract_dir / name
    dest = site_packages / name
    if dest.exists():
        shutil.rmtree(dest)
    if src.is_dir():
        shutil.copytree(src, dest)
    else:
        shutil.copy2(src, dest)
PY

RUN rm -rf /tmp/playwright playwright-*.whl

RUN python -c "import playwright; print('Playwright installed successfully')"

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application with browser path
CMD ["sh", "-c", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright uvicorn app.main:app --host 0.0.0.0 --port 8000"]
