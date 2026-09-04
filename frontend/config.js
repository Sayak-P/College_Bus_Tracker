// Auto-detect API URL:
// - In production (deployed), the backend serves the frontend, so use relative URLs
// - In local development, connect to localhost:3000
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '';  // Empty string = same origin (relative URLs) in production
