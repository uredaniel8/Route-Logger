import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import './MapView.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278,
};

function MapView({ customers, selectedCustomers, onSelectionChange }) {
  const [map, setMap] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [customerLocations, setCustomerLocations] = useState([]);

  useEffect(() => {
    // In a real app, you would geocode postcodes here
    // For now, we'll use mock coordinates around London
    const mockLocations = customers.map((customer, index) => ({
      ...customer,
      lat: 51.5074 + (Math.random() - 0.5) * 0.2,
      lng: -0.1278 + (Math.random() - 0.5) * 0.2,
      index,
    }));
    setCustomerLocations(mockLocations);
  }, [customers]);

  const onLoad = useCallback((map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

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
      </div>

      {GOOGLE_MAPS_API_KEY ? (
        <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={11}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            {customerLocations.map((location) => (
              <Marker
                key={location.index}
                position={{ lat: location.lat, lng: location.lng }}
                onClick={() => handleMarkerClick(location)}
                icon={getMarkerColor(location)}
              />
            ))}

            {selectedMarker && (
              <InfoWindow
                position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div className="info-window">
                  <h3>{selectedMarker.company}</h3>
                  <p><strong>Account:</strong> {selectedMarker.account_number}</p>
                  <p><strong>Postcode:</strong> {selectedMarker.postcode}</p>
                  <p><strong>Tier:</strong> {selectedMarker.tagged_customers}</p>
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
            <h3>Google Maps API Key Required</h3>
            <p>To view the interactive map, please add your Google Maps API key to the environment variables.</p>
            <p>Set <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file.</p>
            <div className="mock-map">
              <h4>Mock Customer Locations</h4>
              <ul>
                {customers.slice(0, 5).map((customer, index) => (
                  <li key={index}>
                    {customer.company} - {customer.postcode}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapView;
