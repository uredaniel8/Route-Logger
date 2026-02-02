"""
Production configuration for Route Logger Backend
"""

import os
from app import app

if __name__ == '__main__':
    # Use production settings
    app.config['DEBUG'] = False
    app.config['TESTING'] = False
    
    # Get port from environment variable
    port = int(os.environ.get('PORT', 5000))
    
    # Note: In production, use a WSGI server like Gunicorn
    # Example: gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
    app.run(host='0.0.0.0', port=port)
