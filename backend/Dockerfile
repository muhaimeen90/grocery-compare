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
RUN mkdir -p /tmp/playwright-wheel && \
    pip download --no-deps --dest /tmp/playwright-wheel playwright==1.40.0 && \
    python - <<'PY'
import zipfile
import shutil
from pathlib import Path
import sysconfig

wheel_dir = Path('/tmp/playwright-wheel')
wheel_matches = sorted(wheel_dir.glob('playwright-*.whl'))
if not wheel_matches:
    raise RuntimeError('Playwright wheel not downloaded')
wheel_path = wheel_matches[0]

extract_dir = Path('/tmp/playwright-extracted')
if extract_dir.exists():
    shutil.rmtree(extract_dir)
extract_dir.mkdir(parents=True)

with zipfile.ZipFile(wheel_path) as zf:
    zf.extractall(extract_dir)

site_packages = Path(sysconfig.get_paths()["purelib"])
for item in extract_dir.iterdir():
    dest = site_packages / item.name
    if dest.exists():
        if dest.is_file() or dest.is_symlink():
            dest.unlink()
        else:
            shutil.rmtree(dest)
    if item.is_file():
        shutil.copy2(item, dest)
    else:
        shutil.copytree(item, dest)
PY

RUN rm -rf /tmp/playwright-wheel /tmp/playwright-extracted

RUN python -c "import playwright; print('Playwright installed successfully')"

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application with browser path
CMD ["sh", "-c", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright uvicorn app.main:app --host 0.0.0.0 --port 8000"]
