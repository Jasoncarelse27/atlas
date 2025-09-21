import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatFooter from "../ChatFooter";

// Mock the useUsageIndicator hook
vi.mock("../../hooks/useUsageIndicator");

import { useUsageIndicator } from "../../hooks/useUsageIndicator";
const mockUseUsageIndicator = vi.mocked(useUsageIndicator);

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
});

describe("ChatFooter", () => {
  const mockRefreshUsage = vi.fn();
  const mockOnUpgradeClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsageIndicator.mockReturnValue({
      usage: null,
      loading: false,
      error: null,
      getDisplayText: () => "15 messages remaining",
      getDisplayClasses: () => "text-gray-600",
      shouldShowUpgradePrompt: () => false,
      refreshUsage: mockRefreshUsage,
    });
  });

  it("renders usage indicator text", () => {
    render(<ChatFooter />);
    
    expect(screen.getByText("15 messages remaining")).toBeInTheDocument();
  });

  it("shows loading state with spinning refresh icon", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: null,
      loading: true,
      error: null,
      getDisplayText: () => "Loading usage...",
      getDisplayClasses: () => "text-gray-500",
      shouldShowUpgradePrompt: () => false,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    expect(screen.getByText("Loading usage...")).toBeInTheDocument();
    const refreshIcon = screen.getByRole("button", { name: /refresh usage/i });
    expect(refreshIcon.querySelector("svg")).toHaveClass("animate-spin");
  });

  it("shows error state", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: null,
      loading: false,
      error: "Failed to load usage",
      getDisplayText: () => "⚠️ Usage unavailable",
      getDisplayClasses: () => "text-yellow-600",
      shouldShowUpgradePrompt: () => false,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    expect(screen.getByText("⚠️ Usage unavailable")).toBeInTheDocument();
    expect(screen.getByText("⚠️ Usage data unavailable")).toBeInTheDocument();
  });

  it("calls refreshUsage when refresh button is clicked", () => {
    render(<ChatFooter />);
    
    const refreshButton = screen.getByRole("button", { name: /refresh usage/i });
    fireEvent.click(refreshButton);
    
    expect(mockRefreshUsage).toHaveBeenCalledOnce();
  });

  it("shows upgrade button when shouldShowUpgradePrompt returns true", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: { tier: "free", remainingMessages: 2 },
      loading: false,
      error: null,
      getDisplayText: () => "2 messages remaining",
      getDisplayClasses: () => "text-orange-600",
      shouldShowUpgradePrompt: () => true,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    expect(screen.getByRole("button", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("calls onUpgradeClick when upgrade button is clicked", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: { tier: "free", remainingMessages: 2 },
      loading: false,
      error: null,
      getDisplayText: () => "2 messages remaining",
      getDisplayClasses: () => "text-orange-600",
      shouldShowUpgradePrompt: () => true,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter onUpgradeClick={mockOnUpgradeClick} />);
    
    const upgradeButton = screen.getByRole("button", { name: /upgrade/i });
    fireEvent.click(upgradeButton);
    
    expect(mockOnUpgradeClick).toHaveBeenCalledOnce();
  });

  it("redirects to upgrade page when no onUpgradeClick provided", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: { tier: "free", remainingMessages: 2 },
      loading: false,
      error: null,
      getDisplayText: () => "2 messages remaining",
      getDisplayClasses: () => "text-orange-600",
      shouldShowUpgradePrompt: () => true,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    const upgradeButton = screen.getByRole("button", { name: /upgrade/i });
    fireEvent.click(upgradeButton);
    
    expect(window.location.href).toBe('/upgrade');
  });

  it("shows Core tier badge for core users", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: { tier: "core", remainingMessages: -1 }, // Unlimited
      loading: false,
      error: null,
      getDisplayText: () => "Unlimited messages",
      getDisplayClasses: () => "text-green-600",
      shouldShowUpgradePrompt: () => false,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    expect(screen.getByText("🌱 Core")).toBeInTheDocument();
  });

  it("shows Studio tier badge for studio users", () => {
    mockUseUsageIndicator.mockReturnValue({
      usage: { tier: "studio", remainingMessages: -1 }, // Unlimited
      loading: false,
      error: null,
      getDisplayText: () => "Unlimited messages",
      getDisplayClasses: () => "text-purple-600",
      shouldShowUpgradePrompt: () => false,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    expect(screen.getByText("🚀 Studio")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<ChatFooter className="custom-class" />);
    
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("uses global showUpgradeModal when available", () => {
    const mockShowUpgradeModal = vi.fn();
    (window as any).showUpgradeModal = mockShowUpgradeModal;

    mockUseUsageIndicator.mockReturnValue({
      usage: { tier: "free", remainingMessages: 2 },
      loading: false,
      error: null,
      getDisplayText: () => "2 messages remaining",
      getDisplayClasses: () => "text-orange-600",
      shouldShowUpgradePrompt: () => true,
      refreshUsage: mockRefreshUsage,
    });

    render(<ChatFooter />);
    
    const upgradeButton = screen.getByRole("button", { name: /upgrade/i });
    fireEvent.click(upgradeButton);
    
    expect(mockShowUpgradeModal).toHaveBeenCalledOnce();
    
    // Cleanup
    delete (window as any).showUpgradeModal;
  });
});
