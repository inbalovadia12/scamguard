import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const startupCheckStarted = useRef(false);

  useEffect(() => {
    // React StrictMode intentionally runs effects twice in development. Guard the
    // auth bootstrap so two simultaneous session checks cannot race each other
    // and leave the app in an inconsistent startup state.
    if (startupCheckStarted.current) return;
    startupCheckStarted.current = true;
    checkAppState();
  }, []);

  const checkAppState = async () => {
    // Keep startup auth as a single, deterministic operation. The public-settings
    // endpoint is not consumed anywhere in the app and was introducing a second
    // network request that could race with auth and leave a returning user on the
    // landing page until a hard refresh. Protected routes already handle auth
    // requirements, so there is no reason to gate the initial render on it.
    setIsLoadingPublicSettings(false);
    setAuthError(null);
    try {
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected startup auth error:', error);
      setAuthError({
        type: 'unknown',
        message: error?.message || 'An unexpected error occurred'
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);

      // Redirect to onboarding if the user hasn't completed it yet
      if (currentUser && !currentUser.onboarding_completed) {
        const currentPath = window.location.pathname;
        if (currentPath !== "/onboarding" && !currentPath.startsWith("/login") && !currentPath.startsWith("/register") && !currentPath.startsWith("/reset-password") && currentPath !== "/") {
          window.location.href = "/onboarding";
        }
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};