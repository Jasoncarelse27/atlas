// Load environment variables for testing
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local for testing
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

describe("Environment validation", () => {
  const requiredEnvVars = [
    "ANTHROPIC_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ];

  test("All required environment variables are set", () => {
    const missing = requiredEnvVars.filter((key) => !process.env[key]);
    expect(missing).toEqual([]);
  });
});
