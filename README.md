# Route Logger

An interactive route planning and customer grouping application that helps optimize customer visits using geolocation and Google Maps API integration.

## Features

- **Customer Management**: Import, export, and manage customer data via CSV
- **Proximity Grouping**: Automatically group customers based on geographical proximity
- **Route Optimization**: Optimize visit routes using Google Maps API
- **Interactive Map View**: Visualize customer locations on an interactive map
- **Priority Management**: Track visit frequency, last visit dates, and overdue visits
- **Editable Routes**: Manually adjust and reorder visit priorities
- **CSV Export**: Export optimized routes and customer data

## Project Structure

```
Route-Logger/
├── backend/               # Flask backend API
│   ├── app.py            # Main application file
│   ├── requirements.txt  # Python dependencies
│   └── data/             # Customer data storage
│       └── customers.csv # Sample customer data
├── frontend/             # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.js        # Main application component
│   │   └── index.js      # Application entry point
│   ├── public/           # Static files
│   └── package.json      # Node.js dependencies
└── README.md             # This file
```

## Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

5. Add your Google Maps API key to the `.env` file:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

6. Start the Flask server:
   ```bash
   python app.py
   ```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Google Maps API key:
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
   REACT_APP_API_URL=/api
   ```

4. Start the React development server:
   ```bash
   npm start
   ```

The frontend will run on `http://localhost:3000`

## Usage

### Customer Management

1. **View Customers**: Navigate to the "Customers" tab to see all customer data in a table format
2. **Edit Customer Data**: Click the "Edit" button on any customer row to modify:
   - Visit frequency (days between visits)
   - Tier group (Premium, Standard, etc.)
3. **Import Customers**: 
   - Click "Import CSV" to upload a customer data file
   - Click "Import Raw JSON" to paste JSON array directly
4. **Export Customers**: Click "Export CSV" to download current customer data

### Customer Grouping

1. From the Customers tab, click "Group by Proximity"
2. The system will automatically group customers within 10km of each other
3. Groups are based on postcode geolocation

### Route Optimization

1. Navigate to the "Customers" tab
2. Select customers by checking the boxes in the leftmost column
3. Go to the "Route Optimizer" tab
4. Click "Optimize Route" to generate the most efficient visit order
5. View route statistics (distance, time, number of stops)
6. Manually reorder stops using the ↑ and ↓ buttons if needed
7. Export the optimized route as a CSV file

### Map View

1. Navigate to the "Map View" tab to see customers on an interactive map
2. Click on markers to view customer details
3. Select/deselect customers directly from the map info windows
4. Selected customers appear with green markers

### Overdue Visits

- Customers with overdue visits are highlighted in red
- Overdue dates are marked with a warning icon (⚠️)
- The system automatically calculates next due dates based on last visit and frequency

## API Endpoints

### Customer Management
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Add a new customer
- `PUT /api/customers/<id>` - Update a customer
- `POST /api/customers/import` - Import customers from CSV
- `POST /api/customers/import/raw` - Import customers from raw JSON
- `GET /api/customers/export` - Export customers to CSV

### Route Operations
- `POST /api/groups` - Group customers by proximity
- `POST /api/route/optimize` - Optimize route for selected customers
- `GET /api/overdue` - Get customers with overdue visits

### System
- `GET /api/health` - Health check endpoint

## Customer Data Format

The CSV file should include the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| company | Company name | Acme Corp |
| account_number | Account identifier | ACC001 |
| country | Country code | UK |
| postcode | Postal code | SW1A 1AA |
| status | Customer status | Active |
| current_spend | Annual spend | 25000 |
| tagged_customers | Tier level | Premium |
| multi_site | Multiple locations | Yes/No |
| area_code | Area code | SW |
| date_of_last_visit | Last visit date | 2024-01-15 |
| visit_frequency | Days between visits | 30 |
| next_due_date | Next scheduled visit | 2024-02-14 |

## Google Maps API Setup

To use the route optimization and map features, you need a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Directions API
   - Geocoding API
4. Create an API key
5. Add the API key to both backend and frontend `.env` files

## Technology Stack

### Backend
- **Flask**: Python web framework
- **Pandas**: Data manipulation and CSV handling
- **Geopy**: Geocoding and distance calculations
- **Requests**: HTTP client for Google Maps API

### Frontend
- **React**: UI framework
- **@react-google-maps/api**: Google Maps integration
- **Axios**: HTTP client

## Development

### Running Tests

Backend tests:
```bash
cd backend
pytest
```

Frontend tests:
```bash
cd frontend
npm test
```

### Building for Production

Frontend build:
```bash
cd frontend
npm run build
```

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on the GitHub repository.