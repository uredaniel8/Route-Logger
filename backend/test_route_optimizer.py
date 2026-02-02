"""
Unit tests for Route Optimizer functionality
Tests error handling, validation, and geocoding scenarios
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from app import app, geocode_postcode, optimize_route
import pandas as pd


@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_customers():
    """Create mock customer data"""
    return pd.DataFrame([
        {
            'company': 'Test Company 1',
            'account_number': 'ACC001',
            'country': 'UK',
            'postcode': 'SW1A 1AA',
            'status': 'Active',
            'current_spend': 1000,
            'tagged_customers': False,
            'date_of_last_visit': '2024-01-01',
            'visit_frequency': 30,
            'next_due_date': '2024-02-01'
        },
        {
            'company': 'Test Company 2',
            'account_number': 'ACC002',
            'country': 'UK',
            'postcode': 'EC1A 1BB',
            'status': 'Active',
            'current_spend': 2000,
            'tagged_customers': False,
            'date_of_last_visit': '2024-01-15',
            'visit_frequency': 45,
            'next_due_date': '2024-03-01'
        },
        {
            'company': 'Test Company 3',
            'account_number': 'ACC003',
            'country': 'UK',
            'postcode': 'W1A 1AA',
            'status': 'Active',
            'current_spend': 1500,
            'tagged_customers': False,
            'date_of_last_visit': '2024-01-20',
            'visit_frequency': 60,
            'next_due_date': '2024-03-20'
        }
    ])


class TestGeocodePostcode:
    """Tests for geocode_postcode function"""
    
    @patch('app.geolocator.geocode')
    def test_geocode_success(self, mock_geocode):
        """Test successful geocoding"""
        # Mock a successful geocoding result
        mock_location = MagicMock()
        mock_location.latitude = 51.5074
        mock_location.longitude = -0.1278
        mock_geocode.return_value = mock_location
        
        # Clear cache to ensure fresh call
        geocode_postcode.cache_clear()
        
        result = geocode_postcode('SW1A 1AA', 'UK')
        
        assert result is not None
        assert result == (51.5074, -0.1278)
        mock_geocode.assert_called_once_with('SW1A 1AA, UK')
    
    @patch('app.geolocator.geocode')
    def test_geocode_no_results(self, mock_geocode):
        """Test geocoding with no results"""
        mock_geocode.return_value = None
        
        geocode_postcode.cache_clear()
        result = geocode_postcode('INVALID', 'UK')
        
        assert result is None
    
    @patch('app.geolocator.geocode')
    def test_geocode_exception(self, mock_geocode):
        """Test geocoding with exception"""
        mock_geocode.side_effect = Exception("Network error")
        
        geocode_postcode.cache_clear()
        result = geocode_postcode('SW1A 1AA', 'UK')
        
        assert result is None


class TestRouteOptimizeValidation:
    """Tests for route optimization input validation"""
    
    @patch('app.load_customers')
    def test_insufficient_waypoints_no_customers_no_postcodes(self, mock_load, client):
        """Test error when no customers and no postcodes provided"""
        mock_load.return_value = pd.DataFrame()
        
        response = client.post('/api/route/optimize', 
                             json={'customer_ids': []})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'at least 2 total waypoints' in data['error'].lower()
        assert 'current_waypoints' in data
        assert data['current_waypoints'] == 0
    
    @patch('app.load_customers')
    def test_insufficient_waypoints_one_customer_only(self, mock_load, client, mock_customers):
        """Test error when only one customer selected"""
        mock_load.return_value = mock_customers
        
        response = client.post('/api/route/optimize',
                             json={'customer_ids': [0]})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'at least 2 total waypoints' in data['error'].lower()
    
    @patch('app.load_customers')
    def test_insufficient_waypoints_one_postcode_only(self, mock_load, client):
        """Test error when only start postcode provided"""
        mock_load.return_value = pd.DataFrame()
        
        response = client.post('/api/route/optimize',
                             json={'customer_ids': [], 'start_postcode': 'SW1A 1AA'})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data


class TestRouteOptimizeGeocoding:
    """Tests for geocoding errors in route optimization"""
    
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_start_postcode_geocoding_failure_with_insufficient_customers(self, mock_load, mock_geocode, client, mock_customers):
        """Test error when start postcode cannot be geocoded and not enough customers"""
        mock_load.return_value = mock_customers
        
        # Mock geocoding to fail for start postcode and only succeed for one customer
        call_count = [0]
        def geocode_side_effect(postcode, country):
            if postcode == 'INVALID':
                return None
            call_count[0] += 1
            if call_count[0] == 1:
                return (51.5074, -0.1278)
            return None
        
        mock_geocode.side_effect = geocode_side_effect
        
        response = client.post('/api/route/optimize',
                             json={
                                 'customer_ids': [0, 1],
                                 'start_postcode': 'INVALID'
                             })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'failed_postcodes' in data
        assert data['valid_waypoints'] == 1
        assert 'suggestions' in data
    
    @patch('app.optimize_route_with_google_maps')
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_start_postcode_geocoding_failure_with_enough_customers(self, mock_load, mock_geocode, mock_google, client, mock_customers):
        """Test that route succeeds when start postcode fails but enough customer waypoints exist"""
        mock_load.return_value = mock_customers
        mock_google.return_value = ([], [])
        
        # Mock geocoding to fail for start postcode but succeed for customers
        def geocode_side_effect(postcode, country):
            if postcode == 'INVALID':
                return None
            return (51.5074, -0.1278)
        
        mock_geocode.side_effect = geocode_side_effect
        
        response = client.post('/api/route/optimize',
                             json={
                                 'customer_ids': [0, 1],
                                 'start_postcode': 'INVALID'
                             })
        
        # Should succeed because we have 2 valid customer waypoints
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'optimized_customers' in data
    
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_end_postcode_geocoding_failure_with_insufficient_customers(self, mock_load, mock_geocode, client, mock_customers):
        """Test error when end postcode cannot be geocoded and not enough customers"""
        mock_load.return_value = mock_customers
        
        # Fail end postcode and only succeed for one customer
        call_count = [0]
        def geocode_side_effect(postcode, country):
            if postcode == 'BAD_POSTCODE':
                return None
            call_count[0] += 1
            if call_count[0] == 1:
                return (51.5074, -0.1278)
            return None
        
        mock_geocode.side_effect = geocode_side_effect
        
        response = client.post('/api/route/optimize',
                             json={
                                 'customer_ids': [0, 1],
                                 'end_postcode': 'BAD_POSTCODE'
                             })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert data['valid_waypoints'] == 1
    
    @patch('app.optimize_route_with_google_maps')
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_end_postcode_geocoding_failure_with_enough_customers(self, mock_load, mock_geocode, mock_google, client, mock_customers):
        """Test that route succeeds when end postcode fails but enough customer waypoints exist"""
        mock_load.return_value = mock_customers
        mock_google.return_value = ([], [])
        
        def geocode_side_effect(postcode, country):
            if postcode == 'BAD_POSTCODE':
                return None
            return (51.5074, -0.1278)
        
        mock_geocode.side_effect = geocode_side_effect
        
        response = client.post('/api/route/optimize',
                             json={
                                 'customer_ids': [0, 1],
                                 'end_postcode': 'BAD_POSTCODE'
                             })
        
        # Should succeed because we have 2 valid customer waypoints
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'optimized_customers' in data
    
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_all_customer_postcodes_fail(self, mock_load, mock_geocode, client, mock_customers):
        """Test error when all customer postcodes fail to geocode"""
        mock_load.return_value = mock_customers
        
        # All geocoding fails
        mock_geocode.return_value = None
        
        response = client.post('/api/route/optimize',
                             json={'customer_ids': [0, 1, 2]})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'failed_customers' in data
        assert len(data['failed_customers']) == 3
        assert 'suggestions' in data
    
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_partial_customer_geocoding_failure(self, mock_load, mock_geocode, client, mock_customers):
        """Test when some customers geocode successfully but not enough for route"""
        mock_load.return_value = mock_customers
        
        # Only first customer succeeds, others fail
        call_count = [0]
        def geocode_side_effect(postcode, country):
            call_count[0] += 1
            if call_count[0] == 1:
                return (51.5074, -0.1278)
            return None
        
        mock_geocode.side_effect = geocode_side_effect
        
        response = client.post('/api/route/optimize',
                             json={'customer_ids': [0, 1, 2]})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert data['valid_waypoints'] == 1
        assert data['required_waypoints'] == 2


class TestRouteOptimizeSuccess:
    """Tests for successful route optimization"""
    
    @patch('app.optimize_route_with_google_maps')
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_successful_optimization_with_customers_only(self, mock_load, mock_geocode, mock_google, client, mock_customers):
        """Test successful optimization with only customers"""
        mock_load.return_value = mock_customers
        mock_geocode.return_value = (51.5074, -0.1278)
        mock_google.return_value = ([], [])
        
        response = client.post('/api/route/optimize',
                             json={'customer_ids': [0, 1]})
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'optimized_customers' in data
        assert 'waypoints' in data
    
    @patch('app.optimize_route_with_google_maps')
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_successful_optimization_with_start_postcode(self, mock_load, mock_geocode, mock_google, client, mock_customers):
        """Test successful optimization with start postcode"""
        mock_load.return_value = mock_customers
        mock_geocode.return_value = (51.5074, -0.1278)
        mock_google.return_value = ([], [])
        
        response = client.post('/api/route/optimize',
                             json={
                                 'customer_ids': [0, 1],
                                 'start_postcode': 'SW1A 1AA'
                             })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'start_postcode' in data
        assert data['start_postcode'] == 'SW1A 1AA'
    
    @patch('app.optimize_route_with_google_maps')
    @patch('app.geocode_postcode')
    @patch('app.load_customers')
    def test_successful_optimization_with_both_postcodes(self, mock_load, mock_geocode, mock_google, client, mock_customers):
        """Test successful optimization with start and end postcodes"""
        mock_load.return_value = mock_customers
        mock_geocode.return_value = (51.5074, -0.1278)
        mock_google.return_value = ([], [])
        
        response = client.post('/api/route/optimize',
                             json={
                                 'customer_ids': [0, 1],
                                 'start_postcode': 'SW1A 1AA',
                                 'end_postcode': 'EC1A 1BB'
                             })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['start_postcode'] == 'SW1A 1AA'
        assert data['end_postcode'] == 'EC1A 1BB'
