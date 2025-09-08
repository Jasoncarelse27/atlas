import { describe, it, expect } from "vitest";
import { useAIProvider } from "../../features/chat/hooks/useAIProvider";
import { renderHook } from "@testing-library/react";

describe("AI routing", () => {
  it("routes free tier to Claude 3.5 Haiku", () => {
    const { result } = renderHook(() => useAIProvider({ 
      userTier: 'free' 
    }));
    
    const currentProvider = result.current.currentProvider;
    expect(currentProvider.model).toContain("haiku");
    expect(currentProvider.provider).toBe("haiku");
  });

  it("routes core tier to Claude Sonnet", () => {
    const { result } = renderHook(() => useAIProvider({ 
      userTier: 'core' 
    }));
    
    const currentProvider = result.current.currentProvider;
    expect(currentProvider.model).toContain("sonnet");
    expect(currentProvider.provider).toBe("claude");
  });

  it("routes studio tier to Claude Opus", () => {
    const { result } = renderHook(() => useAIProvider({ 
      userTier: 'studio' 
    }));
    
    const currentProvider = result.current.currentProvider;
    expect(currentProvider.model).toContain("opus");
    expect(currentProvider.provider).toBe("opus");
  });

  it("provides correct cost information for Haiku", () => {
    const { result } = renderHook(() => useAIProvider({ 
      userTier: 'free' 
    }));
    
    const costInfo = result.current.getProviderCost();
    expect(costInfo.model).toBe("claude-3-5-haiku");
    expect(costInfo.perToken).toBe(0.00000025);
  });
});
