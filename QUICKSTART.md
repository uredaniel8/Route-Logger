# Quick Start Guide

Get up and running with Route Logger in 5 minutes!

## Prerequisites

- Python 3.8+
- Node.js 16+
- Google Maps API Key (optional for basic features)

## 1. Clone the Repository

```bash
git clone https://github.com/uredaniel8/Route-Logger.git
cd Route-Logger
```

## 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend will start at http://localhost:5000

## 3. Start the Frontend (New Terminal)

```bash
cd frontend
npm install
npm start
```

The frontend will open at http://localhost:3000

## 4. Explore the Application

1. **View Customers**: See the sample customer data in the table
2. **Select Customers**: Check boxes next to a few customers
3. **Optimize Route**: Go to "Route Optimizer" tab and click "Optimize Route"
4. **View Map**: Check out the "Map View" tab (requires Google Maps API key)

## Quick Commands

### Backend
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Start server
python app.py

# Run tests
bash test_api.sh
```

### Frontend
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Using Docker (Alternative)

If you have Docker installed:

```bash
# From project root
docker-compose up
```

Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Configuration

### Google Maps API Key (Optional)

To use map and route optimization features:

1. Get an API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Create `.env` files:

**Backend** (`backend/.env`):
```
GOOGLE_MAPS_API_KEY=your_key_here
```

**Frontend** (`frontend/.env`):
```
REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here
```

## Test the API

```bash
# Health check
curl http://localhost:5000/api/health

# Get customers
curl http://localhost:5000/api/customers

# Get overdue customers
curl http://localhost:5000/api/overdue
```

## Common Issues

**Backend won't start**: Make sure port 5000 is free
```bash
# Check if port is in use
lsof -i :5000
```

**Frontend won't start**: Make sure port 3000 is free
```bash
# Check if port is in use
lsof -i :3000
```

**Module not found**: Reinstall dependencies
```bash
# Backend
pip install -r requirements.txt

# Frontend
rm -rf node_modules && npm install
```

## Next Steps

- Read [FEATURES.md](FEATURES.md) for complete feature overview
- See [INSTALLATION.md](INSTALLATION.md) for detailed setup
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API reference
- Import your own customer data via CSV
- Customize the application for your needs

## Need Help?

- Review the [README.md](README.md) for comprehensive information
- Check existing issues on GitHub
- Open a new issue if needed

## Quick Feature Test Checklist

- [ ] Backend starts successfully
- [ ] Frontend loads in browser
- [ ] Customer table displays sample data
- [ ] Can sort table columns
- [ ] Can edit customer frequency
- [ ] Can select multiple customers
- [ ] Route optimizer shows selected customers
- [ ] Can export CSV
- [ ] Can import CSV
- [ ] Overdue customers are highlighted
- [ ] Map view loads (with API key)
- [ ] Route optimization works (with API key)

---

**Congratulations!** You now have Route Logger running locally. Start planning your routes!
