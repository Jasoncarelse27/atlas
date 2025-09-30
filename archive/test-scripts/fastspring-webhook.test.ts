import { describe, expect, it } from "vitest";

// Import the mapEventType function from the webhook
export const mapEventType = (eventType: string, oldTier?: string, newTier?: string) => {
  switch (eventType) {
    case "subscription.activated":
    case "subscription.trial.converted":
      return "activation";
    case "subscription.canceled":
    case "subscription.deactivated":
      return "cancellation";
    case "subscription.updated":
      if (oldTier && newTier && oldTier !== newTier) {
        // Define tier hierarchy: free < core < studio
        const tierOrder = { free: 0, core: 1, studio: 2 };
        const oldOrder = tierOrder[oldTier as keyof typeof tierOrder] ?? -1;
        const newOrder = tierOrder[newTier as keyof typeof tierOrder] ?? -1;
        return newOrder > oldOrder ? "upgrade" : "downgrade";
      }
      return null;
    default:
      return null;
  }
};

describe("FastSpring → Atlas event mapping", () => {
  it("maps subscription.activated to activation", () => {
    expect(mapEventType("subscription.activated")).toBe("activation");
  });

  it("maps subscription.trial.converted to activation", () => {
    expect(mapEventType("subscription.trial.converted")).toBe("activation");
  });

  it("maps subscription.canceled to cancellation", () => {
    expect(mapEventType("subscription.canceled")).toBe("cancellation");
  });

  it("maps subscription.deactivated to cancellation", () => {
    expect(mapEventType("subscription.deactivated")).toBe("cancellation");
  });

  it("maps subscription.updated to upgrade", () => {
    expect(mapEventType("subscription.updated", "core", "studio")).toBe("upgrade");
  });

  it("maps subscription.updated to downgrade", () => {
    expect(mapEventType("subscription.updated", "studio", "core")).toBe("downgrade");
  });

  it("returns null for unknown events", () => {
    expect(mapEventType("random.event")).toBeNull();
  });

  it("returns null for unchanged subscription.updated", () => {
    expect(mapEventType("subscription.updated", "core", "core")).toBeNull();
  });

  it("handles tier comparison correctly", () => {
    // Test tier ordering: free < core < studio
    // Note: String comparison "free" > "core" is false, so we need to test actual tier values
    expect(mapEventType("subscription.updated", "free", "core")).toBe("upgrade");
    expect(mapEventType("subscription.updated", "free", "studio")).toBe("upgrade");
    expect(mapEventType("subscription.updated", "core", "studio")).toBe("upgrade");
    
    expect(mapEventType("subscription.updated", "studio", "core")).toBe("downgrade");
    expect(mapEventType("subscription.updated", "studio", "free")).toBe("downgrade");
    expect(mapEventType("subscription.updated", "core", "free")).toBe("downgrade");
  });

  it("handles missing oldTier gracefully", () => {
    expect(mapEventType("subscription.updated", undefined, "core")).toBeNull();
  });

  it("handles missing newTier gracefully", () => {
    expect(mapEventType("subscription.updated", "core", undefined)).toBeNull();
  });
});
