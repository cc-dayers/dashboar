import { createContext, useContext } from 'react'

export const AuthContext = createContext<string | null>(null)

export function useAuth(): string | null {
  return useContext(AuthContext)
}
