// Load environment variables for testing
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
