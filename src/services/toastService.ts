// Simple toast service without external dependencies
export const __showErrorToast = (message: string) => {
  logger.error("🚨 Error:", message);
  // You can integrate with your existing toast system here
};
export const __showSuccessToast = (message: string) => {
  logger.info("✅ Success:", message);
  // You can integrate with your existing toast system here
};
export const __showInfoToast = (message: string) => {
  logger.info("ℹ️ Info:", message);
  // You can integrate with your existing toast system here
};