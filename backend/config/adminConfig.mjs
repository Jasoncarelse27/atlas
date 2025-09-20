// Atlas Admin Configuration
// Handles admin email allowlist and security settings

export const ADMIN_EMAIL_ALLOWLIST = (process.env.ADMIN_EMAIL_ALLOWLIST || "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Default to Jason's email if no allowlist configured
if (ADMIN_EMAIL_ALLOWLIST.length === 0) {
  ADMIN_EMAIL_ALLOWLIST.push("jasonc.jpg@gmail.com");
  console.warn("⚠️  No ADMIN_EMAIL_ALLOWLIST configured, defaulting to jasonc.jpg@gmail.com");
}

console.log(`🔐 Admin allowlist configured for ${ADMIN_EMAIL_ALLOWLIST.length} email(s)`);

export default {
  ADMIN_EMAIL_ALLOWLIST
};
