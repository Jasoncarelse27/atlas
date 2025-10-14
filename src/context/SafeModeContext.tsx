import React, { createContext, useContext, useState } from 'react';

interface SafeModeContextType {
  isSafeMode: boolean;
  toggleSafeMode: () => void;
}

const SafeModeContext = createContext<SafeModeContextType>({
  isSafeMode: false,
  toggleSafeMode: () => {},
});

export const SafeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSafeMode, setIsSafeMode] = useState(() => {
    // Load from localStorage on initialization
    try {
      const saved = localStorage.getItem('atlas-safemode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      // Intentionally empty - error handling not required
      return false;
    }
  });

  const toggleSafeMode = () => {
    setIsSafeMode((prev) => {
      const newValue = !prev;
      // Save to localStorage
      try {
        localStorage.setItem('atlas-safemode', JSON.stringify(newValue));
      } catch (error) {
      // Intentionally empty - error handling not required
      }
      return newValue;
    });
  };

  return (
    <SafeModeContext.Provider value={{ isSafeMode, toggleSafeMode }}>
      {children}
    </SafeModeContext.Provider>
  );
};

export const useSafeMode = () => useContext(SafeModeContext);
