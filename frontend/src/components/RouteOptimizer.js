import React, { useState } from 'react';
import './RouteOptimizer.css';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function RouteOptimizer({ customers, selectedCustomers, onSelectionChange }) {
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleOptimizeRoute = async () => {
    if (selectedCustomers.length < 2) {
      setError('Please select at least 2 customers to optimize a route');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/route/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_ids: selectedCustomers }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize route');
      }

      const data = await response.json();
      setOptimizedRoute(data);
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
        <h2>Route Optimizer</h2>
        <p>Select customers from the table view, then optimize their visit route.</p>
      </div>

      <div className="optimizer-content">
        <div className="selection-panel">
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
            disabled={selectedCustomers.length < 2 || loading}
            className="optimize-btn"
          >
            {loading ? 'Optimizing...' : 'Optimize Route'}
          </button>
        </div>

        <div className="route-panel">
          <h3>Optimized Route</h3>
          
          {error && (
            <div className="error-message">{error}</div>
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
