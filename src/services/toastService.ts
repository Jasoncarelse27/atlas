// Simple toast service without external dependencies
export const showErrorToast = (message: string) => {
  console.error("🚨 Error:", message);
  // You can integrate with your existing toast system here
};

export const showSuccessToast = (message: string) => {
  console.log("✅ Success:", message);
  // You can integrate with your existing toast system here
};

export const showInfoToast = (message: string) => {
  console.info("ℹ️ Info:", message);
  // You can integrate with your existing toast system here
};
