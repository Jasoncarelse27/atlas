import Dexie from "dexie";

export interface SubscriptionStat {
  id?: number;
  userId: string;
  data: any; // JSON payload with usage + attempts
  updatedAt: number;
}

export class AtlasDB extends Dexie {
  subscription_stats!: Dexie.Table<SubscriptionStat>;

  constructor() {
    super("AtlasDB");
    this.version(2).stores({
      subscription_stats: "++id,userId,updatedAt"
    });
  }
}

export const db = new AtlasDB();
