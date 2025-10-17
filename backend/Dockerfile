FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Use browsers bundled with the Playwright base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install Python dependencies (Playwright already provided by base image)
COPY requirements-docker.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application with browser path
CMD ["sh", "-c", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright uvicorn app.main:app --host 0.0.0.0 --port 8000"]
