import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import './MapView.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState(null);

  const selectedCustomersSet = useMemo(() => new Set(selectedCustomers), [selectedCustomers]);

  // Prevent re-fetch loops: track if we already fetched for this customer count
  const lastFetchKeyRef = useRef(null);

  useEffect(() => {
    const count = customers?.length || 0;
    if (count === 0) {
      setCustomerLocations([]);
      setLocationsError(null);
      setLoadingLocations(false);
      return;
    }

    // Only refetch when the count changes (import/refresh), not when selection changes
    const fetchKey = `count:${count}`;
    if (lastFetchKeyRef.current === fetchKey && customerLocations.length > 0) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;

    const controller = new AbortController();

    const fetchLocations = async () => {
      setLoadingLocations(true);
      setLocationsError(null);

      try {
        const res = await fetch(`${API_URL}/customers/locations`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
        }

        const data = await res.json();
        const valid = Array.isArray(data)
          ? data.filter(x => typeof x.lat === 'number' && typeof x.lng === 'number')
          : [];

        setCustomerLocations(valid);

        // If selectedMarker no longer exists, close it
        if (selectedMarker) {
          const stillThere = valid.find(v => v.index === selectedMarker.index);
          if (!stillThere) setSelectedMarker(null);
        }
      } catch (err) {
        // If cancelled, do NOT treat as an error — just stop loading
        if (err?.name === 'AbortError') {
          return;
        }
        console.error('MapView: Failed to load customer locations:', err);
        setLocationsError(err?.message || 'Failed to load locations');
        // IMPORTANT: don’t wipe existing locations here — keep last known good map
      } finally {
        // CRITICAL: always clear loading, even if cancelled
        setLoadingLocations(false);
      }
    };

    fetchLocations();

    return () => {
      controller.abort();
      // Also ensure loading is cleared if we aborted mid-flight
      setLoadingLocations(false);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers?.length]); // selection changes do NOT trigger refetch

  const onLoad = useCallback(() => {}, []);
  const onUnmount = useCallback(() => {}, []);

  const handleMarkerClick = (location) => {
    setSelectedMarker(location);
  };

  const handleMarkerToggle = (index) => {
    if (selectedCustomersSet.has(index)) {
      onSelectionChange(selectedCustomers.filter(i => i !== index));
    } else {
      onSelectionChange([...selectedCustomers, index]);
    }
  };

  const getMarkerColor = (location) => {
    return selectedCustomersSet.has(location.index)
      ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
      : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
  };

  const isOverdue = (nextDueDate) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  const visibleLocations = useMemo(() => {
    if (!showOnlySelected) return customerLocations;
    return customerLocations.filter(loc => selectedCustomersSet.has(loc.index));
  }, [customerLocations, showOnlySelected, selectedCustomersSet]);

  const mappedCount = customerLocations.length;
  const totalCount = customers?.length || 0;

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

        <div className="info-message">
          <p>
            <strong>Mapped:</strong> {mappedCount}/{totalCount} customers with valid coordinates
            {mappedCount < totalCount && ' (some postcodes may be missing/invalid)'}
          </p>
          {loadingLocations && <p><em>Loading locations…</em></p>}
          {locationsError && <p style={{ color: '#b00020' }}><strong>Error:</strong> {locationsError}</p>}
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
          >
            {visibleLocations.map((location) => (
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
                  <p><strong>Area Code:</strong> {String(selectedMarker.tagged_customers ?? '')}</p>
                  <p><strong>Last Visit:</strong> {selectedMarker.date_of_last_visit}</p>
                  <p className={isOverdue(selectedMarker.next_due_date) ? 'overdue' : ''}>
                    <strong>Next Due:</strong> {selectedMarker.next_due_date}
                    {isOverdue(selectedMarker.next_due_date) && ' ⚠️'}
                  </p>
                  <button
                    onClick={() => handleMarkerToggle(selectedMarker.index)}
                    className="toggle-btn"
                  >
                    {selectedCustomersSet.has(selectedMarker.index) ? 'Deselect' : 'Select'}
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
            <p>Set <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code> and restart the frontend.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapView;