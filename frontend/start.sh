#!/bin/bash

# Route Logger - Frontend Startup Script

echo "========================================"
echo "Route Logger - Frontend Startup"
echo "========================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env file and add your Google Maps API key."
fi

# Start the development server
echo "Starting React development server..."
npm start
