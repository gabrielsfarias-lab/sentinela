export interface LoginCredentials {
    email?: string;
    password?: string;
}


export interface RegisterData {
    email?: string;
    password?: string;
    confirmPassword?: string;
}

export interface AuthContextType {
    isAuthenticated: boolean;
    userEmail: string | null;
    token: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: (options?: { navigate?: (path: string, navigateOptions?: { replace?: boolean }) => void }) => void;
    isLoading: boolean;
    authLoading: boolean;
}