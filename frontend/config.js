// Auto-detect API URL:
// - In production (deployed), the backend serves the frontend, so use relative URLs
// - In local development, connect to localhost:3000
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '';  // Empty string = same origin (relative URLs) in production

// Self-XSS Warning (Facebook/Discord style)
setTimeout(() => {
    console.log(
        "%cWARNING!", 
        "color: red; background: yellow; font-size: 40px; font-weight: bold; padding: 5px 15px; font-family: sans-serif;"
    );
    console.log(
        "%cUsing this console may allow attackers to impersonate you and steal your information using an attack called Self-XSS.\nDo not enter or paste code that you don't understand.",
        "font-size: 16px; font-family: sans-serif; line-height: 1.5;"
    );
}, 500);
