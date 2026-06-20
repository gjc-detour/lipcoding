import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchCurrentUser, loginWithToken, logoutCurrentUser } from "../lib/api";

interface AuthState {
  userId: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    displayName: null,
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setState({
        userId: user.userId,
        displayName: user.displayName,
        isAuthenticated: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("unauthorized")) {
        setState({
          userId: null,
          displayName: null,
          isAuthenticated: false,
        });
        return;
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await refresh();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refresh]);

  const login = useCallback(async (token: string) => {
    const user = await loginWithToken(token);
    setState({
      userId: user.userId,
      displayName: user.displayName,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(async () => {
    await logoutCurrentUser();
    setState({
      userId: null,
      displayName: null,
      isAuthenticated: false,
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isLoading,
      login,
      logout,
      refresh,
    }),
    [isLoading, login, logout, refresh, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
