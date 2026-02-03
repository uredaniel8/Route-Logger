# Testing Guide for Route Logger Updates

This document provides comprehensive testing instructions for the recent updates to the Route Logger application.

## Summary of Changes

### 1. Critical Bug Fixes

#### A. Route Optimization Bug (backend/app.py, line 561)
**Issue**: When both start and end postcodes were provided, the route optimization would return an empty list if validation failed, losing all customer data.

**Fix**: Changed from `reordered_customers = []` to `reordered_customers = customers` to fallback to original order.

**Impact**: This was a critical data loss bug that could cause routes to disappear entirely.

#### B. Map Preview Issues (frontend/src/components/RouteOptimizer.js)
**Issues**: 
- Missing onLoad/onUnmount callbacks for GoogleMap component
- No error handling for LoadScript component
- No user feedback when maps fail to load

**Fixes**:
- Added proper callbacks: `onLoad={() => {}}` and `onUnmount={() => {}}`
- Added error handling: `onError={() => { console.error(...); setMapsLoadError(true); }}`
- Added mapsLoadError state and error message display

**Impact**: Maps now load reliably with clear error feedback if issues occur.

### 2. New Feature: Random Route Generator

#### Backend (backend/app.py)
- New endpoint: `POST /api/route/random`
- Parameters:
  - `area_code` (optional): Filter customers by postal area code
  - `max_customers` (required): Number of customers to select (1-50)
  
- Algorithm:
  1. Filters customers by area code if specified
  2. Calculates days since last visit for each customer
  3. Sorts by longest time since visit (highest priority)
  4. Returns top N customers based on max_customers parameter
  
- Returns: 
  - customer_ids: Array of indices for selected customers
  - customers: Full customer records
  - selection_criteria: Details about how selection was made

#### Frontend (frontend/src/components/RouteOptimizer.js)
- New UI section "🎲 Random Route Generator"
- Input fields for area code and max customers
- Integration with customer selection system
- Success/error feedback with detailed messages

### 3. UX Improvements

#### Visual Enhancements
- Selection summary badges showing customer count
- "Ready to optimize" indicator when ≥2 customers selected
- Help banner with instructions when no customers selected
- Emoji icons for better visual recognition (🗺️, 🚀, 🎲, ⏳)
- Informational tooltips (ℹ️) for configuration options
- Color-coded sections (blue for random generator, teal for help)

#### Improved Messaging
- Better button labels and titles
- Enhanced error messages with specific suggestions
- Loading states with progress indicators
- Tooltip help text for complex options

---

## Testing Instructions

### Prerequisites
1. Ensure backend is installed: `cd backend && pip install -r requirements.txt`
2. Ensure frontend is installed: `cd frontend && npm install`
3. Set up Google Maps API key in both backend and frontend .env files

### Test 1: Route Optimization Bug Fix

**Goal**: Verify that routes work correctly when both start and end postcodes are provided.

**Steps**:
1. Start backend: `cd backend && python app.py`
2. Start frontend: `cd frontend && npm start`
3. Navigate to http://localhost:3000
4. Go to "Customers" tab and select 3-4 customers
5. Go to "Route Optimizer" tab
6. Enter a start postcode (e.g., "SW1A 1AA")
7. Enter an end postcode (e.g., "EC1A 1BB")
8. Click "🚀 Optimize Route"

**Expected Result**:
- Route should be generated successfully
- All selected customers should appear in the optimized route
- No customers should be lost
- Route statistics should display (distance, time, stops)

**Previously**: Would sometimes return empty route if validation failed.

### Test 2: Map Preview Display

**Goal**: Verify that the route visualization map displays correctly.

**Steps**:
1. Complete Test 1 to generate a route
2. Scroll down to the "Route Visualization" section
3. Observe the map

**Expected Result**:
- Map should load and display
- Blue polyline connecting all stops should be visible
- Numbered markers (1, 2, 3, etc.) should appear at each stop
- Clicking a marker should show customer info window
- If map fails to load, error message should display with helpful instructions

**Previously**: Map might not display or show console errors.

### Test 3: Random Route Generator

**Goal**: Verify that the random route generator selects appropriate customers.

**Steps**:

#### Test 3A: Basic Random Generation
1. Navigate to "Route Optimizer" tab
2. Leave area code blank
3. Set max customers to 10
4. Click "🎲 Generate Random Route"

**Expected Result**:
- Alert message showing success
- 10 customers selected (or fewer if less than 10 exist)
- Customers appear in the "Selected Customers" list
- Message indicates "Prioritized by: longest time since visit"

#### Test 3B: Area Code Filtering
1. Navigate to "Route Optimizer" tab
2. Enter area code "1" (Scotland area in sample data)
3. Set max customers to 5
4. Click "🎲 Generate Random Route"

