"""
Flask backend for Route Logger application
Handles customer management, route optimization, and Google Maps API integration
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import requests
from functools import lru_cache

app = Flask(__name__)
CORS(app)

# Configuration
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "customers.csv")
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")

# Initialize geocoder
geolocator = Nominatim(user_agent="route_logger")

# Frontend expects these keys:
EXPECTED_COLUMNS = [
    "company",
    "account_number",
    "country",
    "postcode",
    "status",
    "current_spend",
    "tagged_customers",
    "date_of_last_visit",
    "visit_frequency",
    "next_due_date",
]

# Map your CSV headers -> expected keys
# All keys are lowercase since we normalize headers before mapping
CSV_COLUMN_MAP = {
    "company": "company",
    "account_number": "account_number",
    "country": "country",
    "postcode": "postcode",
    "status": "status",
    "current_year_spend": "current_spend",
    "current_spend": "current_spend",
    "tagged_customer": "tagged_customers",
    "tagged_customers": "tagged_customers",
    "date_of_last_visit": "date_of_last_visit",
    "visit_frequency_(days)": "visit_frequency",
    "visit_frequency": "visit_frequency",
    "next_due_date": "next_due_date",
    # Optional extras
    "area_code": "area_code",
    "multi_site?": "multi_site",
    "multi_site": "multi_site",
    "urgency": "urgency",
}


def _parse_date_to_iso(value):
    """
    Converts incoming date values to 'YYYY-MM-DD' (or returns None).
    Handles:
      - NaN/None
      - '27/04/2026'
      - '2026-04-27'
      - '27-04-2026'
      - actual datetime values
    """
    if value is None:
        return None

    # pandas NaN -> None
    if isinstance(value, float) and np.isnan(value):
        return None

    # Already a datetime?
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.strftime("%Y-%m-%d")

    s = str(value).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None

    # Try common formats
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Fallback: let pandas try (best effort)
    try:
        dt = pd.to_datetime(s, errors="coerce", dayfirst=True)
        if pd.isna(dt):
            return None
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def _sanitize_df_for_json(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensures the dataframe contains JSON-safe values:
    - NaN/NaT -> None
    - inf -> None
    """
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.where(pd.notnull(df), None)
    return df


