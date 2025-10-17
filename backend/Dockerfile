FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Set Playwright environment variables
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    grep -v "playwright" requirements.txt > requirements-temp.txt && \
    pip install --no-cache-dir -r requirements-temp.txt && \
    rm requirements-temp.txt && \
    mv /bin/su /bin/su.bak 2>/dev/null || true && \
    echo '#!/bin/bash' > /bin/su && \
    echo 'exit 0' >> /bin/su && \
    chmod +x /bin/su && \
    pip install --no-cache-dir playwright==1.40.0 && \
    rm /bin/su && \
    mv /bin/su.bak /bin/su 2>/dev/null || true && \
    python -c "from playwright.sync_api import sync_playwright; print('Playwright imported successfully')"

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application with browser path
CMD ["sh", "-c", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright uvicorn app.main:app --host 0.0.0.0 --port 8000"]
