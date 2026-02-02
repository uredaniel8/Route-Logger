import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import './MapView.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Log Google Maps configuration for debugging
console.log('=== MapView Configuration ===');
console.log('Google Maps API Key:', GOOGLE_MAPS_API_KEY ? '✓ Set' : '✗ Not set');
console.log('API URL:', API_URL);
console.log('============================');

const mapContainerStyle = {
  width: '100%',
  height: '800px',
};

const defaultCenter = {
  lat: 56.4907,
  lng: -4.2026,
};

function MapView({ customers, selectedCustomers, onSelectionChange }) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [customerLocations, setCustomerLocations] = useState([]);
  const [mapsLoadError, setMapsLoadError] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  useEffect(() => {
    console.log('MapView: Processing', customers.length, 'customers');
    if (customers.length === 0) {
      setCustomerLocations([]);
      return;
    }

    // Use Google Maps Geocoding API to get real coordinates
    const geocodeCustomers = async () => {
      const locationsPromises = customers.map(async (customer, index) => {
        try {
          if (!customer.postcode) {
            console.warn('Customer missing postcode:', customer.company);
            return null;
          }

          // Use Google Maps Geocoding API
          const address = `${customer.postcode}, ${customer.country || 'UK'}`;
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return {
              ...customer,
              lat: location.lat,
              lng: location.lng,
              index,
            };
          } else {
            console.warn('Geocoding failed for:', customer.postcode, data.status);
            return null;
          }
        } catch (error) {
          console.error('Error geocoding customer:', customer.company, error);
          return null;
        }
      });

      const locations = await Promise.all(locationsPromises);
      const validLocations = locations.filter(loc => loc !== null);
      setCustomerLocations(validLocations);
      console.log('MapView: Successfully geocoded', validLocations.length, 'out of', customers.length, 'customers');
    };

    if (GOOGLE_MAPS_API_KEY) {
      geocodeCustomers();
    } else {
      // Fallback to mock locations if no API key
      const mockLocations = customers.map((customer, index) => ({
        ...customer,
        lat: 56.4907 + (Math.random() - 0.5) * 2.0,
        lng: -4.2026 + (Math.random() - 0.5) * 2.0,
        index,
      }));
      setCustomerLocations(mockLocations);
      console.log('MapView: Using mock locations (no API key)');
    }
  }, [customers]);

  // Note: GoogleMap component requires onLoad and onUnmount callbacks even if not used
  // These satisfy the component's API requirements
  const onLoad = useCallback(() => {}, []);
  const onUnmount = useCallback(() => {}, []);

  const handleMarkerClick = (location) => {
    setSelectedMarker(location);
  };

  const handleMarkerToggle = (index) => {
    if (selectedCustomers.includes(index)) {
      onSelectionChange(selectedCustomers.filter(i => i !== index));
    } else {
      onSelectionChange([...selectedCustomers, index]);
    }
  };

  const getMarkerColor = (location) => {
    if (selectedCustomers.includes(location.index)) {
      return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
    }
    return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
  };

  const isOverdue = (nextDueDate) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  return (
    <div className="map-view">
      <div className="map-controls">
        <h2>Customer Map View</h2>
        <p>Click markers to view customer details. Selected customers appear in green.</p>
        {customers.length === 0 && (
          <div className="info-message">
            <p><strong>No customers to display.</strong> Import customers from the Customers tab first.</p>
          </div>
        )}
        <div className="legend">
          <div className="legend-item">
            <span className="legend-color red"></span>
            <span>Not Selected</span>
          </div>
          <div className="legend-item">
            <span className="legend-color green"></span>
            <span>Selected</span>
          </div>
        </div>
        <div className="toggle-controls">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showOnlySelected}
              onChange={(e) => setShowOnlySelected(e.target.checked)}
              className="toggle-checkbox"
            />
            <span>Show Only Selected Customers</span>
          </label>
        </div>
      </div>

      {GOOGLE_MAPS_API_KEY && !mapsLoadError ? (
        <LoadScript 
          googleMapsApiKey={GOOGLE_MAPS_API_KEY}
          onError={() => {
            console.error('Failed to load Google Maps API');
            setMapsLoadError(true);
          }}
        >
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={6}
            onLoad={onLoad}
            onUnmount={onUnmount}
            key={`map-${customers.length}`}
          >
            {customerLocations
              .filter(location => !showOnlySelected || selectedCustomers.includes(location.index))
              .map((location) => (
                <Marker
                  key={location.index}
                  position={{ lat: location.lat, lng: location.lng }}
                  onClick={() => handleMarkerClick(location)}
                  icon={getMarkerColor(location)}
                />
              ))
            }

            {selectedMarker && (
              <InfoWindow
                position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div className="info-window">
                  <h3>{selectedMarker.company}</h3>
                  <p><strong>Account:</strong> {selectedMarker.account_number}</p>
                  <p><strong>Postcode:</strong> {selectedMarker.postcode}</p>
                  <p><strong>Area Code:</strong> {selectedMarker.tagged_customers}</p>
                  <p><strong>Last Visit:</strong> {selectedMarker.date_of_last_visit}</p>
                  <p className={isOverdue(selectedMarker.next_due_date) ? 'overdue' : ''}>
                    <strong>Next Due:</strong> {selectedMarker.next_due_date}
                    {isOverdue(selectedMarker.next_due_date) && ' ⚠️'}
                  </p>
                  <button 
                    onClick={() => handleMarkerToggle(selectedMarker.index)}
                    className="toggle-btn"
                  >
                    {selectedCustomers.includes(selectedMarker.index) ? 'Deselect' : 'Select'}
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      ) : (
        <div className="map-placeholder">
          <div className="map-placeholder-content">
            <h3>⚠️ Google Maps API Key Required</h3>
            <p>To view the interactive map, please add your Google Maps API key to the environment variables.</p>
            <p>Set <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file.</p>
            <p><strong>Steps to configure:</strong></p>
            <ol style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
              <li>Copy <code>frontend/.env.example</code> to <code>frontend/.env</code></li>
              <li>Add your Google Maps API key</li>
              <li>Restart the development server</li>
            </ol>
            {customers.length > 0 && (
              <div className="mock-map">
                <h4>Customer List (showing first 10)</h4>
                <ul style={{ textAlign: 'left', maxWidth: '500px', margin: '1rem auto' }}>
                  {customers.slice(0, 10).map((customer, index) => (
                    <li key={index}>
                      {customer.company} - {customer.postcode}
                      {isOverdue(customer.next_due_date) && ' ⚠️ Overdue'}
                    </li>
                  ))}
                  {customers.length > 10 && <li><em>...and {customers.length - 10} more</em></li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MapView;
