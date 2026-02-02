import React, { useState } from 'react';
import './CustomerTable.css';

function CustomerTable({ customers, selectedCustomers, onSelectionChange, onCustomerUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAreaCode, setFilterAreaCode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedCustomers = React.useMemo(() => {
    let sorted = [...customers];
    
    // Apply filters
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      sorted = sorted.filter(customer => 
        (customer.company && customer.company.toLowerCase().includes(lowerSearchTerm)) ||
        (customer.account_number && customer.account_number.toLowerCase().includes(lowerSearchTerm)) ||
        (customer.postcode && customer.postcode.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    if (filterAreaCode) {
      sorted = sorted.filter(customer => 
        customer.tagged_customers && customer.tagged_customers.toLowerCase() === filterAreaCode.toLowerCase()
      );
    }
    
    if (filterStatus) {
      sorted = sorted.filter(customer => 
        customer.status && customer.status.toLowerCase() === filterStatus.toLowerCase()
      );
    }
    
    // Apply sorting
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [customers, sortConfig, searchTerm, filterAreaCode, filterStatus]);

  const handleCheckboxChange = (index, checked) => {
    if (checked) {
      onSelectionChange([...selectedCustomers, index]);
    } else {
      onSelectionChange(selectedCustomers.filter(i => i !== index));
    }
  };

  const handleEdit = (index, customer) => {
    setEditingId(index);
    setEditData(customer);
  };

  const handleSave = (index) => {
    onCustomerUpdate(index, editData);
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const isOverdue = (nextDueDate) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  // Get unique area codes and statuses for filter dropdowns
  const uniqueAreaCodes = React.useMemo(() => {
    const codes = customers.map(c => c.tagged_customers).filter(Boolean);
    return [...new Set(codes)].sort();
  }, [customers]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = customers.map(c => c.status).filter(Boolean);
    return [...new Set(statuses)].sort();
  }, [customers]);

  return (
    <div className="customer-table-container">
      <div className="filter-controls">
        <input
          type="text"
          placeholder="Search by company, account, or postcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filterAreaCode}
          onChange={(e) => setFilterAreaCode(e.target.value)}
          className="filter-select"
        >
          <option value="">All Area Codes</option>
          {uniqueAreaCodes.map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          {uniqueStatuses.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        {(searchTerm || filterAreaCode || filterStatus) && (
          <button 
            onClick={() => {
              setSearchTerm('');
              setFilterAreaCode('');
              setFilterStatus('');
            }}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        )}
      </div>
      <table className="customer-table">
        <thead>
          <tr>
            <th>Select</th>
            <th onClick={() => handleSort('company')} style={{ cursor: 'pointer' }}>
              Company {sortConfig.key === 'company' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th>Account #</th>
            <th>Country</th>
            <th>Postcode</th>
            <th>Status</th>
            <th>Current Spend</th>
            <th>Area Code</th>
            <th onClick={() => handleSort('date_of_last_visit')} style={{ cursor: 'pointer' }}>
              Last Visit {sortConfig.key === 'date_of_last_visit' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th>Frequency (days)</th>
            <th onClick={() => handleSort('next_due_date')} style={{ cursor: 'pointer' }}>
              Next Due {sortConfig.key === 'next_due_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedCustomers.map((customer, index) => (
            <tr key={index} className={isOverdue(customer.next_due_date) ? 'overdue' : ''}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedCustomers.includes(index)}
                  onChange={(e) => handleCheckboxChange(index, e.target.checked)}
                />
              </td>
              <td>{customer.company}</td>
              <td>{customer.account_number}</td>
              <td>{customer.country}</td>
              <td>{customer.postcode}</td>
              <td>{customer.status}</td>
              <td>£{customer.current_spend?.toLocaleString()}</td>
              <td>
                {editingId === index ? (
                  <input
                    type="text"
                    value={editData.tagged_customers || ''}
                    onChange={(e) => setEditData({ ...editData, tagged_customers: e.target.value })}
                  />
                ) : (
                  <span className={`area-code-badge ${typeof customer.tagged_customers === 'string' ? customer.tagged_customers.toLowerCase() : ''}`}>
                    {customer.tagged_customers}
                  </span>
                )}
              </td>
              <td>
                {editingId === index ? (
                  <input
                    type="date"
                    value={editData.date_of_last_visit || ''}
                    onChange={(e) => setEditData({ ...editData, date_of_last_visit: e.target.value })}
                  />
                ) : (
                  customer.date_of_last_visit
                )}
              </td>
              <td>
                {editingId === index ? (
                  <input
                    type="number"
                    value={editData.visit_frequency || ''}
                    onChange={(e) => setEditData({ ...editData, visit_frequency: e.target.value })}
                  />
                ) : (
                  customer.visit_frequency
                )}
              </td>
              <td className={isOverdue(customer.next_due_date) ? 'overdue-date' : ''}>
                {customer.next_due_date}
                {isOverdue(customer.next_due_date) && ' ⚠️'}
              </td>
              <td>
                {editingId === index ? (
                  <>
                    <button onClick={() => handleSave(index)} className="btn-save">Save</button>
                    <button onClick={handleCancel} className="btn-cancel">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => handleEdit(index, customer)} className="btn-edit">Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sortedCustomers.length === 0 && (
        <div className="no-data">No customers found</div>
      )}
    </div>
  );
}

export default CustomerTable;
