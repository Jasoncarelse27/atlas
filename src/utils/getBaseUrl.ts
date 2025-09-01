const getBaseUrl = () => {
  // Web: use localhost
  if (typeof window !== 'undefined') {
    return 'http://localhost:8000';
  }
  
  // Native: use your LAN IP for Expo/React Native
  // Fetched via: ipconfig getifaddr en0
  const lanIp = '10.46.30.39';
  return `http://${lanIp}:8000`;
};

export default getBaseUrl;


