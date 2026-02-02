# API Documentation

This document describes the REST API endpoints available in the Route Logger backend.

## Base URL

```
http://localhost:5000/api
```

## Endpoints

### Health Check

Check if the API is running and healthy.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T08:50:07.942Z"
}
```

---

### Get All Customers

Retrieve all customers from the database.

**Endpoint**: `GET /api/customers`

**Response**:
```json
[
  {
    "company": "Acme Corp",
    "account_number": "ACC001",
    "country": "UK",
    "postcode": "SW1A 1AA",
    "status": "Active",
    "current_spend": 25000,
    "tagged_customers": "Premium",
    "multi_site": "Yes",
    "area_code": "SW",
    "date_of_last_visit": "2024-01-15",
    "visit_frequency": 30,
    "next_due_date": "2024-02-14"
  }
]
```

---

### Add Customer

Add a new customer to the database.

**Endpoint**: `POST /api/customers`

**Request Body**:
```json
{
  "company": "New Company Ltd",
  "account_number": "ACC011",
  "country": "UK",
  "postcode": "EC1A 1BB",
  "status": "Active",
  "current_spend": 15000,
  "tagged_customers": "Standard",
  "multi_site": "No",
  "area_code": "EC",
  "date_of_last_visit": "2024-02-01",
  "visit_frequency": 45
}
```

**Response**:
```json
{
  "message": "Customer added successfully",
  "customer": { ... }
}
```

---

### Update Customer

Update an existing customer's information.

**Endpoint**: `PUT /api/customers/<customer_id>`

**Parameters**:
- `customer_id` (integer): The index of the customer in the CSV

**Request Body**:
```json
{
  "visit_frequency": 60,
  "tagged_customers": "Premium"
}
```

**Response**:
```json
{
  "message": "Customer updated successfully"
}
```

**Error Response**:
```json
{
  "error": "Customer not found"
}
```

---

### Import Customers from CSV

Import multiple customers from a CSV file.

**Endpoint**: `POST /api/customers/import`

**Request**: Multipart form data with file upload

**Form Field**:
- `file`: CSV file containing customer data

**CSV Format**:
```csv
company,account_number,country,postcode,status,current_spend,tagged_customers,multi_site,area_code,date_of_last_visit,visit_frequency,next_due_date
```

**Response**:
```json
{
  "message": "Imported 10 customers successfully"
}
```

**Error Response**:
```json
{
  "error": "No file provided"
}
```

---

### Import Customers from Raw JSON

Import multiple customers from raw JSON data.

**Endpoint**: `POST /api/customers/import/raw`

**Request Body**: JSON array of customer objects
```json
[
  {
    "company": "Test Company 1",
    "account_number": "TEST001",
    "country": "UK",
    "postcode": "SW1A 1AA",
    "status": "Active",
    "current_spend": 15000,
    "tagged_customers": "Standard",
    "multi_site": "No",
    "area_code": "SW",
    "date_of_last_visit": "2024-02-01",
    "visit_frequency": 30
  },
  {
    "company": "Test Company 2",
    "account_number": "TEST002",
    "country": "UK",
    "postcode": "EC1A 1BB",
    "status": "Active",
    "current_spend": 25000,
    "tagged_customers": "Premium",
    "multi_site": "Yes",
    "area_code": "EC",
    "date_of_last_visit": "2024-01-15",
    "visit_frequency": 45
  }
]
```

**Response**:
```json
{
  "message": "Imported 2 customers successfully"
}
```

**Error Responses**:
```json
{
  "error": "No data provided"
}
```
```json
{
  "error": "Data must be an array of customer objects"
}
```
```json
{
  "error": "Data array is empty"
}
```

---

### Export Customers to CSV

Export all customers to a CSV file.

**Endpoint**: `GET /api/customers/export`

**Response**: CSV file download

**File Name**: `customers_export.csv`

---

### Create Customer Groups

Group customers based on geographical proximity.

**Endpoint**: `POST /api/groups`

**Request Body**:
```json
{
  "max_distance_km": 10
}
```

**Response**:
```json
[
  {
    "group_id": 0,
    "count": 3,
    "customers": [
      { ... },
      { ... },
      { ... }
    ]
  },
  {
    "group_id": 1,
    "count": 2,
    "customers": [
      { ... },
      { ... }
    ]
  }
]
```

---

### Optimize Route

Optimize the visiting route for selected customers using Google Maps API.

**Endpoint**: `POST /api/route/optimize`

**Request Body**:
```json
{
  "customer_ids": [0, 2, 5, 7]
}
```

**Response**:
```json
{
  "optimized_customers": [
    { ... },
    { ... },
    { ... },
    { ... }
  ],
  "route_legs": [
    {
      "distance": {
        "text": "5.2 km",
        "value": 5200
      },
      "duration": {
        "text": "15 mins",
        "value": 900
      },
      "start_address": "...",
      "end_address": "..."
    }
  ],
  "waypoints": [
    [51.5074, -0.1278],
    [51.5155, -0.1426]
  ]
}
```

**Error Response**:
```json
{
  "error": "Need at least 2 valid locations"
}
```

---

### Get Overdue Customers

Retrieve customers whose next visit is overdue.

**Endpoint**: `GET /api/overdue`

**Response**:
```json
[
  {
    "company": "Acme Corp",
    "account_number": "ACC001",
    "next_due_date": "2024-02-14",
    ...
  }
]
```

---

## Error Codes

The API uses standard HTTP status codes:

- `200 OK`: Successful request
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Authentication

Currently, the API does not require authentication. For production use, implement proper authentication mechanisms such as:
- API Keys
- OAuth 2.0
- JWT tokens

## Rate Limiting

There is no rate limiting in the current version. For production, implement rate limiting to prevent abuse.

## Google Maps API Integration

Some endpoints (route optimization, grouping) use the Google Maps API. Make sure you have:
1. A valid Google Maps API key set in the environment variables
2. The following APIs enabled:
   - Directions API
   - Geocoding API
3. Sufficient quota for your usage

## CORS

CORS is enabled for all origins in development mode. For production, configure CORS to only allow requests from your frontend domain.

## Data Format

### Date Format
All dates should be in ISO 8601 format: `YYYY-MM-DD`

### Distance
Distances are returned in kilometers (km)

### Duration
Durations are returned in minutes

## Example Usage

### Using cURL

Get all customers:
```bash
curl http://localhost:5000/api/customers
```

Add a customer:
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Test Company",
    "account_number": "TEST001",
    "country": "UK",
    "postcode": "EC1A 1BB",
    "status": "Active",
    "current_spend": 10000,
    "tagged_customers": "Standard",
    "visit_frequency": 30
  }'
```

Optimize route:
```bash
curl -X POST http://localhost:5000/api/route/optimize \
  -H "Content-Type: application/json" \
  -d '{"customer_ids": [0, 1, 2]}'
```

### Using JavaScript/Fetch

```javascript
// Get all customers
fetch('/api/customers')
  .then(response => response.json())
  .then(data => console.log(data));

// Optimize route
fetch('/api/route/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer_ids: [0, 1, 2] })
})
  .then(response => response.json())
  .then(data => console.log(data));
```

## Support

For issues or questions about the API, please open an issue on the GitHub repository.
