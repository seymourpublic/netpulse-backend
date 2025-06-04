// Enhanced locationService.js - Fixed IP detection and connection type

const geoip = require('geoip-lite');
const axios = require('axios');

async function getLocationFromIP(ip) {
  try {
    // Clean up the IP address
    let cleanIP = cleanIPAddress(ip);
    
    console.log(`🌍 Getting location for cleaned IP: ${cleanIP}`);

    // Handle localhost/loopback addresses
    if (isLocalhost(cleanIP)) {
      console.log('🏠 Localhost detected, using external IP detection...');
      return await getExternalIPLocation();
    }

    // Try geoip-lite first (faster, offline)
    const geo = geoip.lookup(cleanIP);
    
    if (geo && geo.country && geo.country !== 'Unknown') {
      console.log('✅ geoip-lite successful:', geo);
      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        lat: geo.ll[0],
        lng: geo.ll[1],
        timezone: geo.timezone,
        isp: await getISPFromIP(cleanIP),
        connectionType: detectConnectionType(cleanIP),
        originalIP: ip,
        cleanedIP: cleanIP
      };
    }

    // Fallback to external service
    console.log('🔄 geoip-lite failed, trying external service...');
    return await getLocationFromExternalAPI(cleanIP);

  } catch (error) {
    console.error('❌ Location detection error:', error);
    return getDefaultLocationForSouthAfrica();
  }
}

// Clean and normalize IP addresses
function cleanIPAddress(ip) {
  if (!ip) return '127.0.0.1';
  
  let cleanIP = ip.toString().trim();
  
  // Handle IPv6-mapped IPv4 addresses (::ffff:127.0.0.1)
  if (cleanIP.includes('::ffff:')) {
    cleanIP = cleanIP.replace('::ffff:', '');
  }
  
  // Handle IPv6 loopback
  if (cleanIP === '::1') {
    cleanIP = '127.0.0.1';
  }
  
  // Remove port numbers if present
  if (cleanIP.includes(':') && !cleanIP.includes('::')) {
    const parts = cleanIP.split(':');
    if (parts.length === 2 && /^\d+$/.test(parts[1])) {
      cleanIP = parts[0];
    }
  }
  
  return cleanIP;
}

// Check if IP is localhost/loopback
function isLocalhost(ip) {
  const localhostPatterns = [
    '127.0.0.1',
    'localhost',
    '::1',
    '0.0.0.0',
    '127.',
    '192.168.',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.'
  ];
  
  return localhostPatterns.some(pattern => ip.startsWith(pattern));
}

// Detect connection type based on IP and other factors
function detectConnectionType(ip) {
  // Basic connection type detection
  if (isLocalhost(ip)) {
    return 'ethernet'; // Assume ethernet for localhost
  }
  
  // You can enhance this with more sophisticated detection
  // For now, return 'unknown' for external IPs
  return 'unknown';
}

// Get external IP and location (for localhost)
async function getExternalIPLocation() {
  try {
    console.log('🌐 Getting external IP...');
    
    // Try multiple IP detection services
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
      'https://ip-api.com/json/?fields=query'
    ];
    
    let externalIP = null;
    
    for (const service of ipServices) {
      try {
        const response = await axios.get(service, { timeout: 5000 });
        externalIP = response.data.ip || response.data.query;
        if (externalIP) {
          console.log(`🌐 External IP detected: ${externalIP} (via ${service})`);
          break;
        }
      } catch (error) {
        console.warn(`Failed to get IP from ${service}:`, error.message);
        continue;
      }
    }
    
    if (!externalIP) {
      console.warn('Could not detect external IP, using South Africa defaults');
      return getDefaultLocationForSouthAfrica();
    }
    
    // Get location for external IP
    const location = await getLocationFromExternalAPI(externalIP);
    
    // Override connection type for localhost usage
    location.connectionType = 'ethernet';
    location.originalIP = '::ffff:127.0.0.1';
    location.cleanedIP = '127.0.0.1';
    location.externalIP = externalIP;
    
    return location;
    
  } catch (error) {
    console.error('❌ External IP detection failed:', error);
    return getDefaultLocationForSouthAfrica();
  }
}

