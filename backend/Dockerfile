FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Set Playwright environment variables BEFORE installation
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --no-deps playwright==1.40.0 && \
    pip install --no-cache-dir -r requirements.txt

# Verify browsers are available (for debugging)
RUN ls -la /ms-playwright/ || echo "Browser path not found"

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application with browser path
CMD ["sh", "-c", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright uvicorn app.main:app --host 0.0.0.0 --port 8000"]
