const getBaseUrl = () => {
  // Use environment variable with fallback to relative URLs for mobile compatibility
  const API_URL = import.meta.env.VITE_API_URL || "";
  
  // For both web and native: use environment variable or empty string (relative URLs)
  // Empty string allows the app to use relative URLs, which work across all environments
  // Mobile builds should have VITE_API_URL set in EAS environment variables
    return API_URL;
};

export default getBaseUrl;


