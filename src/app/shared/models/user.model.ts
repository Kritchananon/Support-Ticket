// ✅ Import permission-related types
import { permissionEnum, UserRole, ROLES } from './permission.model';

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
  // ✅ เพิ่ม role และ permission fields
  roles?: UserRole[];
  permissions?: permissionEnum[];
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
    firstname?: string;
    lastname?: string;
    email?: string;
    roles?: UserRole[];           // ✅ เพิ่ม roles ใน response
  } | null;
  access_token: string | null;     // JWT token
  expires_in?: string;             // เช่น "3h"
  expires_at?: string;             // ISO string
  token_expires_timestamp?: number; // Unix timestamp
  permission?: permissionEnum[];   // ✅ ปรับเป็น permissionEnum[] แทน string[]
  roles?: UserRole[];              // ✅ เพิ่ม roles ใน response
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

// ===== Enhanced User Interface (กับ permissions และ roles) =====
export interface UserWithPermissions extends User {
  permissions: permissionEnum[];   // ✅ ใช้ permissionEnum แทน UserPermission[]
  roles: UserRole[];               // ✅ ใช้ UserRole แทน string[]
  last_login?: string;
  login_count?: number;
  effective_permissions?: permissionEnum[]; // ✅ permissions ที่ได้จาก roles
}

// ===== Login Form Data Interface =====
export interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

// ===== Enhanced Auth State Interface =====
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  permissions: permissionEnum[];   // ✅ ปรับเป็น permissionEnum[]
  roles: UserRole[];               // ✅ เพิ่ม roles
  expires_at: Date | null;
  last_activity: Date | null;
  // ✅ เพิ่มข้อมูลเกี่ยวกับ role และ permission
  role_permissions?: Record<UserRole, permissionEnum[]>;
  effective_permissions?: permissionEnum[];
}

