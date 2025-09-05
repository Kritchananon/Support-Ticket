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

  companyAddress?: string;
  project?: string;
  // ✅ เพิ่ม role และ permission fields
  roles?: UserRole[];
  permissions?: permissionEnum[];
}

// ===== NEW: Create User DTO ===== ✅
export interface CreateUserDto {
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  start_date?: string;
  end_date?: string;
  create_by?: number;
  update_by?: number;
  isenabled?: boolean;
  // สำหรับรหัสผ่าน (ถ้า backend ต้องการ)
  password?: string;
  // สำหรับ role assignment
  roles?: UserRole[];
}

// ===== NEW: Create User Response ===== ✅
export interface CreateUserResponse {
  code: number;
  status: boolean;
  message: string;
  data?: {
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
  };
}

// ===== NEW: User Account Response ===== ✅
export interface UserAccountResponse {
  code: number;
  status: boolean;
  message: string;
  data?: User[];
}

// ===== NEW: User Account Item ===== ✅
export interface UserAccountItem {
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
  last_login?: string;
  full_name?: string; // computed field
  avatar?: string; // computed field
  avatarColor?: string; // computed field
  company?: string; // ถ้ามีข้อมูล company
  company_address?: string;
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

// ✅ NEW: Interfaces สำหรับ Assign Ticket API =====
export interface AssignTicketRequest {
  assignedTo: number;
}

export interface AssignTicketResponse {
  message: string;
  ticket_no: string;
  assigned_to: number;
}

export interface AssignTicketPayload {
  ticketNo: string,
  assignTo: number
}

// ✅ NEW: Interfaces สำหรับ Role 9 Users API =====
export interface Role9User {
  id: number;
  name: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
}

export interface Role9UsersResponse {
  users: Role9User[];
}

// ✅ NEW: Generic User List Item (สำหรับ dropdown) =====
export interface UserListItem {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  isenabled: boolean;
  full_name?: string; // computed field
}

export interface UserListResponse {
  code: number;
  message: string;
  data: UserListItem[];
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

// ===== NEW: Create User Utility Functions ===== ✅

/**
 * สร้าง CreateUserDto ที่ว่างเปล่า
 */
export function createEmptyCreateUserDto(): CreateUserDto {
  return {
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    start_date: '',
    end_date: '',
    isenabled: true,
    password: '',
    roles: []
  };
}

/**
 * สร้าง UserAccountItem จาก User data
 */
export function createUserAccountItem(user: User): UserAccountItem {
  return {
    ...user,
    full_name: getUserFullName(user),
    avatar: getUserInitials(user),
    avatarColor: generateAvatarColor(user.id),
    last_login: user.update_date || user.create_date || new Date().toISOString()
  };
}

/**
 * สร้างสี avatar แบบสุ่มตาม user ID
 */
export function generateAvatarColor(userId: number): string {
  const colors = [
    '#5873F8', '#28A745', '#FFC107', '#1FBCD5', 
    '#DC3545', '#6F42C1', '#FD7E14', '#20C997'
  ];
  return colors[userId % colors.length];
}

/**
 * แปลง UserAccountItem เป็น CreateUserDto สำหรับการแก้ไข
 */
export function userAccountItemToCreateUserDto(item: UserAccountItem): CreateUserDto {
  return {
    username: item.username,
    firstname: item.firstname,
    lastname: item.lastname,
    email: item.email,
    phone: item.phone,
    start_date: item.start_date,
    end_date: item.end_date,
    isenabled: item.isenabled,
    update_by: item.update_by
  };
}

/**
 * ตรวจสอบว่าข้อมูล CreateUserDto ถูกต้องหรือไม่
 */
export function validateCreateUserDto(dto: CreateUserDto): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!dto.username || dto.username.trim().length === 0) {
    errors.push('Username is required');
  }

  if (dto.username && dto.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (dto.email && !isValidEmail(dto.email)) {
    errors.push('Invalid email format');
  }

  if (dto.phone && !isValidPhone(dto.phone)) {
    errors.push('Invalid phone number format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ตรวจสอบรูปแบบอีเมล
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * ตรวจสอบรูปแบบเบอร์โทรศัพท์
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[0-9]{9,10}$/;
  return phoneRegex.test(phone.replace(/[-\s]/g, ''));
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
export function getUserFullName(user: User | UserListItem | Role9User | UserAccountItem | null): string {
  if (!user) return '';

  // Check for UserAccountItem with full_name
  if ('full_name' in user && user.full_name) {
    return user.full_name;
  }

  // Check for Role9User with name field
  if ('name' in user && user.name) {
    return user.name;
  }

  // Standard User interface
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
export function getUserInitials(user: User | UserAccountItem | null): string {
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

export function isCreateUserDto(obj: any): obj is CreateUserDto {
  return obj &&
    typeof obj.username === 'string';
}

export function isUserAccountItem(obj: any): obj is UserAccountItem {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.username === 'string' &&
    typeof obj.isenabled === 'boolean';
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