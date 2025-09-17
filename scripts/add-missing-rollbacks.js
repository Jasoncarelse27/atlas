// scripts/add-missing-rollbacks.js
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = "./supabase-temp-backup/migrations"; // Using temp backup location

console.log("🔍 Scanning for missing rollback migrations...");

fs.readdirSync(MIGRATIONS_DIR).forEach(file => {
  if (file.endsWith(".sql") && !file.endsWith("_down.sql")) {
    const rollbackFile = file.replace(".sql", "_down.sql");
    const rollbackPath = path.join(MIGRATIONS_DIR, rollbackFile);

    if (!fs.existsSync(rollbackPath)) {
      console.log(`⚠️  Missing rollback for ${file} → creating ${rollbackFile}`);
      
      // Create meaningful rollback content based on filename
      let rollbackContent = `-- AUTO-GENERATED rollback for ${file}\n-- TODO: Replace with actual rollback logic\n\n`;
      
      if (file.includes("add_") || file.includes("create_")) {
        rollbackContent += `-- Example: DROP TABLE IF EXISTS table_name;\n-- Example: ALTER TABLE table_name DROP COLUMN column_name;\n`;
      } else if (file.includes("tier_enforcement")) {
        rollbackContent += `-- Drop tier enforcement tables and policies\nDROP TABLE IF EXISTS feature_attempts;\nDROP TABLE IF EXISTS feature_flags;\n`;
      } else if (file.includes("schema")) {
        rollbackContent += `-- Drop main schema tables\nDROP TABLE IF EXISTS messages;\nDROP TABLE IF EXISTS conversations;\nDROP TABLE IF EXISTS user_profiles;\n`;
      }
      
      fs.writeFileSync(rollbackPath, rollbackContent);
      console.log(`✅ Created ${rollbackFile}`);
    } else {
      console.log(`✅ Rollback exists for ${file}`);
    }
  }
});

console.log("🎉 Rollback migration scan complete!");
