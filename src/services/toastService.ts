import toast from "react-hot-toast";

export function safeToast(message: string, type: "success" | "error" = "success") {
  try {
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  } catch (err) {
      // Intentionally empty - error handling not required
  }
}