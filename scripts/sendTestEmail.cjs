const { mailerService } = require("../src/services/mailerService");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/sendTestEmail.js <email>");
    process.exit(1);
  }

  console.log(`🚀 Sending test email to ${email}...`);

  try {
    const result = await mailerService.sendWelcomeEmail({
      email,
      name: "Atlas Test User",
    });

    console.log("✅ Result:", result);
  } catch (err) {
    console.error("❌ Error sending test email:", err.message || err);
    process.exit(1);
  }
}

main();
