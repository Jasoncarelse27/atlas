import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UpgradeModalContextType {
  // Generic upgrade modal (existing)
  showGenericUpgrade: (feature?: string) => void;
  hideGenericUpgrade: () => void;
  genericModalVisible: boolean;
  genericModalFeature?: string;
  
  // Voice-specific modal (new)
  showVoiceUpgrade: () => void;
  hideVoiceUpgrade: () => void;
  voiceModalVisible: boolean;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(undefined);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  // Generic modal state
  const [genericModalVisible, setGenericModalVisible] = useState(false);
  const [genericModalFeature, setGenericModalFeature] = useState<string>();
  
  // Voice modal state
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  
  const showGenericUpgrade = useCallback((feature?: string) => {
    setGenericModalFeature(feature);
    setGenericModalVisible(true);
    // Ensure voice modal is closed
    setVoiceModalVisible(false);
  }, []);
  
  const hideGenericUpgrade = useCallback(() => {
    setGenericModalVisible(false);
    setGenericModalFeature(undefined);
  }, []);
  
  const showVoiceUpgrade = useCallback(() => {
    setVoiceModalVisible(true);
    // Ensure generic modal is closed
    setGenericModalVisible(false);
  }, []);
  
  const hideVoiceUpgrade = useCallback(() => {
    setVoiceModalVisible(false);
  }, []);
  
  return (
    <UpgradeModalContext.Provider
      value={{
        showGenericUpgrade,
        hideGenericUpgrade,
        genericModalVisible,
        genericModalFeature,
        showVoiceUpgrade,
        hideVoiceUpgrade,
        voiceModalVisible,
      }}
    >
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModals() {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error('useUpgradeModals must be used within UpgradeModalProvider');
  }
  return context;
}

