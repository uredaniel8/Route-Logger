"""
Flask backend for Route Logger application
Handles customer management, route optimization, and Google Maps API integration
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime, timedelta
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import requests
from functools import lru_cache

app = Flask(__name__)
CORS(app)

# Configuration
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'customers.csv')
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')

# Initialize geocoder
geolocator = Nominatim(user_agent="route_logger")


def save_customers(df: pd.DataFrame):
    """Save customer data to CSV file"""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    df.to_csv(DATA_FILE, index=False)


def normalise_customer_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert common CSV headers into the snake_case keys the frontend expects.
    Keeps extra columns but ensures required ones exist.
    """
    if df is None:
        df = pd.DataFrame()

    if not hasattr(df, "columns"):
        df = pd.DataFrame(df)

    df.columns = [str(c).strip() for c in df.columns]

    col_map = {
        "Company": "company",
        "Account Number": "account_number",
        "Account #": "account_number",
        "Country": "country",
        "Postcode": "postcode",
        "Status": "status",
        "Current Year Spend": "current_spend",
        "Current Spend": "current_spend",
        "Tagged Customer": "tagged_customers",
        "Tier": "tagged_customers",
        "Date of Last Visit": "date_of_last_visit",
        "Last Visit": "date_of_last_visit",
        "Visit Frequency (Days)": "visit_frequency",
        "Frequency (days)": "visit_frequency",
        "Next Due Date": "next_due_date",
        "Next Due": "next_due_date",
    }

    df = df.rename(columns={c: col_map.get(c, c) for c in df.columns})

    if "postcode" in df.columns:
        df["postcode"] = df["postcode"].astype(str).str.strip()

    if "country" in df.columns:
        df["country"] = df["country"].fillna("UK").astype(str).str.strip()

    if "current_spend" in df.columns:
        df["current_spend"] = (
            df["current_spend"]
            .astype(str)
            .str.replace("£", "", regex=False)
            .str.replace(",", "", regex=False)
        )
        df["current_spend"] = pd.to_numeric(df["current_spend"], errors="coerce").fillna(0)

    required_defaults = {
        "company": "",
        "account_number": "",
        "country": "UK",
        "postcode": "",
        "status": "",
        "current_spend": 0,
        "tagged_customers": "",
        "date_of_last_visit": "",
        "visit_frequency": "",
        "next_due_date": "",
    }

    for col, default in required_defaults.items():
        if col not in df.columns:
            df[col] = default

    return df


def load_customers():
    """Load customer data from CSV file"""
    if os.path.exists(DATA_FILE):
        df = pd.read_csv(DATA_FILE)
        df = normalise_customer_columns(df)
        return df
    return pd.DataFrame()


@lru_cache(maxsize=1000)
def geocode_postcode(postcode, country='UK'):
    """Geocode a postcode to get latitude and longitude"""
    try:
        location = geolocator.geocode(f"{postcode}, {country}")
        if location:
            return (location.latitude, location.longitude)
    except Exception as e:
        print(f"Geocoding error for {postcode}: {e}")
    return None


def calculate_next_due_date(last_visit_date, visit_frequency):
    """Calculate next due date based on last visit and frequency"""
    try:
        last_visit = datetime.strptime(last_visit_date, '%Y-%m-%d')
        frequency_days = int(visit_frequency)
        next_due = last_visit + timedelta(days=frequency_days)
        return next_due.strftime('%Y-%m-%d')
    except:
        return None


def group_customers_by_proximity(customers_df, max_distance_km=10):
    """Group customers based on proximity using their postcodes"""
    customers = customers_df.to_dict('records')
    groups = []
    ungrouped = list(range(len(customers)))

    while ungrouped:
        current_idx = ungrouped[0]
        current_group = [current_idx]
        ungrouped.remove(current_idx)

        current_customer = customers[current_idx]
        current_coords = geocode_postcode(
            current_customer.get('postcode', ''),
            current_customer.get('country', 'UK')
        )

        if not current_coords:
            groups.append(current_group)
            continue

        to_remove = []
        for idx in ungrouped[:]:
            customer = customers[idx]
            coords = geocode_postcode(
                customer.get('postcode', ''),
                customer.get('country', 'UK')
            )
            if coords:
                distance = geodesic(current_coords, coords).kilometers
                if distance <= max_distance_km:
                    current_group.append(idx)
                    to_remove.append(idx)

        for idx in to_remove:
            ungrouped.remove(idx)

        groups.append(current_group)

    return groups


def optimize_route_with_google_maps(waypoints, api_key):
    """Optimize route using Google Maps Directions API"""
    if not api_key or len(waypoints) < 2:
        return [], []

    try:
        origin = waypoints[0]
        destination = waypoints[-1]
        waypoint_str = '|'.join([f"{w[0]},{w[1]}" for w in waypoints[1:-1]])

        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            'origin': f"{origin[0]},{origin[1]}",
            'destination': f"{destination[0]},{destination[1]}",
            'waypoints': f"optimize:true|{waypoint_str}" if waypoint_str else '',
            'key': api_key
        }

        response = requests.get(url, params=params)
        data = response.json()

        if data.get('status') == 'OK':
            route = data['routes'][0]
            waypoint_order = route.get('waypoint_order', [])
            legs = route.get('legs', [])
            return waypoint_order, legs
    except Exception as e:
        print(f"Google Maps API error: {e}")

    return [], []


