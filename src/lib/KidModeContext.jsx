import { createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

const KidModeContext = createContext();

export const KidModeProvider = ({ children }) => {
  const { user } = useAuth();
  const kidMode = !!user?.kid_mode;

  useEffect(() => {
    document.documentElement.classList.toggle('kid-mode', kidMode);
  }, [kidMode]);

  return (
    <KidModeContext.Provider value={{ kidMode }}>
      {children}
    </KidModeContext.Provider>
  );
};

export const useKidMode = () => useContext(KidModeContext);