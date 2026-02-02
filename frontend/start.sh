#!/bin/bash

# Route Logger - Frontend Startup Script

set -e  # Exit on error

echo "========================================"
echo "Route Logger - Frontend Startup"
echo "========================================"
echo ""

# Function to print error messages
error_exit() {
    echo "ERROR: $1" >&2
    echo "Please fix the issue and try again."
    exit 1
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    error_exit "Node.js is not installed. Please install Node.js (v14 or higher) from https://nodejs.org/"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    error_exit "npm is not installed. Please install Node.js which includes npm."
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"
echo ""

# Check if package.json exists
if [ ! -f "package.json" ]; then
    error_exit "package.json not found. Are you in the frontend directory?"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install || error_exit "Failed to install dependencies. Check your internet connection and try again."
    echo "✓ Dependencies installed successfully"
    echo ""
else
    echo "✓ Dependencies already installed"
    echo ""
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo ""
    echo "Creating .env from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ .env file created"
        echo ""
        echo "📝 IMPORTANT: Edit the .env file and configure:"
        echo "   - REACT_APP_GOOGLE_MAPS_API_KEY (required for map features)"
        echo "   - REACT_APP_API_URL (optional, defaults to /api)"
        echo ""
        echo "   Without these, some features may not work properly."
        echo ""
    else
        echo "✗ .env.example not found. Cannot create .env file."
        echo ""
    fi
else
    echo "✓ .env file exists"
    
    # Check if Google Maps API key is configured
    if grep -q "REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here" .env 2>/dev/null || \
       ! grep -q "REACT_APP_GOOGLE_MAPS_API_KEY=" .env 2>/dev/null; then
        echo "⚠️  Warning: Google Maps API key not configured in .env"
        echo "   Map features will show a fallback UI"
    else
        echo "✓ Google Maps API key configured"
    fi
    echo ""
fi

# Check if backend is running (optional check)
echo "🔍 Checking backend API connectivity..."
if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null | grep -q "200"; then
        echo "✓ Backend API is running at http://localhost:5000"
    else
        echo "⚠️  Warning: Backend API is not responding at http://localhost:5000"
        echo "   You may need to start the backend server first."
        echo "   Run: cd ../backend && ./start.sh"
    fi
else
    echo "ℹ️  curl not available, skipping backend check"
fi
echo ""

# Start the development server
echo "🚀 Starting React development server..."
echo "   The app will open in your browser at http://localhost:3000"
echo ""
echo "📝 Check the browser console for detailed logs and errors"
echo "   Press Ctrl+C to stop the server"
echo ""

npm start
