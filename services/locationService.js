// services/locationService.js - FIXED VERSION (Service functions only)

const geoip = require('geoip-lite');
const axios = require('axios');

async function getLocationFromIP(ip) {
  try {
    // Clean up the IP address
    let cleanIP = ip;
    
    // Handle IPv6-mapped IPv4 addresses
    if (ip.includes('::ffff:')) {
      cleanIP = ip.replace('::ffff:', '');
    }
    
    // Handle localhost/loopback addresses
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP === '::1') {
      console.log('🏠 Localhost detected, using external IP detection...');
      return await getExternalIPLocation();
    }

    console.log(`🌍 Getting location for IP: ${cleanIP}`);

    // Try geoip-lite first (faster, offline)
    const geo = geoip.lookup(cleanIP);
    
    if (geo && geo.country !== 'Unknown') {
      console.log('✅ geoip-lite successful:', geo);
      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        lat: geo.ll[0],
        lng: geo.ll[1],
        timezone: geo.timezone,
        isp: await getISPFromIP(cleanIP) // Get ISP separately
      };
    }

    // Fallback to external service
    console.log('🔄 geoip-lite failed, trying external service...');
    return await getLocationFromExternalAPI(cleanIP);

  } catch (error) {
    console.error('❌ Location detection error:', error);
    return getDefaultLocation();
  }
}

// Get external IP and location (for localhost)
async function getExternalIPLocation() {
  try {
    console.log('🌐 Getting external IP...');
    
    // Get external IP first
    const ipResponse = await axios.get('https://api.ipify.org?format=json', {
      timeout: 5000
    });
    
    const externalIP = ipResponse.data.ip;
    console.log(`🌐 External IP detected: ${externalIP}`);
    
    // Get location for external IP
    return await getLocationFromExternalAPI(externalIP);
    
  } catch (error) {
    console.error('❌ External IP detection failed:', error);
    return getDefaultLocationWithRealData();
  }
}

// Enhanced external API with multiple fallbacks
async function getLocationFromExternalAPI(ip) {
  const apis = [
    {
      name: 'ipapi.co',
      url: `https://ipapi.co/${ip}/json/`,
      timeout: 5000,
      parse: (data) => ({
        country: data.country_code,
        region: data.region,
        city: data.city,
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        timezone: data.timezone,
        isp: data.org || data.isp || 'Unknown ISP'
      })
    },
    {
      name: 'ip-api.com',
      url: `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org`,
      timeout: 5000,
      parse: (data) => ({
        country: data.countryCode,
        region: data.regionName,
        city: data.city,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        timezone: data.timezone,
        isp: data.isp || data.org || 'Unknown ISP'
      })
    },
    {
      name: 'ipinfo.io',
      url: `https://ipinfo.io/${ip}/json`,
      timeout: 5000,
      parse: (data) => {
        const [lat, lng] = (data.loc || '0,0').split(',');
        return {
          country: data.country,
          region: data.region,
          city: data.city,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          timezone: data.timezone,
          isp: data.org || 'Unknown ISP'
        };
      }
    }
  ];

  for (const api of apis) {
    try {
      console.log(`🔄 Trying ${api.name}...`);
      
      const response = await axios.get(api.url, {
        timeout: api.timeout,
        headers: {
          'User-Agent': 'NETPULSE Speed Test'
        }
      });

      if (response.data && (response.data.status !== 'fail')) {
        const location = api.parse(response.data);
        console.log(`✅ ${api.name} successful:`, location);
        return location;
      }
    } catch (error) {
      console.warn(`⚠️ ${api.name} failed:`, error.message);
      continue;
    }
  }

  throw new Error('All external APIs failed');
}

// Get ISP information separately
async function getISPFromIP(ip) {
  try {
    // Try WHOIS-style API for ISP info
    const response = await axios.get(`https://ipapi.co/${ip}/org/`, {
      timeout: 3000
    });
    
    if (response.data && typeof response.data === 'string') {
      return response.data.trim();
    }
  } catch (error) {
    console.warn('ISP detection failed:', error.message);
  }
  
  return 'Unknown ISP';
}

// Default location with some real data for development
function getDefaultLocationWithRealData() {
  return {
    country: 'US',
    region: 'California',
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    timezone: 'America/Los_Angeles',
    isp: 'Local Development Network'
  };
}

// Minimal fallback
function getDefaultLocation() {
  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown',
    lat: 0,
    lng: 0,
    timezone: 'UTC',
    isp: 'Unknown ISP'
  };
}

module.exports = {
  getLocationFromIP,
  getExternalIPLocation
};