import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppUser } from '../types/database';

interface AuthContextType {
  dbPath: string | null;
  dbFile: string | null;
  user: AppUser | null;
  hasUser: boolean;
  registeredUserName: string | null;
  /** true only during the very first status check on mount */
  loading: boolean;
  /** true while the folder-select dialog is open / DB is being initialized */
  selecting: boolean;
  dbError: string | null;
  clearDbError: () => void;
  selectFolder: () => Promise<boolean>;
  selectFile: () => Promise<boolean>;
  register: (name: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  login: (name: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  resetDbSelection: () => void;
  refreshState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_USER_KEY = 'myfinances_session_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [dbFile, setDbFile] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [hasUser, setHasUser] = useState<boolean>(false);
  const [registeredUserName, setRegisteredUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selecting, setSelecting] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const clearDbError = useCallback(() => setDbError(null), []);

  const refreshState = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const config = await window.electronAPI.getDbConfig();
        setDbPath(config.dbPath);
        setDbFile(config.dbFile || 'db_myfinances.sqlite');

        if (config.dbPath) {
          const authStatus = await window.electronAPI.getAuthStatus();
          setHasUser(authStatus.hasUser);
          setRegisteredUserName(authStatus.userName || null);
        } else {
          setHasUser(false);
          setRegisteredUserName(null);
        }
      }
    } catch (err) {
      console.error('Error refreshing auth state:', err);
    }
  }, []);

  // Carga inicial — define loading=true apenas na montagem
  useEffect(() => {
    setLoading(true);
    refreshState().finally(() => setLoading(false));
  }, [refreshState]);

  const selectFolder = async (): Promise<boolean> => {
    try {
      if (!window.electronAPI) return false;
      setSelecting(true);
      setDbError(null);
      const result = await window.electronAPI.selectDbFolder();
      console.log('[AuthContext] selectDbFolder result:', result);
      if (result.success && result.dbPath) {
        // Atualiza estado diretamente
        setDbPath(result.dbPath);
        setDbFile(result.dbFile || 'db_myfinances.sqlite');

        // Verifica se o banco já tem um usuário (pasta com banco existente)
        try {
          const authStatus = await window.electronAPI.getAuthStatus();
          setHasUser(authStatus.hasUser);
          setRegisteredUserName(authStatus.userName || null);
        } catch {
          setHasUser(false);
          setRegisteredUserName(null);
        }
        return true;
      }
      if (!result.success && result.error && result.error !== 'Seleção cancelada pelo usuário') {
        setDbError(result.error);
      }
      return false;
    } catch (err: any) {
      console.error('Error selecting DB folder:', err);
      setDbError(err?.message || 'Erro ao selecionar a pasta do banco de dados');
      return false;
    } finally {
      setSelecting(false);
    }
  };

  const selectFile = async (): Promise<boolean> => {
    try {
      if (!window.electronAPI) return false;
      setSelecting(true);
      setDbError(null);
      const result = await window.electronAPI.selectDbFile();
      console.log('[AuthContext] selectDbFile result:', result);
      if (result.success && result.dbPath) {
        setDbPath(result.dbPath);
        setDbFile(result.dbFile || 'db_myfinances.sqlite');

        // Verifica se o banco selecionado já possui usuário
        try {
          const authStatus = await window.electronAPI.getAuthStatus();
          setHasUser(authStatus.hasUser);
          setRegisteredUserName(authStatus.userName || null);
        } catch {
          setHasUser(false);
          setRegisteredUserName(null);
        }
        return true;
      }
      if (!result.success && result.error && result.error !== 'Seleção cancelada pelo usuário') {
        setDbError(result.error);
      }
      return false;
    } catch (err: any) {
      console.error('Error selecting DB file:', err);
      setDbError(err?.message || 'Erro ao selecionar o arquivo do banco de dados');
      return false;
    } finally {
      setSelecting(false);
    }
  };

  const register = async (name: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!window.electronAPI) return { success: false, error: 'API do Electron não disponível' };
      const res = await window.electronAPI.registerUser(name, pass);
      if (res.success && res.user) {
        setUser(res.user);
        setHasUser(true);
        setRegisteredUserName(res.user.name);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, error: res.error || 'Falha ao registrar usuário' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao registrar' };
    }
  };

  const login = async (name: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!window.electronAPI) return { success: false, error: 'API do Electron não disponível' };
      const res = await window.electronAPI.login(name, pass);
      if (res.success && res.user) {
        setUser(res.user);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, error: res.error || 'Credenciais inválidas' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro no login' };
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_USER_KEY);
  };

  const resetDbSelection = () => {
    setUser(null);
    setDbPath(null);
    sessionStorage.removeItem(SESSION_USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        dbPath,
        dbFile,
        user,
        hasUser,
        registeredUserName,
        loading,
        selecting,
        dbError,
        clearDbError,
        selectFolder,
        selectFile,
        register,
        login,
        logout,
        resetDbSelection,
        refreshState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