def _normalize_import_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalise imported CSV to the schema expected by the frontend.
    - Renames columns from your Excel/CSV headers
    - Converts dates to ISO format
    - Ensures numeric types for spend/frequency
    - Ensures NaN becomes None
    """
    # First normalize all column names to lowercase for case-insensitive matching
    df.columns = df.columns.str.strip().str.lower()
    
    # Rename columns we recognise (now working with lowercase)
    rename_map = {c: CSV_COLUMN_MAP.get(c, c) for c in df.columns if c in CSV_COLUMN_MAP}
    df = df.rename(columns=rename_map)

    # Try to match any columns we might have missed with soft matching
    # This handles cases like "account number" vs "account_number"
    lower_map = {c.lower().strip().replace(' ', '_'): c for c in df.columns}
    for original, target in CSV_COLUMN_MAP.items():
        key = original.lower().strip().replace(' ', '_')
        if key in lower_map and target not in df.columns:
            df = df.rename(columns={lower_map[key]: target})

    # Date conversions
    if "date_of_last_visit" in df.columns:
        df["date_of_last_visit"] = df["date_of_last_visit"].apply(_parse_date_to_iso)

    if "next_due_date" in df.columns:
        df["next_due_date"] = df["next_due_date"].apply(_parse_date_to_iso)

    # Numeric conversions
    if "current_spend" in df.columns:
        df["current_spend"] = pd.to_numeric(df["current_spend"], errors="coerce")

    if "visit_frequency" in df.columns:
        df["visit_frequency"] = pd.to_numeric(df["visit_frequency"], errors="coerce")

    # Booleans
    if "tagged_customers" in df.columns:
        df["tagged_customers"] = df["tagged_customers"].map(
            lambda x: True if str(x).strip().lower() in {"true", "1", "yes"} else False
            if str(x).strip().lower() in {"false", "0", "no"} else x
        )

    if "multi_site" in df.columns:
        df["multi_site"] = df["multi_site"].map(
            lambda x: True if str(x).strip().lower() in {"true", "1", "yes"} else False
            if str(x).strip().lower() in {"false", "0", "no"} else x
        )

    df = _sanitize_df_for_json(df)

    return df


def load_customers() -> pd.DataFrame:
    """Load customer data from CSV file"""
    if os.path.exists(DATA_FILE):
        df = pd.read_csv(DATA_FILE)
        # normalise in case the stored file has old headers
        df = _normalize_import_df(df)
        return df
    return pd.DataFrame(columns=EXPECTED_COLUMNS)


def save_customers(df: pd.DataFrame):
    """Save customer data to CSV file"""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    df = _sanitize_df_for_json(df)
    df.to_csv(DATA_FILE, index=False)


@lru_cache(maxsize=1000)
def geocode_postcode(postcode, country="UK"):
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
        if not last_visit_date:
            return None
        last_visit_iso = _parse_date_to_iso(last_visit_date)
        if not last_visit_iso:
            return None

        last_visit = datetime.strptime(last_visit_iso, "%Y-%m-%d")
        frequency_days = int(float(visit_frequency))  # allows "56.0"
        next_due = last_visit + timedelta(days=frequency_days)
        return next_due.strftime("%Y-%m-%d")
    except Exception:
        return None


def group_customers_by_proximity(customers_df, max_distance_km=10):
    """Group customers based on proximity using their postcodes"""
    customers = customers_df.to_dict("records")
    groups = []
    ungrouped = list(range(len(customers)))

    while ungrouped:
        current_idx = ungrouped[0]
        current_group = [current_idx]
        ungrouped.remove(current_idx)

        current_customer = customers[current_idx]
        current_coords = geocode_postcode(
            current_customer.get("postcode", ""),
            current_customer.get("country", "UK"),
        )

        if not current_coords:
            groups.append(current_group)
            continue

        to_remove = []
        for idx in ungrouped[:]:
            customer = customers[idx]
            coords = geocode_postcode(
                customer.get("postcode", ""),
                customer.get("country", "UK"),
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
        waypoint_str = "|".join([f"{w[0]},{w[1]}" for w in waypoints[1:-1]])

        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{destination[0]},{destination[1]}",
            "waypoints": f"optimize:true|{waypoint_str}" if waypoint_str else "",
            "key": api_key,
        }

        response = requests.get(url, params=params, timeout=30)
        data = response.json()

        if data.get("status") == "OK":
            route = data["routes"][0]
            waypoint_order = route.get("waypoint_order", [])
            legs = route.get("legs", [])
            return waypoint_order, legs
    except Exception as e:
        print(f"Google Maps API error: {e}")

    return [], []


def _get_customers_payload():
    df = load_customers()

    # Ensure expected columns exist (even if file was saved previously without them)
    for col in EXPECTED_COLUMNS:
        if col not in df.columns:
            df[col] = None

    # Calculate next due dates if missing
    for idx in range(len(df)):
        nd = df.at[idx, "next_due_date"] if "next_due_date" in df.columns else None
        if not nd:
            lv = df.at[idx, "date_of_last_visit"]
            vf = df.at[idx, "visit_frequency"]
            if lv and vf:
                df.at[idx, "next_due_date"] = calculate_next_due_date(lv, vf)

    df = _sanitize_df_for_json(df)
    customers = df.to_dict("records")
    return customers


# -------------------------
# ROUTES (support BOTH /api/* and non-/api for frontend compatibility)
# -------------------------

@app.route("/api/customers", methods=["GET"])
@app.route("/customers", methods=["GET"])
def get_customers():
    return jsonify(_get_customers_payload())


@app.route("/api/customers", methods=["POST"])
@app.route("/customers", methods=["POST"])
def add_customer():
    data = request.json or {}
    df = load_customers()
    new_customer = pd.DataFrame([data])
    df = pd.concat([df, new_customer], ignore_index=True)
    df = _normalize_import_df(df)  # keep schema consistent
    save_customers(df)
    return jsonify({"message": "Customer added successfully", "customer": data})


@app.route("/api/customers/<int:customer_id>", methods=["PUT"])
@app.route("/customers/<int:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    data = request.json or {}
    df = load_customers()

    if 0 <= customer_id < len(df):
        for key, value in data.items():
            df.at[customer_id, key] = value

        df = _normalize_import_df(df)
        save_customers(df)
        return jsonify({"message": "Customer updated successfully"})

    return jsonify({"error": "Customer not found"}), 404


@app.route("/api/customers/import", methods=["POST"])
@app.route("/customers/import", methods=["POST"])
def import_customers():
    """Import customers from CSV file"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        df = pd.read_csv(file)

        df = _normalize_import_df(df)

        missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
        if missing:
            return jsonify({
                "error": "CSV is missing required columns after mapping.",
                "missing": missing,
                "hint": "Your CSV should include these columns (case-insensitive): company, account_number, country, postcode, status, current_spend, tagged_customers, date_of_last_visit, visit_frequency, next_due_date. Common variants like 'Current Year Spend' or 'Visit Frequency (Days)' are also accepted."
            }), 400

        save_customers(df)
        return jsonify({"message": f"Imported {len(df)} customers successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/customers/import/raw", methods=["POST"])
@app.route("/customers/import/raw", methods=["POST"])
def import_customers_raw():
    """Import customers from raw JSON data"""
    data = request.json

    if not data:
        return jsonify({"error": "No data provided"}), 400

    if not isinstance(data, list):
        return jsonify({"error": "Data must be an array of customer objects"}), 400

    if len(data) == 0:
        return jsonify({"error": "Data array is empty"}), 400

    try:
        df = pd.DataFrame(data)
        df = _normalize_import_df(df)

        missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
        if missing:
            return jsonify({"error": "Data is missing required fields", "missing": missing}), 400

        save_customers(df)
        return jsonify({"message": f"Imported {len(df)} customers successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/customers/export", methods=["GET"])
@app.route("/customers/export", methods=["GET"])
def export_customers():
    """Export customers to CSV file"""
    df = load_customers()
    export_path = os.path.join(os.path.dirname(__file__), "data", "export.csv")
    df.to_csv(export_path, index=False)
    return send_file(export_path, as_attachment=True, download_name="customers_export.csv")


@app.route("/api/groups", methods=["POST"])
@app.route("/groups", methods=["POST"])
def create_groups():
    """Group customers by proximity"""
    data = request.json or {}
    max_distance = data.get("max_distance_km", 10)

    df = load_customers()
    groups = group_customers_by_proximity(df, max_distance)

    result = []
    for i, group_indices in enumerate(groups):
        group_customers = df.iloc[group_indices].to_dict("records")
        result.append({"group_id": i, "customers": group_customers, "count": len(group_customers)})

    return jsonify(result)


@app.route("/api/route/optimize", methods=["POST"])
@app.route("/route/optimize", methods=["POST"])
def optimize_route():
    """Optimize route for given customers"""
    data = request.json or {}
    customer_ids = data.get("customer_ids", [])
    start_postcode = data.get("start_postcode")
    end_postcode = data.get("end_postcode")

    df = load_customers()
    if len(customer_ids) == 0 and not start_postcode:
        return jsonify({"error": "Need at least 2 total waypoints from customers and/or start/end postcodes"}), 400

    # Get selected customers
    customers = df.iloc[customer_ids].to_dict("records") if customer_ids else []

    # Build waypoints list
    waypoints = []
    
    # Add start postcode if provided
    if start_postcode:
        start_coords = geocode_postcode(start_postcode, data.get("start_country", "UK"))
        if not start_coords:
            return jsonify({"error": f"Could not geocode start postcode: {start_postcode}"}), 400
        waypoints.append(start_coords)
    
    # Add customer waypoints
    for customer in customers:
        coords = geocode_postcode(customer.get("postcode", ""), customer.get("country", "UK"))
        if coords:
            waypoints.append(coords)
    
    # Add end postcode if provided
    if end_postcode:
        end_coords = geocode_postcode(end_postcode, data.get("end_country", "UK"))
        if not end_coords:
            return jsonify({"error": f"Could not geocode end postcode: {end_postcode}"}), 400
        waypoints.append(end_coords)

    if len(waypoints) < 2:
        return jsonify({"error": "Need at least 2 valid locations (customers or start/end postcodes)"}), 400

    optimized_order, legs = optimize_route_with_google_maps(waypoints, GOOGLE_MAPS_API_KEY)

    # Reconstruct optimized customer list based on the order
    if optimized_order and len(customers) > 0:
        # Google Maps returns the order of intermediate waypoints (excluding first and last)
        # We need to map this back to our customers
        
        try:
            if start_postcode and end_postcode:
                # Start + customers + end
                if len(customers) > 0 and all(0 <= i < len(customers) for i in optimized_order):
                    reordered_customers = [customers[i] for i in optimized_order]
                else:
                    reordered_customers = []
            elif start_postcode:
                # Start + customers (last customer is the end)
                if len(customers) > 1:
                    middle_customers = customers[:-1]
                    if all(0 <= i < len(middle_customers) for i in optimized_order):
                        reordered_middle = [middle_customers[i] for i in optimized_order]
                        reordered_customers = reordered_middle + [customers[-1]]
                    else:
                        reordered_customers = customers
                else:
                    reordered_customers = customers
            elif end_postcode:
                # First customer is start + middle customers + end
                if len(customers) > 1:
                    middle_customers = customers[1:]
                    if all(0 <= i < len(middle_customers) for i in optimized_order):
                        reordered_middle = [middle_customers[i] for i in optimized_order]
                        reordered_customers = [customers[0]] + reordered_middle
                    else:
                        reordered_customers = customers
                else:
                    reordered_customers = customers
            else:
                # Just customers, first and last are fixed
                if len(customers) > 2:
                    middle_customers = customers[1:-1]
                    if all(0 <= i < len(middle_customers) for i in optimized_order):
                        reordered_middle = [middle_customers[i] for i in optimized_order]
                        reordered_customers = [customers[0]] + reordered_middle + [customers[-1]]
                    else:
                        reordered_customers = customers
                else:
                    reordered_customers = customers
        except (IndexError, TypeError) as e:
            print(f"Error reordering customers: {e}")
            reordered_customers = customers
        
        optimized_customers = reordered_customers
    else:
        optimized_customers = customers

    result = {
        "optimized_customers": optimized_customers,
        "route_legs": legs,
        "waypoints": waypoints,
        "start_postcode": start_postcode,
        "end_postcode": end_postcode,
    }

    return jsonify(result)


@app.route("/api/overdue", methods=["GET"])
@app.route("/overdue", methods=["GET"])
def get_overdue_customers():
    """Get customers with overdue visits"""
    df = load_customers()
    today = datetime.now().strftime("%Y-%m-%d")

    overdue = []
    for _, customer in df.iterrows():
        next_due = customer.get("next_due_date")
        next_due_iso = _parse_date_to_iso(next_due)
        if next_due_iso and next_due_iso < today:
            overdue.append(customer.to_dict())

    return jsonify(overdue)


@app.route("/api/health", methods=["GET"])
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


if __name__ == "__main__":
    # Only enable debug mode in development environment
    debug_mode = os.environ.get("FLASK_ENV") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=5000)