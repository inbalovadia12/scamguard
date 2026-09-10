import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const SESSION_STORAGE_KEYS = ['vardin_remembered_session', 'base44_access_token', 'token'];
const REMEMBERED_SESSION_KEY = 'vardin_remembered_session';

const rememberBrowserSession = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const token = window.localStorage.getItem('base44_access_token') || window.localStorage.getItem('token');
    if (token) window.localStorage.setItem(REMEMBERED_SESSION_KEY, token);
  } catch (error) {
    console.warn('Could not persist Vardin browser session:', error);
  }
};

const clearRememberedBrowserSession = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(REMEMBERED_SESSION_KEY);
  } catch {}
};

const restoreBrowserSession = () => {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  for (const key of SESSION_STORAGE_KEYS) {
    try {
      const token = window.localStorage.getItem(key);
      if (token) {
        // Rehydrate the SDK's in-memory Authorization header on every app boot.
        // The SDK also persists this token, but explicitly restoring it here
        // prevents a client created before storage was populated from behaving
        // like a signed-out user after returning from the public landing page.
        base44.auth.setToken(token, true);
        // Keep a dedicated browser-session copy so navigation through the public
        // landing page cannot accidentally lose the returning user's session.
        try {
          window.localStorage.setItem(REMEMBERED_SESSION_KEY, token);
        } catch {}
        return true;
      }
    } catch (error) {
      console.warn(`Could not restore Vardin browser session from ${key}:`, error);
    }
  }

  return false;
};

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
      // Rehydrate the persisted browser session before the first auth check.
      // Never store or restore passwords — only the SDK's existing session token.
      restoreBrowserSession();
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
    setIsLoadingAuth(true);
    setAuthError(null);

    // On a cold load, Base44 can finish restoring an existing browser session
    // just after the React bundle starts. A single `me()` call can therefore
    // briefly return 401 even though the customer is already signed in. Never
    // classify that transient response as "signed out" immediately: doing so
    // causes the exact landing-page flash/blank transition seen on first load.
    const delays = [0, 250, 600, 1200];
    let lastError = null;

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        rememberBrowserSession();

        // Redirect to onboarding if the user hasn't completed it yet.
        if (currentUser && !currentUser.onboarding_completed) {
          const currentPath = window.location.pathname;
          if (currentPath !== "/onboarding" && !currentPath.startsWith("/login") && !currentPath.startsWith("/register") && !currentPath.startsWith("/reset-password") && currentPath !== "/") {
            window.location.href = "/onboarding";
          }
        }
        return;
      } catch (error) {
        lastError = error;
        // Keep the startup screen up while the session is being restored.
        // Retry transient auth failures; only the final failure is treated as
        // a genuine signed-out state.
      }
    }

    console.warn('User auth check failed after startup retries:', lastError);
    // Never leave the router waiting forever. A browser/network failure is
    // treated as signed out after the bounded retry window, so the UI can
    // always render a recovery/login route without requiring a manual refresh.
    setIsLoadingAuth(false);
    setIsAuthenticated(false);
    setAuthChecked(true);

    // A failed session check means this browser is signed out. Keep the public
    // landing page available instead of throwing during the render phase.
    if (lastError?.status === 401 || lastError?.status === 403) {
      setAuthError(null);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    clearRememberedBrowserSession();
    
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