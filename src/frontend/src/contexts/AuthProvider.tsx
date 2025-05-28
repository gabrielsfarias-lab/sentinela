import { useState, type ReactNode, useEffect } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  setAuthToken,
  clearAuthToken
} from '../services/AuthService';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AuthContext } from './AuthContext';
import { type LoginCredentials, type RegisterData } from '../types/authContextTypes';

// O componente AuthProvider é o único exportado daqui
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [tokenState, setTokenState] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('userEmail'));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const performLogoutActions = () => {
    setTokenState(null);
    setUserEmail(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    clearAuthToken();
  };

  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
          const originalRequestUrl = error.config?.url?.toString() || '';
          const isAuthEndpointAttempt =
            originalRequestUrl.endsWith('/login') ||
            originalRequestUrl.endsWith('/cadastro') ||
            originalRequestUrl.endsWith('/forgot-password') ||
            originalRequestUrl.endsWith('/reset-password');

          if (!isAuthEndpointAttempt) {
            console.warn("AuthProvider Interceptor: Erro 401. Deslogando.", originalRequestUrl);
            performLogoutActions();
            toast.info("Sua sessão expirou ou é inválida. Por favor, faça login novamente.");
          } else {
            console.warn(`AuthProvider Interceptor: Erro 401 na rota de auth ${originalRequestUrl}.`);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedEmail = localStorage.getItem('userEmail');
    if (storedToken) {
      setTokenState(storedToken);
      setUserEmail(storedEmail || null);
      setAuthToken(storedToken);
    }
    setAuthLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await apiLogin(credentials);
      setTokenState(response.token);
      setUserEmail(response.email);
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('userEmail', response.email);
      // setAuthToken é chamado por apiLogin
    } catch (error: unknown) {
      performLogoutActions(); // Limpa em caso de falha
      // O erro é re-lançado para ser tratado pelo LoginPage
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      await apiRegister(data);
      // RegisterPage mostrará mensagem de sucesso.
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (options?: { navigate?: (path: string, navigateOptions?: { replace?: boolean }) => void }) => {
    performLogoutActions();
    if (options?.navigate) {
      options.navigate('/login', { replace: true });
    } else {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!tokenState,
      userEmail,
      token: tokenState,
      login,
      register,
      logout,
      isLoading,
      authLoading
    }}>
      {!authLoading ? children : <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2em' }}>Verificando autenticação inicial...</div>}
    </AuthContext.Provider>
  );
};
export { AuthContext };

