# Raw JSON Import Feature - Testing Guide

## Overview
The Route Logger application now supports importing customer data via raw JSON in addition to CSV files.

## Feature Details

### Endpoint
- **URL**: `POST /api/customers/import/raw`
- **Content-Type**: `application/json`
- **Request Body**: JSON array of customer objects

### Frontend UI
- Located in the "Customers" tab toolbar
- Button labeled "Import Raw JSON"
- Prompts user to paste JSON data
- Validates JSON before submission

## Example Usage

### 1. Valid JSON Import

**Sample Data:**
```json
[
  {
    "company": "Test Company Alpha",
    "account_number": "TEST001",
    "country": "UK",
    "postcode": "SW1A 1AA",
    "status": "Active",
    "current_spend": 15000,
    "tagged_customers": "Standard",
    "multi_site": "No",
    "area_code": "SW",
    "date_of_last_visit": "2024-02-01",
    "visit_frequency": 30
  },
  {
    "company": "Test Company Beta",
    "account_number": "TEST002",
    "country": "UK",
    "postcode": "EC1A 1BB",
    "status": "Active",
    "current_spend": 25000,
    "tagged_customers": "Premium",
    "multi_site": "Yes",
    "area_code": "EC",
    "date_of_last_visit": "2024-01-15",
    "visit_frequency": 45
  }
]
```

**Expected Response:**
```json
{
  "message": "Imported 2 customers successfully"
}
```

### 2. Using cURL

```bash
curl -X POST http://localhost:5000/api/customers/import/raw \
  -H "Content-Type: application/json" \
  -d '[
    {
      "company": "Test Company",
      "account_number": "TEST001",
      "country": "UK",
      "postcode": "SW1A 1AA",
      "status": "Active",
      "current_spend": 15000,
      "tagged_customers": "Standard",
      "multi_site": "No",
      "area_code": "SW",
      "date_of_last_visit": "2024-02-01",
      "visit_frequency": 30
    }
  ]'
```

### 3. Using JavaScript/Fetch

```javascript
const customers = [
  {
    company: "Test Company",
    account_number: "TEST001",
    country: "UK",
    postcode: "SW1A 1AA",
    status: "Active",
    current_spend: 15000,
    tagged_customers: "Standard",
    multi_site: "No",
    area_code: "SW",
    date_of_last_visit: "2024-02-01",
    visit_frequency: 30
  }
];

fetch('/api/customers/import/raw', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customers)
})
  .then(response => response.json())
  .then(data => console.log(data));
```

## Error Handling

### Error Case 1: No Data
**Request:** `null` or missing body
**Response:**
```json
{
  "error": "No data provided"
}
```
**Status Code:** 400

### Error Case 2: Invalid Data Type
**Request:** Single object instead of array
```json
{
  "company": "Test Company"
}
```
**Response:**
```json
{
  "error": "Data must be an array of customer objects"
}
```
**Status Code:** 400

### Error Case 3: Empty Array
**Request:** `[]`
**Response:**
```json
{
  "error": "Data array is empty"
}
```
**Status Code:** 400

### Error Case 4: Invalid JSON Format
**Request:** Malformed JSON
**Response:**
```json
{
  "error": "Expecting property name enclosed in double quotes: line 1 column 2 (char 1)"
}
```
**Status Code:** 400

## Required Fields

The following fields are expected in each customer object:
- `company` - Company name
- `account_number` - Unique account identifier
- `country` - Country code (e.g., "UK")
- `postcode` - Postal code

## Optional Fields

- `status` - Customer status (e.g., "Active")
- `current_spend` - Annual spending amount
- `tagged_customers` - Tier level (e.g., "Premium", "Standard")
- `multi_site` - Multiple locations flag ("Yes"/"No")
- `area_code` - Area code
- `date_of_last_visit` - Last visit date (YYYY-MM-DD format)
- `visit_frequency` - Days between visits (integer)
- `next_due_date` - Next scheduled visit (YYYY-MM-DD format)

## Advantages Over CSV Import

1. **No File Required**: Direct paste of JSON data
2. **API Integration**: Easier to integrate with other systems
3. **Programmatic Access**: Better for automation and scripts
4. **Immediate Feedback**: Real-time validation and error messages
5. **Version Control**: JSON can be easily tracked in version control systems

## Testing Checklist

- [ ] Import valid JSON array with multiple customers
- [ ] Import single customer in array
- [ ] Test with missing optional fields
- [ ] Test with invalid JSON (should show error)
- [ ] Test with empty array (should show error)
- [ ] Test with non-array data (should show error)
- [ ] Verify existing CSV import still works
- [ ] Check that imported data appears in customer table
- [ ] Verify next_due_date is calculated automatically if not provided

## Security Notes

✅ **Passed Security Scan**: CodeQL analysis found 0 vulnerabilities
- Input validation performed on server side
- Data type checking prevents injection attacks
- Error messages don't expose sensitive information
- Uses pandas DataFrame for safe data handling

## Support

For issues or questions, please refer to:
- API_DOCUMENTATION.md for detailed API specs
- README.md for general usage instructions
- Open an issue on the GitHub repository
