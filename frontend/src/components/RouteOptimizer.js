import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import './RouteOptimizer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Cache for geocoded coordinates to avoid redundant API calls
const geocodeCache = new Map();

const routeMapContainerStyle = {
  width: '100%',
  height: '800px',
  marginTop: '20px',
};

// UK postcode validation regex (basic format check)
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;

function RouteOptimizer({ customers, selectedCustomers, onSelectionChange }) {
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startPostcode, setStartPostcode] = useState('');
  const [endPostcode, setEndPostcode] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 56.4907, lng: -4.2026 });
  const [geocoding, setGeocoding] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState(false);

  const handleOptimizeRoute = async () => {
    // Validate postcodes format before sending request (basic validation)
    
    if (startPostcode && !UK_POSTCODE_REGEX.test(startPostcode.trim())) {
      setError('Start postcode format appears invalid. UK postcodes should follow the format: SW1A 1AA');
      return;
    }
    
    if (endPostcode && !UK_POSTCODE_REGEX.test(endPostcode.trim())) {
      setError('End postcode format appears invalid. UK postcodes should follow the format: SW1A 1AA');
      return;
    }
    
    // Count total waypoints: customers + optional start/end postcodes
    const totalWaypoints = selectedCustomers.length + (startPostcode ? 1 : 0) + (endPostcode ? 1 : 0);
    
    if (totalWaypoints < 2) {
      setError('Please select customers or provide start/end postcodes (minimum 2 total waypoints)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        customer_ids: selectedCustomers,
      };

      // Add start and end postcodes if provided
      if (startPostcode) {
        requestBody.start_postcode = startPostcode.trim();
      }
      if (endPostcode) {
        requestBody.end_postcode = endPostcode.trim();
      }

      const response = await fetch(`${API_URL}/route/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Format enhanced error messages
        let errorMessage = errorData.error || 'Failed to optimize route';
        
        if (errorData.details) {
          errorMessage += '\n\n' + errorData.details;
        }
        
        if (errorData.failed_postcodes && errorData.failed_postcodes.length > 0) {
          errorMessage += '\n\nFailed to geocode postcodes:';
          errorData.failed_postcodes.forEach(fp => {
            errorMessage += `\n- ${fp.value} (${fp.country})`;
          });
        }
        
        if (errorData.failed_customers && errorData.failed_customers.length > 0) {
          errorMessage += '\n\nFailed to geocode customer postcodes:';
          errorData.failed_customers.forEach(fc => {
            errorMessage += `\n- ${fc.company}: ${fc.postcode} (${fc.country})`;
          });
        }
        
        if (errorData.suggestions && errorData.suggestions.length > 0) {
          errorMessage += '\n\nSuggestions:';
          errorData.suggestions.forEach(suggestion => {
            errorMessage += '\n• ' + suggestion;
          });
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setOptimizedRoute(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRandomRoute = async (areaCode, maxCustomers) => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        area_code: areaCode,
        max_customers: maxCustomers,
      };

      const response = await fetch(`${API_URL}/route/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || 'Failed to generate random route';
        
        if (errorData.available_area_codes && errorData.available_area_codes.length > 0) {
          errorMessage += '\n\nAvailable area codes: ' + errorData.available_area_codes.join(', ');
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Update selected customers with the randomly generated list
      onSelectionChange(data.customer_ids);
      
      // Show success message
      const criteria = data.selection_criteria;
      const message = `Generated random route with ${data.count} customers\n` +
        `Prioritized by: ${criteria.prioritized_by.replace(/_/g, ' ')}\n` +
        (criteria.area_code_filter ? `Area code: ${criteria.area_code_filter}\n` : '') +
        '\nCustomers have been selected. Click "Optimize Route" to generate the optimized order.';
      
      alert(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReorderCustomer = (fromIndex, toIndex) => {
    if (!optimizedRoute) return;

    const newOrder = [...optimizedRoute.optimized_customers];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    setOptimizedRoute({
      ...optimizedRoute,
      optimized_customers: newOrder,
    });
  };

  // Geocode optimized route customers for map visualization with caching
  useEffect(() => {
    if (!optimizedRoute || !optimizedRoute.optimized_customers || !GOOGLE_MAPS_API_KEY) {
      setRouteCoordinates([]);
      return;
    }

    const geocodeRoute = async () => {
      setGeocoding(true);
      
      // Use Promise.all to parallelize geocoding requests, but check cache first
      const geocodePromises = optimizedRoute.optimized_customers.map(async (customer) => {
        const cacheKey = `${customer.postcode}|${customer.country || 'UK'}`;
        
        // Check cache first
        if (geocodeCache.has(cacheKey)) {
          const cached = geocodeCache.get(cacheKey);
          return {
            ...customer,
            lat: cached.lat,
            lng: cached.lng,
          };
        }
        
        try {
          const address = `${customer.postcode}, ${customer.country || 'UK'}`;
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            
            // Cache the result
            geocodeCache.set(cacheKey, { lat: location.lat, lng: location.lng });
            
            return {
              ...customer,
              lat: location.lat,
              lng: location.lng,
            };
          } else {
            // Log specific geocoding errors
            if (data.status === 'OVER_QUERY_LIMIT') {
              console.warn('Geocoding rate limit exceeded for:', customer.postcode);
            } else if (data.status === 'REQUEST_DENIED') {
              console.error('Geocoding request denied. Check API key permissions.');
            } else {
              console.warn(`Geocoding failed for ${customer.postcode}: ${data.status}`);
            }
            return null;
          }
        } catch (error) {
          console.error('Error geocoding customer:', customer.company, error);
          return null;
        }
      });
      
      const results = await Promise.all(geocodePromises);
      const coords = results.filter(coord => coord !== null);
      
      setRouteCoordinates(coords);
      setGeocoding(false);
      
      // Set map center to first coordinate
      if (coords.length > 0) {
        setMapCenter({ lat: coords[0].lat, lng: coords[0].lng });
      } else if (results.length > 0) {
        // Show error if all geocoding failed
        console.error('All geocoding requests failed. Unable to display route on map.');
      }
    };

    geocodeRoute();
  }, [optimizedRoute]);

  const calculateTotalDistance = () => {
    if (!optimizedRoute || !optimizedRoute.route_legs) return 0;
    return optimizedRoute.route_legs.reduce((total, leg) => {
      return total + (leg.distance?.value || 0);
    }, 0) / 1000; // Convert to km
  };

  const calculateTotalDuration = () => {
    if (!optimizedRoute || !optimizedRoute.route_legs) return 0;
    return optimizedRoute.route_legs.reduce((total, leg) => {
      return total + (leg.duration?.value || 0);
    }, 0) / 60; // Convert to minutes
  };

  const isOverdue = (nextDueDate) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  const selectedCustomersList = selectedCustomers.map(index => customers[index]);

  return (
    <div className="route-optimizer">
      <div className="optimizer-header">
        <h2>🗺️ Route Optimizer</h2>
        <p>Select customers from the table view, then optimize their visit route using Google Maps.</p>
        {selectedCustomers.length > 0 && (
          <div className="selection-summary">
            <span className="summary-badge">{selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected</span>
            {selectedCustomers.length >= 2 && (
              <span className="ready-badge">✓ Ready to optimize</span>
            )}
          </div>
        )}
        {selectedCustomers.length === 0 && (
          <div className="help-banner">
            <h4>💡 How to use the Route Optimizer:</h4>
            <ol>
              <li>Use the <strong>Random Route Generator</strong> below to automatically select customers, OR</li>
              <li>Go to the <strong>Customers</strong> tab and manually check the boxes next to customers you want to visit</li>
              <li>Optionally specify start/end postcodes for your journey</li>
              <li>Click <strong>Optimize Route</strong> to calculate the best order</li>
            </ol>
          </div>
        )}
      </div>

      <div className="optimizer-content">
        <div className="selection-panel">
          <h3>Route Configuration</h3>
          
          <div className="route-config">
            <div className="config-field">
              <label htmlFor="start-postcode">Start Postcode (Optional)</label>
              <input
                id="start-postcode"
                type="text"
                placeholder="e.g., SW1A 1AA"
                value={startPostcode}
                onChange={(e) => setStartPostcode(e.target.value)}
                className="postcode-input"
              />
              <small>Leave empty to start from the first customer. Use valid UK postcode format (e.g., SW1A 1AA)</small>
            </div>
            
            <div className="config-field">
              <label htmlFor="end-postcode">End Postcode (Optional)</label>
              <input
                id="end-postcode"
                type="text"
                placeholder="e.g., SW1A 1AA"
                value={endPostcode}
                onChange={(e) => setEndPostcode(e.target.value)}
                className="postcode-input"
              />
              <small>Leave empty to end at the last customer. Use valid UK postcode format (e.g., SW1A 1AA)</small>
            </div>
          </div>

          <div className="random-generator-section">
            <h3>🎲 Random Route Generator</h3>
            <p className="section-description">
              Automatically select customers who haven't been visited in the longest time, filtered by area code if specified.
              This helps ensure priority visits to customers who need attention.
            </p>
            
            <div className="route-config">
              <div className="config-field">
                <label htmlFor="random-area-code">
                  Area Code Filter (Optional)
                  <span className="info-tooltip" title="Filter customers by postal area code (e.g., SW for South West London, EC for East Central). Leave blank to include all customers.">ℹ️</span>
                </label>
                <input
                  id="random-area-code"
                  type="text"
                  placeholder="e.g., SW, EC, W"
                  className="postcode-input"
                />
                <small>Leave empty to include all area codes. Use standard UK postal area codes.</small>
              </div>
              
              <div className="config-field">
                <label htmlFor="random-max-customers">
                  Max Customers
                  <span className="info-tooltip" title="Maximum number of customers to include in the generated route">ℹ️</span>
                </label>
                <input
                  id="random-max-customers"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="10"
                  className="postcode-input"
                />
                <small>Number of customers to include (1-50). Prioritized by longest time since last visit.</small>
              </div>
            </div>
            
            <button 
              onClick={() => {
                const areaCode = document.getElementById('random-area-code').value.trim();
                const maxCustomers = parseInt(document.getElementById('random-max-customers').value) || 10;
                handleGenerateRandomRoute(areaCode, maxCustomers);
              }}
              disabled={loading}
              className="random-btn"
              title="Generate a random route based on visit priority"
            >
              {loading ? '⏳ Generating...' : '🎲 Generate Random Route'}
            </button>
          </div>

          <h3>Selected Customers ({selectedCustomers.length})</h3>
          {selectedCustomersList.length === 0 ? (
            <p className="no-selection">No customers selected. Go to the Customers tab to select customers.</p>
          ) : (
            <ul className="customer-list">
              {selectedCustomersList.map((customer, index) => (
                <li key={index} className={isOverdue(customer.next_due_date) ? 'overdue' : ''}>
                  <div className="customer-info">
                    <strong>{customer.company}</strong>
                    <span className="postcode">{customer.postcode}</span>
                    {isOverdue(customer.next_due_date) && <span className="overdue-badge">Overdue</span>}
                  </div>
                  <button 
                    onClick={() => onSelectionChange(selectedCustomers.filter((_, i) => i !== index))}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          
          <button 
            onClick={handleOptimizeRoute}
            disabled={(selectedCustomers.length + (startPostcode ? 1 : 0) + (endPostcode ? 1 : 0)) < 2 || loading}
            className="optimize-btn"
            title={
              (selectedCustomers.length + (startPostcode ? 1 : 0) + (endPostcode ? 1 : 0)) < 2 
                ? 'Select at least 2 customers or provide start/end postcodes' 
                : 'Optimize the route using Google Maps'
            }
          >
            {loading ? '⏳ Optimizing...' : '🚀 Optimize Route'}
          </button>
        </div>

        <div className="route-panel">
          <h3>Optimized Route</h3>
          
          {error && (
            <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>
          )}

          {optimizedRoute ? (
            <div className="route-result">
              <div className="route-stats">
                <div className="stat">
                  <span className="stat-label">Total Distance:</span>
                  <span className="stat-value">{calculateTotalDistance().toFixed(2)} km</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Estimated Time:</span>
                  <span className="stat-value">{calculateTotalDuration().toFixed(0)} minutes</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Stops:</span>
                  <span className="stat-value">{optimizedRoute.optimized_customers.length}</span>
                </div>
              </div>

              <div className="route-list">
                <h4>Visit Order</h4>
                <ol>
                  {optimizedRoute.optimized_customers.map((customer, index) => (
                    <li key={index} className={isOverdue(customer.next_due_date) ? 'overdue' : ''}>
                      <div className="route-stop">
                        <div className="stop-number">{index + 1}</div>
                        <div className="stop-info">
                          <strong>{customer.company}</strong>
                          <div className="stop-details">
                            <span>{customer.postcode}</span>
                            <span>•</span>
                            <span>Account: {customer.account_number}</span>
                            {isOverdue(customer.next_due_date) && (
                              <>
                                <span>•</span>
                                <span className="overdue-text">Overdue: {customer.next_due_date}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="stop-actions">
                          {index > 0 && (
                            <button 
                              onClick={() => handleReorderCustomer(index, index - 1)}
                              className="move-btn"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          {index < optimizedRoute.optimized_customers.length - 1 && (
                            <button 
                              onClick={() => handleReorderCustomer(index, index + 1)}
                              className="move-btn"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <button 
                onClick={() => {
                  const csv = [
                    ['Stop', 'Company', 'Account', 'Postcode', 'Next Due Date'],
                    ...optimizedRoute.optimized_customers.map((c, i) => [
                      i + 1,
                      c.company,
                      c.account_number,
                      c.postcode,
                      c.next_due_date,
                    ])
                  ].map(row => row.join(',')).join('\n');

                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'optimized_route.csv';
                  a.click();
                }}
                className="export-route-btn"
              >
                Export Route as CSV
              </button>

              {/* Route Visualization Map */}
              {GOOGLE_MAPS_API_KEY && !mapsLoadError && (
                <div className="route-map-container">
                  <h4>Route Visualization</h4>
                  {geocoding && (
                    <div className="loading-message" role="status" aria-live="polite">
                      <p>Loading map... Geocoding {optimizedRoute.optimized_customers.length} locations.</p>
                    </div>
                  )}
                  {routeCoordinates.length > 0 ? (
                    <LoadScript 
                      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
                      onError={() => {
                        console.error('Failed to load Google Maps API in RouteOptimizer');
                        setMapsLoadError(true);
                      }}
                    >
                      <GoogleMap
                        mapContainerStyle={routeMapContainerStyle}
                        center={mapCenter}
                        zoom={10}
                        onLoad={() => {}}
                        onUnmount={() => {}}
                      >
                        {/* Draw polyline connecting all stops */}
                        <Polyline
                          path={routeCoordinates.map(c => ({ lat: c.lat, lng: c.lng }))}
                          options={{
                            strokeColor: '#2196F3',
                            strokeOpacity: 0.8,
                            strokeWeight: 4,
                          }}
                        />
                        
                        {/* Add markers for each stop */}
                        {routeCoordinates.map((coord, index) => (
                          <Marker
                            key={index}
                            position={{ lat: coord.lat, lng: coord.lng }}
                            label={{
                              text: `${index + 1}`,
                              color: 'white',
                              fontWeight: 'bold',
                            }}
                            onClick={() => setSelectedMarker(coord)}
                          />
                        ))}

                        {/* InfoWindow for selected marker */}
                        {selectedMarker && (
                          <InfoWindow
                            position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                            onCloseClick={() => setSelectedMarker(null)}
                          >
                            <div>
                              <h4>{selectedMarker.company}</h4>
                              <p><strong>Postcode:</strong> {selectedMarker.postcode}</p>
                              <p><strong>Account:</strong> {selectedMarker.account_number}</p>
                            </div>
                          </InfoWindow>
                        )}
                      </GoogleMap>
                    </LoadScript>
                  ) : !geocoding && (
                    <div className="map-placeholder">
                      <p>Unable to display route map. Some locations could not be geocoded.</p>
                    </div>
                  )}
                </div>
              )}
              {GOOGLE_MAPS_API_KEY && mapsLoadError && (
                <div className="map-placeholder">
                  <h4>⚠️ Map Loading Error</h4>
                  <p>Failed to load Google Maps. Please check your API key configuration.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="no-route">
              <p>No optimized route yet. Select customers and click "Optimize Route" to generate a route.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RouteOptimizer;
