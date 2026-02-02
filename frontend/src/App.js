import React, { useState, useEffect } from 'react';
import CustomerTable from './components/CustomerTable';
import MapView from './components/MapView';
import RouteOptimizer from './components/RouteOptimizer';
import './App.css';

// IMPORTANT:
// If you don't set REACT_APP_API_URL, we default to Flask on localhost:5000
// You can override via frontend/.env
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

async function readJsonSafe(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('application/json')) {
    // This is the classic "Unexpected token <" problem: HTML came back
    throw new Error(`Expected JSON but got: ${text.slice(0, 120)}...`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON returned: ${text.slice(0, 120)}...`);
  }
}

function App() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [activeView, setActiveView] = useState('table');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/customers`);
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt.slice(0, 200)}`);
      }
      const data = await readJsonSafe(response);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load customers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerUpdate = async (customerId, updatedData) => {
    try {
      const response = await fetch(`${API_URL}/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        fetchCustomers();
      } else {
        const txt = await response.text();
        setError(`Failed to update customer: HTTP ${response.status} ${txt.slice(0, 200)}`);
      }
    } catch (err) {
      setError('Error updating customer: ' + err.message);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_URL}/customers/export`);
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt.slice(0, 200)}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export customers: ' + err.message);
    }
  };

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/customers/import`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await readJsonSafe(response);
        fetchCustomers();
        alert(result.message || 'Customers imported successfully');
      } else {
        const txt = await response.text();
        setError(`Failed to import customers: HTTP ${response.status} ${txt.slice(0, 200)}`);
      }
    } catch (err) {
      setError('Error importing customers: ' + err.message);
    }
  };

  const handleImportRaw = async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);

      const response = await fetch(`${API_URL}/customers/import/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await readJsonSafe(response);
        fetchCustomers();
        alert(result.message || 'Imported');
      } else {
        const txt = await response.text();
        setError(`Failed to import customers: HTTP ${response.status} ${txt.slice(0, 200)}`);
      }
    } catch (err) {
      setError('Error importing customers: ' + err.message);
    }
  };

  const handleCreateGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_distance_km: 10 }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt.slice(0, 200)}`);
      }

      const groups = await readJsonSafe(response);
      alert(`Created ${groups.length} customer groups based on proximity`);
    } catch (err) {
      setError('Failed to create groups: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Route Logger</h1>
        <nav className="App-nav">
          <button className={activeView === 'table' ? 'active' : ''} onClick={() => setActiveView('table')}>
            Customers
          </button>
          <button className={activeView === 'map' ? 'active' : ''} onClick={() => setActiveView('map')}>
            Map View
          </button>
          <button className={activeView === 'route' ? 'active' : ''} onClick={() => setActiveView('route')}>
            Route Optimizer
          </button>
        </nav>
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <main className="App-main">
        {loading && <div className="loading">Loading...</div>}

        {activeView === 'table' && (
          <div className="table-view">
            <div className="toolbar">
              <button onClick={handleExport}>Export CSV</button>

              <label className="file-upload">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                />
              </label>

              <button onClick={() => {
                const jsonData = prompt('Paste JSON array of customer objects:');
                if (jsonData) handleImportRaw(jsonData);
              }}>
                Import Raw JSON
              </button>

              <button onClick={handleCreateGroups}>Group by Proximity</button>
              <button onClick={fetchCustomers}>Refresh</button>
            </div>

            <CustomerTable
              customers={customers}
              selectedCustomers={selectedCustomers}
              onSelectionChange={setSelectedCustomers}
              onCustomerUpdate={handleCustomerUpdate}
            />
          </div>
        )}

        {activeView === 'map' && (
          <MapView
            customers={customers}
            selectedCustomers={selectedCustomers}
            onSelectionChange={setSelectedCustomers}
          />
        )}

        {activeView === 'route' && (
          <RouteOptimizer
            customers={customers}
            selectedCustomers={selectedCustomers}
            onSelectionChange={setSelectedCustomers}
          />
        )}
      </main>

      <footer className="App-footer">
        <p>Route Logger - Customer Route Planning System</p>
      </footer>
    </div>
  );
}

export default App;