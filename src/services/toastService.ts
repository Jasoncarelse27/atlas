// Simple toast service without external dependencies
export const _showErrorToast = (message: string) => {
  logger.error("🚨 Error:", message);
  // You can integrate with your existing toast system here
};
export const _showSuccessToast = (message: string) => {
  logger.info("✅ Success:", message);
  // You can integrate with your existing toast system here
};
export const _showInfoToast = (message: string) => {
  logger.info("ℹ️ Info:", message);
  // You can integrate with your existing toast system here
};