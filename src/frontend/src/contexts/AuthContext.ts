import { createContext } from 'react';
import { type AuthContextType } from '../types/authContextTypes';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
