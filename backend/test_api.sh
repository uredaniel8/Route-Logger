#!/bin/bash

# Route Logger - Backend Test Script

echo "========================================"
echo "Route Logger - Backend API Tests"
echo "========================================"

BASE_URL="http://localhost:5000/api"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}PASSED${NC} (HTTP $http_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC} (HTTP $http_code)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Run tests
echo ""
echo "Starting tests..."
echo ""

# Test 1: Health Check
test_endpoint "Health Check" "GET" "/health"

# Test 2: Get All Customers
test_endpoint "Get All Customers" "GET" "/customers"

# Test 3: Get Overdue Customers
test_endpoint "Get Overdue Customers" "GET" "/overdue"

# Test 4: Create Groups
test_endpoint "Create Proximity Groups" "POST" "/groups" '{"max_distance_km": 10}'

# Test 5: Export CSV (just check if endpoint responds)
echo -n "Testing Export CSV... "
http_code=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/customers/export")
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}PASSED${NC} (HTTP $http_code)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}FAILED${NC} (HTTP $http_code)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi
