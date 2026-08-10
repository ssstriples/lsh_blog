export type UserRole = "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface SignupResponseData {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface RefreshResponseData {
  accessToken: string;
}
