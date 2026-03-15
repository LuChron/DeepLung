const ACCESS_TOKEN_KEY = 'deeplung_access_token';
const USER_ROLE_KEY = 'deeplung_user_role';
const USERNAME_KEY = 'deeplung_username';

export type UserRole = 'doctor' | 'patient' | 'admin';

export function saveSession(accessToken: string, role: UserRole, username: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(USER_ROLE_KEY, role);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getUserRole(): UserRole | null {
  const value = localStorage.getItem(USER_ROLE_KEY);
  if (value === 'doctor' || value === 'patient' || value === 'admin') {
    return value;
  }
  return null;
}

export function getUsername(): string {
  return localStorage.getItem(USERNAME_KEY) || '';
}
