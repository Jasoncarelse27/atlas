import { Platform } from 'react-native';

const getBaseUrl = () => {
  try {
    if (Platform.OS === 'web') {
      return 'http://localhost:8000';
    }
  } catch {
    // If Platform is unavailable, default to localhost for safety
    return 'http://localhost:8000';
  }

  // Native: use your LAN IP for Expo/React Native
  // Fetched via: ipconfig getifaddr en0
  const lanIp = '10.46.30.39';
  return `http://${lanIp}:8000`;
};

export default getBaseUrl;