// ===== Session Info Interface =====
export interface SessionInfo {
  user_id: number;
  username: string;
  login_time: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  permissions: permissionEnum[];   // ✅ ปรับเป็น permissionEnum[]
  roles: UserRole[];               // ✅ เพิ่ม roles
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

// ===== Role Management Interfaces ===== ✅
export interface RoleAssignment {
  user_id: number;
  role: UserRole;
  assigned_by: number;
  assigned_at: string;
  is_active: boolean;
}

export interface RolePermissionMapping {
  role: UserRole;
  permissions: permissionEnum[];
  description?: string;
  is_system_role: boolean;
}

export interface UserRoleInfo {
  roles: UserRole[];
  primary_role?: UserRole;
  permissions: permissionEnum[];
  role_assignments: RoleAssignment[];
}

// ===== Utility Functions =====
export function createEmptyAuthState(): AuthState {
  return {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    token: null,
    permissions: [],
    roles: [],                     // ✅ เพิ่ม roles
    expires_at: null,
    last_activity: null,
    effective_permissions: []      // ✅ เพิ่ม effective_permissions
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

export function extractUserData(response: LoginResponse): UserWithPermissions | null {
  if (!isLoginSuccessResponse(response) || !response.user) {
    return null;
  }

  return {
    id: response.user.id,
    username: response.user.username,
    firstname: response.user.firstname,
    lastname: response.user.lastname,
    email: response.user.email,
    isenabled: true,
    // ✅ เพิ่มข้อมูล permissions และ roles
    permissions: response.permission || [],
    roles: response.roles || response.user.roles || [],
    effective_permissions: response.permission || []
  };
}

// ===== Enhanced Utility Functions ===== ✅

/**
 * ✅ สร้าง UserWithPermissions จาก User และ permissions/roles
 */
export function createUserWithPermissions(
  user: User, 
  permissions: permissionEnum[] = [], 
  roles: UserRole[] = []
): UserWithPermissions {
  return {
    ...user,
    permissions,
    roles,
    effective_permissions: permissions
  };
}

/**
 * ✅ ตรวจสอบว่า user มี role หรือไม่
 */
export function userHasRole(user: User | UserWithPermissions | null, role: UserRole): boolean {
  if (!user || !('roles' in user)) return false;
  return user.roles?.includes(role) || false;
}

/**
 * ✅ ตรวจสอบว่า user มี permission หรือไม่
 */
export function userHasPermission(user: User | UserWithPermissions | null, permission: permissionEnum): boolean {
  if (!user || !('permissions' in user)) return false;
  return user.permissions?.includes(permission) || false;
}

/**
 * ✅ ตรวจสอบว่า user มี role ใดๆ ใน list หรือไม่
 */
export function userHasAnyRole(user: User | UserWithPermissions | null, roles: UserRole[]): boolean {
  if (!user || !('roles' in user) || !user.roles) return false;
  return roles.some(role => user.roles!.includes(role));
}

/**
 * ✅ ตรวจสอบว่า user มี permission ใดๆ ใน list หรือไม่
 */
export function userHasAnyPermission(user: User | UserWithPermissions | null, permissions: permissionEnum[]): boolean {
  if (!user || !('permissions' in user) || !user.permissions) return false;
  return permissions.some(permission => user.permissions!.includes(permission));
}

/**
 * ✅ ดึงชื่อเต็มของ user
 */
export function getUserFullName(user: User | null): string {
  if (!user) return '';
  
  const firstName = user.firstname || '';
  const lastName = user.lastname || '';
  
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  return user.username || 'User';
}

/**
 * ✅ ดึงชื่อย่อของ user
 */
export function getUserInitials(user: User | null): string {
  if (!user) return 'U';
  
  const firstName = user.firstname || '';
  const lastName = user.lastname || '';
  
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  
  const username = user.username || 'User';
  return username.charAt(0).toUpperCase();
}

/**
 * ✅ สร้าง auth state จาก login response
 */
export function createAuthStateFromLoginResponse(
  response: LoginResponse,
  user: UserWithPermissions,
  token: string
): AuthState {
  return {
    isAuthenticated: true,
    isLoading: false,
    user: user,
    token: token,
    permissions: user.permissions,
    roles: user.roles,
    expires_at: response.expires_at ? new Date(response.expires_at) : null,
    last_activity: new Date(),
    effective_permissions: user.effective_permissions
  };
}

// ===== Type Guards =====
export function isUser(obj: any): obj is User {
  return obj && 
         typeof obj.id === 'number' && 
         typeof obj.username === 'string';
}

export function isUserWithPermissions(obj: any): obj is UserWithPermissions {
  return isUser(obj) && 
         Array.isArray(obj.permissions) && 
         Array.isArray(obj.roles);
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

export function isValidAuthState(obj: any): obj is AuthState {
  return obj &&
         typeof obj.isAuthenticated === 'boolean' &&
         Array.isArray(obj.permissions) &&
         Array.isArray(obj.roles);
}

// ===== Constants =====
export const LOGIN_SUCCESS_CODE = 1;
export const LOGIN_ERROR_CODE = 0;

// ✅ เก็บ permission constants ไว้เพื่อ backward compatibility
export const PERMISSION_CODES = {
  TICKET_CREATE: 'ticket.create',
  TICKET_READ: 'ticket.read',
  TICKET_UPDATE: 'ticket.update',
  TICKET_DELETE: 'ticket.delete',
  USER_MANAGE: 'user.manage',
  SETTINGS_ACCESS: 'settings.access'
} as const;

export type PermissionCode = typeof PERMISSION_CODES[keyof typeof PERMISSION_CODES];

// ===== Default Roles and Permissions ===== ✅
export const DEFAULT_USER_ROLES: UserRole[] = [ROLES.USER];
export const DEFAULT_USER_PERMISSIONS: permissionEnum[] = [
  permissionEnum.CREATE_TICKET,
  permissionEnum.VIEW_OWN_TICKETS,
  permissionEnum.TRACK_TICKET
];

// ===== Auth State Helpers ===== ✅
export class AuthStateHelper {
  static hasRole(state: AuthState, role: UserRole): boolean {
    return state.roles.includes(role);
  }

  static hasAnyRole(state: AuthState, roles: UserRole[]): boolean {
    return roles.some(role => state.roles.includes(role));
  }

  static hasAllRoles(state: AuthState, roles: UserRole[]): boolean {
    return roles.every(role => state.roles.includes(role));
  }

  static hasPermission(state: AuthState, permission: permissionEnum): boolean {
    return state.permissions.includes(permission) || 
           (state.effective_permissions?.includes(permission) || false);
  }

  static hasAnyPermission(state: AuthState, permissions: permissionEnum[]): boolean {
    return permissions.some(permission => this.hasPermission(state, permission));
  }

  static hasAllPermissions(state: AuthState, permissions: permissionEnum[]): boolean {
    return permissions.every(permission => this.hasPermission(state, permission));
  }

  static isAdmin(state: AuthState): boolean {
    return this.hasRole(state, ROLES.ADMIN);
  }

  static isSupporter(state: AuthState): boolean {
    return this.hasRole(state, ROLES.SUPPORTER);
  }

  static isUser(state: AuthState): boolean {
    return this.hasRole(state, ROLES.USER);
  }

  static canManageUsers(state: AuthState): boolean {
    return this.hasPermission(state, permissionEnum.ADD_USER) || 
           this.hasPermission(state, permissionEnum.DEL_USER);
  }

  static canManageTickets(state: AuthState): boolean {
    return this.hasPermission(state, permissionEnum.VIEW_ALL_TICKETS) ||
           this.hasPermission(state, permissionEnum.CHANGE_STATUS);
  }

  static getPrimaryRole(state: AuthState): UserRole | null {
    if (this.isAdmin(state)) return ROLES.ADMIN;
    if (this.isSupporter(state)) return ROLES.SUPPORTER;
    if (this.isUser(state)) return ROLES.USER;
    return null;
  }
}