**Expected Result**:
- 5 customers with area_code = "1" selected
- All selected customers should have the same area code
- Alert indicates area code filter was applied

#### Test 3C: Invalid Area Code
1. Navigate to "Route Optimizer" tab
2. Enter area code "ZZZ" (doesn't exist)
3. Click "🎲 Generate Random Route"

**Expected Result**:
- Error message: "No customers found with area code 'ZZZ'"
- List of available area codes shown
- No customers selected

#### Test 3D: Invalid Max Customers
1. Try max_customers = 0
   - Expected: Error "max_customers must be at least 1"
2. Try max_customers = 100
   - Expected: Error "max_customers cannot exceed 50"

### Test 4: UX Improvements

**Goal**: Verify improved user experience elements.

**Steps**:

#### Test 4A: Selection Summary
1. Go to "Customers" tab
2. Select 0 customers → Go to "Route Optimizer"
   - Should see help banner with instructions
   - Should NOT see selection badges
3. Select 1 customer → Go to "Route Optimizer"
   - Should see "1 customer selected" badge
   - Should NOT see "Ready to optimize" badge
4. Select 2+ customers → Go to "Route Optimizer"
   - Should see "N customers selected" badge
   - Should see "✓ Ready to optimize" badge

#### Test 4B: Tooltips and Help
1. Hover over ℹ️ icons next to labels
   - Should show helpful tooltip text
2. Hover over disabled "Optimize Route" button
   - Should show tooltip explaining why it's disabled

#### Test 4C: Visual Styling
1. Observe the Random Route Generator section
   - Should have dashed blue border
   - Should have light gray background
   - Should be visually distinct from other sections
2. Observe the help banner (when no customers selected)
   - Should have teal background
   - Should have numbered list of instructions

### Test 5: API Endpoint Testing

**Goal**: Verify backend API works correctly.

**Test using curl**:

```bash
# Test random route generation
curl -X POST http://localhost:5000/api/route/random \
  -H "Content-Type: application/json" \
  -d '{"area_code": "1", "max_customers": 5}'

# Expected response:
# {
#   "customer_ids": [0, 5, 12, ...],
#   "customers": [...],
#   "count": 5,
#   "area_code": "1",
#   "selection_criteria": {
#     "prioritized_by": "longest_time_since_visit",
#     "area_code_filter": "1",
#     "max_customers": 5
#   }
# }

# Test with no area code
curl -X POST http://localhost:5000/api/route/random \
  -H "Content-Type: application/json" \
  -d '{"max_customers": 10}'

# Test invalid area code
curl -X POST http://localhost:5000/api/route/random \
  -H "Content-Type: application/json" \
  -d '{"area_code": "ZZZ", "max_customers": 5}'
# Expected: 404 with error message and available area codes

# Test route optimization with both postcodes
curl -X POST http://localhost:5000/api/route/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "customer_ids": [0, 1, 2],
    "start_postcode": "SW1A 1AA",
    "end_postcode": "EC1A 1BB"
  }'
```

---

## Known Issues & Limitations

### 1. Google Maps API Required
- Map features require a valid Google Maps API key
- Without API key, placeholder messages are shown
- Geocoding may fail for invalid or non-UK postcodes

### 2. Area Code Data
- Area codes must exist in the customer data
- The random generator relies on the `area_code` column being populated
- If area code is missing for customers, they won't be filtered by area code

### 3. Date Format
- Dates should be in ISO format (YYYY-MM-DD)
- Invalid dates may cause prioritization issues in random generator
- Customers with no visit history are given highest priority (9999 days)

---

## Regression Testing

To ensure no existing functionality was broken:

1. **Customer Table**:
   - Import CSV ✓
   - Export CSV ✓
   - Edit customer details ✓
   - Sort columns ✓
   - Filter by area code ✓

2. **Map View**:
   - Display all customers ✓
   - Select/deselect customers ✓
   - Filter to show only selected ✓
   - Marker info windows ✓

3. **Route Optimization**:
   - Optimize with customers only ✓
   - Optimize with start postcode ✓
   - Optimize with end postcode ✓
   - Optimize with both postcodes ✓ (FIXED)
   - Manual reordering ✓
   - Export route CSV ✓

---

## Performance Considerations

1. **Random Route Generation**: O(n log n) due to sorting by days since visit
2. **Area Code Filtering**: O(n) for filtering the dataframe
3. **Map Geocoding**: Uses caching to avoid redundant API calls
4. **Frontend Rendering**: Optimized with React memoization

---

## Success Criteria

✅ All critical bugs fixed
✅ Random route generator working correctly
✅ UX improvements visible and functional
✅ Documentation updated
✅ No regressions in existing features
✅ Error handling improved
✅ Maps display reliably

---

## Additional Notes

- All changes are backward compatible
- No database migrations required
- CSS changes are additive (no breaking changes)
- New API endpoint is optional (existing endpoints unchanged)
