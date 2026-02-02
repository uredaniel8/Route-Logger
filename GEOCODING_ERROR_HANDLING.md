# Geocoding and Error Handling

This document describes the geocoding error handling improvements implemented in the Route Logger application.

## Overview

The route optimization functionality relies on geocoding postcodes to latitude/longitude coordinates. This document explains how the system handles geocoding failures and provides guidance for troubleshooting.

## Postcode Validation

Before attempting to geocode a postcode, the system performs basic format validation:

### Validation Rules

1. **Empty Check**: Postcodes cannot be empty or contain only whitespace
2. **Length Check**: Postcodes must be between 3 and 15 characters
3. **Character Check**: Postcodes can only contain alphanumeric characters, spaces, and hyphens

### Invalid Postcode Examples

- ❌ Empty string or `None`
- ❌ `"AB"` (too short, < 3 characters)
- ❌ `"ABCDEFGHIJKLMNOPQRST"` (too long, > 15 characters)
- ❌ `"SW1A!1AA"` (invalid characters)

### Valid Postcode Examples

- ✅ `"SW1A 1AA"` (UK format with space)
- ✅ `"SW1A1AA"` (UK format without space)
- ✅ `"10001"` (US ZIP code)
- ✅ `"M5H 2N2"` (Canadian postal code)

## Geocoding Process

When a route optimization request is received:

1. **Input Validation**: Check that at least 2 waypoints are requested
2. **Postcode Validation**: Validate format of all postcodes (start, end, and customer postcodes)
3. **Geocoding Attempts**: Try to geocode each valid postcode
4. **Statistics Tracking**: Track success/failure rates
5. **Error Reporting**: Provide detailed error messages if insufficient waypoints are geocoded

## Error Handling

### Graceful Degradation

The system is designed to handle partial geocoding failures:

- If start/end postcodes fail but enough customer locations succeed, the route proceeds
- If some customer postcodes fail but enough remain (≥2 total waypoints), the route proceeds
- Only when fewer than 2 total waypoints are successfully geocoded does the route fail

### Error Response Structure

When a route optimization fails due to geocoding issues, the response includes:

```json
{
  "error": "Need at least 2 valid locations after geocoding",
  "details": "Some postcodes could not be geocoded...",
  "valid_waypoints": 1,
  "required_waypoints": 2,
  "geocoding_stats": {
    "total_attempted": 5,
    "successful": 1,
    "failed": 4
  },
  "summary": [
    "Geocoding succeeded for 1 out of 5 locations (20%)"
  ],
  "failed_postcodes": [
    {
      "type": "start_postcode",
      "value": "INVALID",
      "country": "UK"
    }
  ],
  "failed_customers": [
    {
      "company": "Customer Name",
      "postcode": "BAD CODE",
      "country": "UK"
    }
  ],
  "failed_customers_formatted": "- Customer Name: BAD CODE (UK)\n...",
  "suggestions": [
    "Verify the postcode format is correct (e.g., 'SW1A 1AA' for UK)",
    "Ensure the country is specified correctly",
    "Try using a different postcode or customer location",
    "Check customer postcode data for accuracy",
    "Consider selecting different customers with valid postcodes"
  ]
}
```

## Logging

The system provides detailed logging at multiple levels:

### Info Level Logs

- Successful geocoding: `"Successfully geocoded 'SW1A 1AA' (UK) to 51.5074, -0.1278"`
- Route optimization statistics: `"Route optimization successful - 5 waypoints, 3 customers, Geocoding success rate: 100%"`

### Warning Level Logs

- Validation failures: `"Postcode validation failed for 'AB' (UK): Postcode too short (length: 2)"`
- Geocoding failures: `"Geocoding service returned no results for postcode: 'INVALID' (UK)"`
- Customer failures: `"Could not geocode customer postcode: 'BAD' (UK) for Test Company"`

### Error Level Logs

- Route optimization failures: `"Route optimization failed: insufficient valid waypoints (1/5)"`
- Detailed failure information including failed postcodes and customers

## Common Issues and Solutions

### Issue: "Postcode too short"

**Cause**: Postcode has fewer than 3 characters

**Solution**: Verify the postcode data in your customer records. UK postcodes typically have 5-8 characters.

### Issue: "Geocoding service returned no results"

**Cause**: The postcode is valid in format but cannot be found by the geocoding service

**Solutions**:
1. Verify the postcode exists and is current
2. Check if the country is correct
3. Try reformatting the postcode (e.g., add or remove spaces)
4. Consider using a nearby postcode for the same area

### Issue: "Postcode contains invalid characters"

**Cause**: Postcode contains special characters other than alphanumeric, spaces, or hyphens

**Solution**: Remove or replace invalid characters from the postcode in your customer data.

### Issue: Multiple customer postcodes failing

**Cause**: Customer data may have been imported incorrectly or is outdated

**Solutions**:
1. Review the CSV import data for accuracy
2. Check that postcodes weren't corrupted during import
3. Verify postcodes against an official postal code database
4. Update customer records with current postcodes

## Best Practices

### Data Quality

1. **Validate on Import**: Check postcode formats when importing customer data
2. **Regular Updates**: Periodically verify customer postcodes are current
3. **Use Full Format**: Include spaces in UK postcodes (e.g., "SW1A 1AA" not "SW1A1AA")
4. **Specify Country**: Always provide the country field for better geocoding accuracy

### Route Planning

1. **Select More Customers**: If some postcodes might fail, select more customers than the minimum required
2. **Test First**: Test geocoding with a small batch before creating large routes
3. **Monitor Logs**: Review application logs to identify recurring geocoding issues
4. **Use Start/End**: Provide start and/or end postcodes to increase total waypoint count

### Troubleshooting

1. **Check Error Response**: Review the `failed_customers` and `failed_postcodes` fields
2. **Review Suggestions**: Follow the actionable suggestions in the error response
3. **Test Individual Postcodes**: Try geocoding problematic postcodes individually
4. **Update Data**: Correct invalid postcodes in your customer database

## Technical Details

### Geocoding Service

The application uses **Nominatim** (OpenStreetMap's geocoding service) via the `geopy` library:

- **User Agent**: `route_logger`
- **Cache Size**: 1000 postcodes (LRU cache)
- **Timeout**: Default (set by geopy)

### Rate Limiting

Nominatim has usage policies:
- Maximum 1 request per second
- For high-volume usage, consider using a dedicated instance or commercial service

### Caching

Geocoding results are cached using LRU (Least Recently Used) caching:
- **Cache Size**: 1000 entries
- **Benefit**: Faster repeated lookups, reduced API calls
- **Note**: Cache is cleared when the application restarts

## Future Improvements

Potential enhancements for geocoding error handling:

1. **Alternative Geocoding Services**: Fallback to Google Maps Geocoding API if Nominatim fails
2. **Postcode Correction**: Suggest corrections for common postcode errors
3. **Batch Validation**: Pre-validate all customer postcodes before route planning
4. **Custom Validation Rules**: Country-specific postcode format validation
5. **Geocoding Retry**: Automatic retry with exponential backoff for transient failures

## Support

If you continue to experience geocoding issues after following this guide:

1. Check the application logs for detailed error messages
2. Verify your customer data is formatted correctly
3. Test with known valid postcodes
4. Open an issue on the GitHub repository with:
   - The error response
   - Example postcodes that are failing
   - Your country/region
   - Any relevant log messages
