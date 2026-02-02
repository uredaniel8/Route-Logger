import csv
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)


def import_customers(file_path):
    required_fields = ['company', 'account_number', 'country', 'postcode']
    optional_defaults = {'multi_site': False, 'status': 'Unknown project status'}
    valid_records = []

    try:
        with open(file_path, mode='r') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Validate required fields
                for field in required_fields:
                    if not row[field]:
                        logging.error(f'Missing required field: {field} in row {row}')
                        continue
                # Validate numerical fields
                for field in ['current_spend', 'visit_frequency']:
                    if field in row and row[field]:
                        try:
                            row[field] = float(row[field])
                        except ValueError:
                            logging.error(f'Field {field} is not a number in row {row}')
                            continue
                # Validate date fields
                for field in ['date_of_last_visit', 'next_due_date']:
                    if field in row and row[field]:
                        try:
                            row[field] = datetime.strptime(row[field], '%d/%m/%Y').date()
                        except ValueError:
                            logging.error(f'Field {field} does not follow valid date format in row {row}')
                            continue
                    else:
                        row[field] = None  # Default fallback to NULL
                # Apply optional default values
                for field, default in optional_defaults.items():
                    if field not in row or not row[field]:
                        row[field] = default
                valid_records.append(row)
    except Exception as e:
        logging.error(f'Error processing the CSV file: {str(e)}')
        return {'error': 'Internal Server Error. Please check the server logs.'}
    return valid_records
