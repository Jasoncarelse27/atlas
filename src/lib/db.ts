import Dexie from "dexie";

let db: Dexie | null = null;

try {
  db = new Dexie("atlas_db");
  db.version(1).stores({
    messages: "++id, content, created_at, sync_status",
  });
} catch (err) {
  db = null;
}

export default db;
