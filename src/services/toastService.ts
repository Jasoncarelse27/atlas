import toast from "react-hot-toast";

export function safeToast(message: string, type: "success" | "error" = "success") {
  try {
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  } catch (err) {
    console.warn("[ToastService] Failed to show toast:", err, "Message:", message);
  }
}