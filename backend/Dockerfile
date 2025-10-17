FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .

# Install dependencies with playwright environment variable set
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pip install --no-cache-dir --upgrade pip && \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pip install --no-cache-dir -r requirements.txt

# Set runtime environment variables
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
