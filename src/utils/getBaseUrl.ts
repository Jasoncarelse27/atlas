const getBaseUrl = () => {
  // Use environment variable with fallback to relative URLs for mobile compatibility
  const API_URL = import.meta.env.VITE_API_URL || "";
  
  // Web: use configured API URL
  if (typeof window !== 'undefined') {
    return API_URL;
  }
  
  // Native: use your LAN IP for Expo/React Native (fallback)
  const lanIp = '10.46.30.39';
  return import.meta.env.VITE_API_URL || `http://${lanIp}:3000`;
};

export default getBaseUrl;


