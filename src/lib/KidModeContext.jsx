import { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const KidModeContext = createContext();

export const KidModeProvider = ({ children }) => {
  const { user } = useAuth();
  const [kidMode, setKidModeState] = useState(false);

  // Sync from user object when it changes (login, page refresh)
  useEffect(() => {
    setKidModeState(!!user?.kid_mode);
  }, [user?.kid_mode]);

  // Apply/remove kid-mode CSS class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('kid-mode', kidMode);
  }, [kidMode]);

  // Toggle kid mode: instant UI update + persist to backend
  const setKidMode = async (value) => {
    setKidModeState(value);
    try {
      await base44.auth.updateMe({ kid_mode: value });
    } catch (e) {
      setKidModeState(!value); // Revert on failure
    }
  };

  return (
    <KidModeContext.Provider value={{ kidMode, setKidMode }}>
      {children}
    </KidModeContext.Provider>
  );
};

export const useKidMode = () => useContext(KidModeContext);