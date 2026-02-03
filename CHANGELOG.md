# Changelog

All notable changes to the Route Logger project will be documented in this file.

## [Unreleased] - 2026-02-03

### Added
- **Random Route Generator**: New feature to automatically select customers for visits
  - Prioritizes customers who haven't been visited in the longest time
  - Optional area code filtering to keep routes geographically manageable
  - Configurable maximum number of customers (1-50)
  - Accessible from the Route Optimizer tab with clear UI
  - Full API endpoint: `POST /api/route/random`

### Fixed
- **Critical Route Optimization Bug**: Fixed incorrect customer reordering when both start and end postcodes are provided
  - Previously returned empty list on validation failure, losing customer data
  - Now correctly falls back to original customer order
  - Ensures consistent behavior across all route optimization scenarios

- **Map Preview Display Issues**:
  - Added proper onLoad/onUnmount callbacks to GoogleMap components
  - Added error handling for LoadScript component in RouteOptimizer
  - Added mapsLoadError state with user-friendly error messages
  - Map now displays reliably with proper error feedback

### Improved
- **User Experience Enhancements**:
  - Added visual selection summary showing number of selected customers
  - Added "Ready to optimize" indicator when sufficient customers are selected
  - Added helpful instructions banner when no customers are selected
  - Improved button labels with emojis for better visual recognition (🚀, 🎲, ⏳)
  - Added informational tooltips (ℹ️) for configuration options
  - Enhanced loading states with progress indicators
  - Improved error messages with specific suggestions
  - Better color-coded UI sections for different functionalities

- **Documentation**:
  - Updated README with Random Route Generator usage instructions
  - Added API documentation for new random route endpoint
  - Included example request/response formats
  - Added use cases for the random generator feature

### Technical Improvements
- Standardized fallback behavior in route optimization logic
- Enhanced error handling throughout the application
- Improved CSS styling with better visual hierarchy
- Added accessibility improvements with ARIA labels and tooltips

## Previous Versions

See git history for changes in previous versions.
