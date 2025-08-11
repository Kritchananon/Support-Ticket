// ===== User Interface =====
export interface User {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  start_date?: string;
  end_date?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

// ===== Login Request Interface =====
export interface LoginRequest {
  username: string;
  password: string;
}

// ===== Backend Login Response Interface (ตรงกับ Backend) =====
export interface LoginResponse {
  code: number;                    // 1 = success, 0 = error
  status: boolean;                 // true = success, false = error
  message: string;                 // ข้อความแจ้งผลลัพธ์
  user: {                         // ข้อมูลผู้ใช้
    id: number;
    username: string;
  } | null;
  access_token: string | null;     // JWT token
  expires_in?: string;             // เช่น "3h"
  expires_at?: string;             // ISO string
  token_expires_timestamp?: number; // Unix timestamp
  permission?: string[];           // สิทธิ์ของผู้ใช้
}

// ===== Token Data Interface =====
export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: string;
  expires_at?: string;
  token_expires_timestamp?: number;
}

// ===== User Permission Interface =====
export interface UserPermission {
  id: number;
  name: string;
  code: string;
  description?: string;
  module?: string;
}

// ===== Extended User Interface (กับ permissions) =====
export interface UserWithPermissions extends User {
  permissions?: UserPermission[];
  roles?: string[];
  last_login?: string;
  login_count?: number;
}

// ===== Login Form Data Interface =====
export interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

// ===== Auth State Interface =====
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  permissions: string[];
  expires_at: Date | null;
  last_activity: Date | null;
}

// ===== Session Info Interface =====
export interface SessionInfo {
  user_id: number;
  username: string;
  login_time: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  permissions: string[];
}

// ===== Error Response Interface =====
export interface AuthErrorResponse {
  code: number;
  status: boolean;
  message: string;
  user: null;
  access_token: null;
  errors?: {
    [key: string]: string[];
  };
}

// ===== Utility Functions =====
export function createEmptyAuthState(): AuthState {
  return {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    token: null,
    permissions: [],
    expires_at: null,
    last_activity: null
  };
}

export function createLoginFormData(): LoginFormData {
  return {
    username: '',
    password: '',
    rememberMe: false
  };
}

export function isLoginSuccessResponse(response: LoginResponse): boolean {
  return response.code === 1 && 
         response.status === true && 
         !!response.access_token && 
         !!response.user;
}

export function extractTokenData(response: LoginResponse): TokenData | null {
  if (!isLoginSuccessResponse(response)) {
    return null;
  }

  return {
    access_token: response.access_token!,
    expires_in: response.expires_in,
    expires_at: response.expires_at,
    token_expires_timestamp: response.token_expires_timestamp
  };
}

export function extractUserData(response: LoginResponse): User | null {
  if (!isLoginSuccessResponse(response) || !response.user) {
    return null;
  }

  return {
    id: response.user.id,
    username: response.user.username,
    // เพิ่มข้อมูลอื่นๆ ถ้า Backend ส่งมา
    isenabled: true
  };
}

// ===== Type Guards =====
export function isUser(obj: any): obj is User {
  return obj && 
         typeof obj.id === 'number' && 
         typeof obj.username === 'string';
}

export function isLoginResponse(obj: any): obj is LoginResponse {
  return obj && 
         typeof obj.code === 'number' && 
         typeof obj.status === 'boolean' && 
         typeof obj.message === 'string';
}

export function isTokenData(obj: any): obj is TokenData {
  return obj && 
         typeof obj.access_token === 'string';
}

// ===== Constants =====
export const LOGIN_SUCCESS_CODE = 1;
export const LOGIN_ERROR_CODE = 0;

export const PERMISSION_CODES = {
  TICKET_CREATE: 'ticket.create',
  TICKET_READ: 'ticket.read',
  TICKET_UPDATE: 'ticket.update',
  TICKET_DELETE: 'ticket.delete',
  USER_MANAGE: 'user.manage',
  SETTINGS_ACCESS: 'settings.access'
} as const;

export type PermissionCode = typeof PERMISSION_CODES[keyof typeof PERMISSION_CODES];