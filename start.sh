#!/bin/bash
set -e

echo "🔄 Starting Grocery Compare services..."

# Check if frontend standalone build exists
if [ ! -f "/home/ubuntu/projects/grocery-compare/frontend/.next/standalone/server.js" ]; then
    echo "📦 Building frontend (standalone mode)..."
    cd /home/ubuntu/projects/grocery-compare/frontend
    npm run build
    
    # Copy static files
    echo "📋 Copying static files..."
    cp -r .next/static .next/standalone/.next/static
    [ -d public ] && cp -r public .next/standalone/ || true
fi

echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

echo "🚀 Starting backend service..."
systemctl start grocery-backend

echo "🚀 Starting frontend service..."
systemctl start grocery-frontend

sleep 2

echo ""
echo "✅ Services started!"
echo ""
systemctl status grocery-backend grocery-frontend --no-pager | grep -E "(Active:|Main PID:)"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:8000"