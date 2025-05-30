const geoip = require('geoip-lite');
const axios = require('axios');

async function getLocationFromIP(ip) {
  try {
    // Use geoip-lite for basic location detection
    const geo = geoip.lookup(ip);
    
    if (geo) {
      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        lat: geo.ll[0],
        lng: geo.ll[1],
        timezone: geo.timezone
      };
    }

    // Fallback to external service if geoip-lite fails
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000
    });

    if (response.data.status === 'success') {
      return {
        country: response.data.countryCode,
        region: response.data.regionName,
        city: response.data.city,
        lat: response.data.lat,
        lng: response.data.lon,
        timezone: response.data.timezone
      };
    }

    throw new Error('Location detection failed');

  } catch (error) {
    console.error('Location detection error:', error);
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      lat: 0,
      lng: 0,
      timezone: 'UTC'
    };
  }
}

module.exports = {
  getLocationFromIP
};
