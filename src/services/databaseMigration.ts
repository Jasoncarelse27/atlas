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
    logger.debug('[Migration] Starting database check...');

    try {
      // ✅ FIX: Just ensure database is open, DON'T clear data!
      // The old code was clearing messages on every page refresh!
      await atlasDB.open();
      logger.debug('[Migration] ✅ Database opened successfully');

      // ✅ FIX: REMOVED data clearing - this was deleting messages on every refresh!
      // await atlasDB.messages.clear();  ❌ DON'T DO THIS!
      // await atlasDB.conversations.clear();  ❌ DON'T DO THIS!

      logger.debug('[Migration] ✅ Database check completed');
    } catch (error) {
      logger.error('[Migration] ❌ Database check failed:', error);
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
