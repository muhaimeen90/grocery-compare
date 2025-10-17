FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Set Playwright environment variables
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip

# Install all dependencies EXCEPT playwright first
RUN grep -v "playwright" requirements.txt > requirements-temp.txt && \
    pip install --no-cache-dir -r requirements-temp.txt && \
    rm requirements-temp.txt

# Install playwright but prevent the post-install script from running
# by temporarily making 'su' command fail silently
RUN mv /bin/su /bin/su.bak 2>/dev/null || true && \
    echo '#!/bin/bash\nexit 0' > /bin/su && \
    chmod +x /bin/su && \
    pip install --no-cache-dir playwright==1.40.0 ; \
    mv /bin/su.bak /bin/su 2>/dev/null || true

# Verify playwright can be imported and browsers are available
RUN python -c "from playwright.sync_api import sync_playwright; print('Playwright imported successfully')" && \
    ls -la /ms-playwright/chromium-*/chrome-linux/chrome 2>/dev/null || echo "Using system browsers"

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application with browser path
CMD ["sh", "-c", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright uvicorn app.main:app --host 0.0.0.0 --port 8000"]