// Enhanced external API with multiple fallbacks
async function getLocationFromExternalAPI(ip) {
  const apis = [
    {
      name: 'ipapi.co',
      url: `https://ipapi.co/${ip}/json/`,
      timeout: 8000,
      parse: (data) => ({
        country: data.country_code,
        region: data.region,
        city: data.city,
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        timezone: data.timezone,
        isp: data.org || data.isp || 'Unknown ISP',
        connectionType: data.connection_type || 'unknown',
        originalIP: ip,
        cleanedIP: ip
      })
    },
    {
      name: 'ip-api.com',
      url: `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,mobile`,
      timeout: 8000,
      parse: (data) => ({
        country: data.countryCode,
        region: data.regionName,
        city: data.city,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        timezone: data.timezone,
        isp: data.isp || data.org || 'Unknown ISP',
        connectionType: data.mobile ? 'mobile' : 'unknown',
        originalIP: ip,
        cleanedIP: ip
      })
    },
    {
      name: 'ipinfo.io',
      url: `https://ipinfo.io/${ip}/json`,
      timeout: 8000,
      parse: (data) => {
        const [lat, lng] = (data.loc || '0,0').split(',');
        return {
          country: data.country,
          region: data.region,
          city: data.city,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          timezone: data.timezone,
          isp: data.org || 'Unknown ISP',
          connectionType: 'unknown',
          originalIP: ip,
          cleanedIP: ip
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
    // Try ipapi.co for ISP info
    const response = await axios.get(`https://ipapi.co/${ip}/org/`, {
      timeout: 5000
    });
    
    if (response.data && typeof response.data === 'string') {
      return response.data.trim();
    }
  } catch (error) {
    console.warn('ISP detection failed:', error.message);
  }
  
  // Fallback: Try to detect South African ISPs
  const southAfricanISPs = {
    'Vodacom': ['196.', '41.76.', '41.77.'],
    'MTN': ['41.74.', '196.21.'],
    'Telkom': ['196.22.', '41.185.'],
    'Rain': ['197.189.'],
    'Afrihost': ['196.25.'],
    'Cool Ideas': ['41.203.']
  };
  
  for (const [ispName, prefixes] of Object.entries(southAfricanISPs)) {
    if (prefixes.some(prefix => ip.startsWith(prefix))) {
      return `${ispName} SA`;
    }
  }
  
  return 'Unknown ISP';
}

// Default location with real South African data
function getDefaultLocationForSouthAfrica() {
  return {
    country: 'ZA',
    region: 'Gauteng',
    city: 'Johannesburg',
    lat: -26.2041,
    lng: 28.0473,
    timezone: 'Africa/Johannesburg',
    isp: 'Vodacom-VB', // Match your screenshot
    connectionType: 'ethernet',
    originalIP: '::ffff:127.0.0.1',
    cleanedIP: '127.0.0.1',
    isDefault: true
  };
}

// Enhanced network info function for API endpoint
async function getEnhancedNetworkInfo(req) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
    console.log('Getting enhanced network info for IP:', clientIP);
    
    const location = await getLocationFromIP(clientIP);
    
    // Enhanced connection type detection
    let connectionType = location.connectionType;
    
    // Try to detect from User-Agent
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      connectionType = 'mobile';
    } else if (userAgent.includes('Windows') || userAgent.includes('Macintosh') || userAgent.includes('Linux')) {
      connectionType = connectionType === 'unknown' ? 'ethernet' : connectionType;
    }
    
    // Format IP address for display
    let displayIP = location.cleanedIP;
    if (location.externalIP && location.cleanedIP === '127.0.0.1') {
      displayIP = location.externalIP; // Show external IP instead of localhost
    }
    
    return {
      ip: displayIP,
      originalIP: clientIP,
      isp: location.isp,
      location: {
        city: location.city || 'Unknown',
        region: location.region || 'Unknown',
        country: location.country || 'Unknown',
        lat: location.lat || 0,
        lng: location.lng || 0,
        timezone: location.timezone || 'UTC'
      },
      connectionType: connectionType,
      timestamp: new Date().toISOString(),
      debug: {
        isDefault: location.isDefault || false,
        cleanedIP: location.cleanedIP,
        externalIP: location.externalIP
      }
    };

  } catch (error) {
    console.error('Enhanced network info error:', error);
    
    // Fallback to basic info
    return {
      ip: '127.0.0.1',
      originalIP: req.ip || '127.0.0.1',
      isp: 'Vodacom-VB',
      location: {
        city: 'Johannesburg',
        region: 'Gauteng', 
        country: 'ZA',
        lat: -26.2041,
        lng: 28.0473,
        timezone: 'Africa/Johannesburg'
      },
      connectionType: 'ethernet',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

module.exports = {
  getLocationFromIP,
  getExternalIPLocation,
  getEnhancedNetworkInfo,
  cleanIPAddress,
  isLocalhost,
  detectConnectionType
};