# ---------------------------
# Customers (GET/POST/PUT)
# Add non-/api aliases to prevent frontend 404 -> HTML -> JSON parse error
# ---------------------------

@app.route('/api/customers', methods=['GET'])
@app.route('/customers', methods=['GET'])
def get_customers():
    """Get all customers"""
    df = load_customers()
    customers = df.to_dict('records')

    for customer in customers:
        if 'next_due_date' not in customer or pd.isna(customer.get('next_due_date')):
            if customer.get('date_of_last_visit') and customer.get('visit_frequency'):
                customer['next_due_date'] = calculate_next_due_date(
                    customer.get('date_of_last_visit', ''),
                    customer.get('visit_frequency', '')
                )

    return jsonify(customers)


@app.route('/api/customers', methods=['POST'])
@app.route('/customers', methods=['POST'])
def add_customer():
    """Add a new customer"""
    data = request.json or {}
    df = load_customers()

    new_customer = pd.DataFrame([data])
    new_customer = normalise_customer_columns(new_customer)

    df = pd.concat([df, new_customer], ignore_index=True)
    save_customers(df)

    return jsonify({'message': 'Customer added successfully', 'customer': data})


@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
@app.route('/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    """Update a customer"""
    data = request.json or {}
    df = load_customers()

    if customer_id < len(df):
        for key, value in data.items():
            df.at[customer_id, key] = value
        df = normalise_customer_columns(df)
        save_customers(df)
        return jsonify({'message': 'Customer updated successfully'})

    return jsonify({'error': 'Customer not found'}), 404


# ---------------------------
# Import / Export (CSV + Raw JSON)
# ---------------------------

@app.route('/api/customers/import', methods=['POST'])
@app.route('/customers/import', methods=['POST'])
def import_customers():
    """Import customers from CSV file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided (expected form field name "file")'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        df = pd.read_csv(file)
        df = normalise_customer_columns(df)
        save_customers(df)
        return jsonify({'message': f'Imported {len(df)} customers successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/customers/import/raw', methods=['POST'])
@app.route('/customers/import/raw', methods=['POST'])
def import_customers_raw():
    """Import customers from raw JSON data"""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400
    if not isinstance(data, list):
        return jsonify({'error': 'Data must be an array of customer objects'}), 400
    if len(data) == 0:
        return jsonify({'error': 'Data array is empty'}), 400

    try:
        df = pd.DataFrame(data)
        df = normalise_customer_columns(df)
        save_customers(df)
        return jsonify({'message': f'Imported {len(df)} customers successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/customers/export', methods=['GET'])
@app.route('/customers/export', methods=['GET'])
def export_customers():
    """Export customers to CSV file"""
    df = load_customers()
    export_path = os.path.join(os.path.dirname(__file__), 'data', 'export.csv')
    df.to_csv(export_path, index=False)
    return send_file(export_path, as_attachment=True, download_name='customers_export.csv')


# ---------------------------
# Grouping + Route Optimize
# ---------------------------

@app.route('/api/groups', methods=['POST'])
@app.route('/groups', methods=['POST'])
def create_groups():
    """Group customers by proximity"""
    data = request.json or {}
    max_distance = data.get('max_distance_km', 10)

    df = load_customers()
    groups = group_customers_by_proximity(df, max_distance)

    result = []
    for i, group_indices in enumerate(groups):
        group_customers = df.iloc[group_indices].to_dict('records')
        result.append({
            'group_id': i,
            'customers': group_customers,
            'count': len(group_customers)
        })

    return jsonify(result)


@app.route('/api/route/optimize', methods=['POST'])
@app.route('/route/optimize', methods=['POST'])
def optimize_route():
    """Optimize route for given customers"""
    data = request.json or {}
    customer_ids = data.get('customer_ids', [])

    df = load_customers()
    customers = df.iloc[customer_ids].to_dict('records')

    waypoints = []
    for customer in customers:
        coords = geocode_postcode(customer.get('postcode', ''), customer.get('country', 'UK'))
        if coords:
            waypoints.append(coords)

    if len(waypoints) < 2:
        return jsonify({'error': 'Need at least 2 valid locations'}), 400

    optimized_order, legs = optimize_route_with_google_maps(waypoints, GOOGLE_MAPS_API_KEY)

    if optimized_order and len(customers) > 2:
        middle_customers = customers[1:-1]
        reordered_middle = [middle_customers[i] for i in optimized_order]
        optimized_customers = [customers[0]] + reordered_middle + [customers[-1]]
    else:
        optimized_customers = customers

    return jsonify({
        'optimized_customers': optimized_customers,
        'route_legs': legs,
        'waypoints': waypoints
    })


@app.route('/api/overdue', methods=['GET'])
@app.route('/overdue', methods=['GET'])
def get_overdue_customers():
    """Get customers with overdue visits"""
    df = load_customers()
    today = datetime.now().strftime('%Y-%m-%d')

    overdue = []
    for _, customer in df.iterrows():
        next_due = customer.get('next_due_date')
        if next_due and str(next_due) < today:
            overdue.append(customer.to_dict())

    return jsonify(overdue)


@app.route('/api/health', methods=['GET'])
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})


if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)