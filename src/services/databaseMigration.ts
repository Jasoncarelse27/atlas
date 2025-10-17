import { atlasDB } from '../database/atlasDB';
import { logger } from '../lib/logger';

/**
 * Clean database migration service
 * Handles the transition from old schema to new schema
 */
export class DatabaseMigrationService {
  private static instance: DatabaseMigrationService;
  private isMigrating = false;

  static getInstance(): DatabaseMigrationService {
    if (!DatabaseMigrationService.instance) {
      DatabaseMigrationService.instance = new DatabaseMigrationService();
    }
    return DatabaseMigrationService.instance;
  }

  async migrateDatabase(): Promise<void> {
    if (this.isMigrating) {
      logger.debug('[Migration] Already migrating, skipping...');
      return;
    }

    this.isMigrating = true;
    logger.debug('[Migration] Starting clean database migration...');

    try {
      // Open the new database
      await atlasDB.open();
      logger.debug('[Migration] ✅ New database opened successfully');

      // Clear any existing data to start fresh
      await atlasDB.messages.clear();
      await atlasDB.conversations.clear();
      logger.debug('[Migration] ✅ Cleared old data');

      logger.debug('[Migration] ✅ Database migration completed successfully');
    } catch (error) {
      logger.error('[Migration] ❌ Database migration failed:', error);
      throw error;
    } finally {
      this.isMigrating = false;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await atlasDB.messages.clear();
      await atlasDB.conversations.clear();
      logger.debug('[Migration] ✅ All data cleared');
    } catch (error) {
      logger.error('[Migration] ❌ Failed to clear data:', error);
    }
  }
}

export const databaseMigration = DatabaseMigrationService.getInstance();
