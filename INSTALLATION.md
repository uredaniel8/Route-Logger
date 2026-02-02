# Installation and Setup Guide

This guide will walk you through setting up the Route Logger application on your local machine.

## Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- npm (comes with Node.js)
- Google Maps API key (for map and route optimization features)

## Quick Start with Docker (Recommended)

If you have Docker and Docker Compose installed, you can start the entire application with one command:

1. Clone the repository:
   ```bash
   git clone https://github.com/uredaniel8/Route-Logger.git
   cd Route-Logger
   ```

2. Create a `.env` file in the root directory:
   ```bash
   echo "GOOGLE_MAPS_API_KEY=your_api_key_here" > .env
   ```

3. Start the application:
   ```bash
   docker-compose up
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Manual Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/uredaniel8/Route-Logger.git
cd Route-Logger
```

### Step 2: Set Up Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```

4. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your Google Maps API key:
   ```
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

6. Start the backend server:
   ```bash
   python app.py
   ```
   
   Or use the startup script:
   ```bash
   ./start.sh
   ```

The backend will start on http://localhost:5000

### Step 3: Set Up Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your Google Maps API key:
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   REACT_APP_API_URL=/api
   ```

4. Start the development server:
   ```bash
   npm start
   ```
   
   Or use the startup script:
   ```bash
   ./start.sh
   ```

The frontend will automatically open in your browser at http://localhost:3000

## Getting a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the following APIs:
   - Maps JavaScript API
   - Directions API
   - Geocoding API
4. Create credentials (API Key)
5. Copy the API key and use it in your `.env` files

**Important**: For production use, make sure to restrict your API key to prevent unauthorized use.

## Verifying the Installation

1. Open your browser and go to http://localhost:3000
2. You should see the Route Logger dashboard
3. Navigate to the "Customers" tab - you should see sample customer data
4. Try selecting a few customers and go to the "Route Optimizer" tab
5. Click "Optimize Route" to test the route optimization feature

## Troubleshooting

### Backend Issues

**Problem**: ModuleNotFoundError when starting the backend
- **Solution**: Make sure you've activated the virtual environment and installed all dependencies with `pip install -r requirements.txt`

**Problem**: Backend won't start on port 5000
- **Solution**: Port 5000 might be in use. Stop any other processes using that port or change the port in `app.py`

**Problem**: CSV file errors
- **Solution**: Make sure the `backend/data` directory exists and contains `customers.csv`

### Frontend Issues

**Problem**: npm install fails
- **Solution**: Make sure you have Node.js 16+ installed. Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

**Problem**: Frontend can't connect to backend
- **Solution**: Make sure the backend is running on http://localhost:5000. Check that the REACT_APP_API_URL in `.env` is correct

**Problem**: Google Maps not loading
- **Solution**: Verify your Google Maps API key is correct and the required APIs are enabled in Google Cloud Console

### General Issues

**Problem**: CORS errors in browser console
- **Solution**: Make sure the backend's CORS configuration allows requests from http://localhost:3000

**Problem**: Routes not optimizing properly
- **Solution**: Check that your Google Maps API key has the Directions API enabled and has sufficient quota

## Next Steps

- Import your own customer data via CSV
- Customize the grouping distance threshold
- Explore the different views (Table, Map, Route Optimizer)
- Export optimized routes as CSV for field operations

## Support

If you encounter any issues not covered here, please:
1. Check the main README.md for more information
2. Review the API documentation
3. Open an issue on the GitHub repository

## Production Deployment

For production deployment:
1. Set `FLASK_ENV=production` in backend `.env` (debug mode is automatically disabled)
2. Use a production WSGI server like Gunicorn for the backend
3. Build the frontend with `npm run build`
4. Serve the frontend build folder with a web server like Nginx
5. Set up proper API key restrictions in Google Cloud Console
6. Use HTTPS for both frontend and backend
7. Set up proper database for customer data (instead of CSV)
