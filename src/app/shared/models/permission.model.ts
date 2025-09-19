// ===== Permission Enum (ตรงกับ Backend - 20 permissions) =====
export enum permissionEnum {
  CREATE_TICKET = 1,          // แจ้งปัญหา
  TRACK_TICKET = 2,           // ติดตามปัญหา
  EDIT_TICKET = 3,            // แก้ไข ticket
  DELETE_TICKET = 4,          // ลบ ticket
  CHANGE_STATUS = 5,          // เปลี่ยนสถานะของ ticket
  REPLY_TICKET = 6,           // ตอบกลับ ticket
  CLOSE_TICKET = 7,           // ปิด ticket
  SOLVE_PROBLEM = 8,          // แก้ไขปัญหา
  ASSIGNEE = 9,               // ผู้รับเรื่อง
  MANAGE_PROJECT = 10,        // จัดการ project
  RESTORE_TICKET = 11,        // กู้คืน ticket
  VIEW_OWN_TICKETS = 12,      // ดูรายงานตั๋วของตัวเอง
  VIEW_ALL_TICKETS = 13,      // ดูรายงานทั้งหมด
  SATISFACTION = 14,          // ให้คะแนนความพึงพอใจ
  ADD_USER = 15,              // เพิ่มผู้ใช้
  DEL_USER = 16,              // ลบผู้ใช้
  MANAGE_CATEGORY = 17,       // จัดการ category
  MANAGE_STATUS = 18,         // จัดการ status
  VIEW_DASHBOARD = 19,        // มอนเทอริ่ง
  MANAGE_CUSTOMER = 20        // จัดการ customer
}

// ===== Role Constants =====
export const ROLES = {
  ADMIN: 'admin',
  SUPPORTER: 'supporter', 
  USER: 'user',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// ===== UPDATED: Role-Based Permissions Mapping (20 permissions) =====
export const ROLE_PERMISSIONS: Record<UserRole, number[]> = {
  [ROLES.ADMIN]: [
    1,  // CREATE_TICKET
    2,  // TRACK_TICKET
    3,  // EDIT_TICKET
    4,  // DELETE_TICKET
    5,  // CHANGE_STATUS
    6,  // REPLY_TICKET
    7,  // CLOSE_TICKET
    8,  // SOLVE_PROBLEM
    9,  // ASSIGNEE
    10, // MANAGE_PROJECT
    11, // RESTORE_TICKET
    12, // VIEW_OWN_TICKETS
    13, // VIEW_ALL_TICKETS
    14, // SATISFACTION
    15, // ADD_USER
    16, // DELETE_USER
    17, // MANAGE_CATEGORY
    18, // MANAGE_STATUS
    19, // VIEW_DASHBOARD
    20  // MANAGE_CUSTOMER
  ],
  [ROLES.SUPPORTER]: [
    2,  // TRACK_TICKET
    3,  // EDIT_TICKET
    5,  // CHANGE_STATUS
    6,  // REPLY_TICKET
    7,  // CLOSE_TICKET
    8,  // SOLVE_PROBLEM
    9,  // ASSIGNEE
    11, // RESTORE_TICKET
    12, // VIEW_OWN_TICKETS
    13, // VIEW_ALL_TICKETS
    19, // VIEW_DASHBOARD
    20  // MANAGE_CUSTOMER
  ],
  [ROLES.USER]: [
    1,  // CREATE_TICKET
    2,  // TRACK_TICKET
    3,  // EDIT_TICKET (เฉพาะตั๋วของตัวเอง)
    4,  // DELETE_TICKET (เฉพาะตั๋วของตัวเอง)
    12, // VIEW_OWN_TICKETS
    14  // SATISFACTION
  ]
};

// ===== NEW: Safe Validation Functions =====

/**
 * Safe permission validation function
 */
export function validateAndNormalizePermissions(permissions: any): number[] {
  if (!permissions) {
    console.warn('No permissions provided');
    return [];
  }

  if (!Array.isArray(permissions)) {
    console.warn('Permissions is not an array:', typeof permissions);
    return [];
  }

  const validPermissions: number[] = [];
  
  for (const permission of permissions) {
    if (typeof permission === 'number' && !isNaN(permission)) {
      if (isValidPermissionNumber(permission)) {
        validPermissions.push(permission);
      } else {
        console.warn(`Invalid permission number: ${permission}`);
      }
    } else if (typeof permission === 'string') {
      const numPermission = parseInt(permission, 10);
      if (!isNaN(numPermission) && isValidPermissionNumber(numPermission)) {
        validPermissions.push(numPermission);
      } else {
        console.warn(`Cannot convert permission to number: ${permission}`);
      }
    } else {
      console.warn(`Invalid permission type:`, permission);
    }
  }

  console.log(`Validated ${validPermissions.length}/${permissions.length} permissions`);
  return validPermissions;
}

/**
 * Safe role validation function
 */
export function validateAndNormalizeRoles(roles: any): UserRole[] {
  if (!roles) {
    console.warn('No roles provided');
    return [];
  }

  if (!Array.isArray(roles)) {
    console.warn('Roles is not an array:', typeof roles);
    return [];
  }

  const validRoles: UserRole[] = [];
  
  for (const role of roles) {
    if (typeof role === 'string' && Object.values(ROLES).includes(role as UserRole)) {
      validRoles.push(role as UserRole);
    } else {
      console.warn(`Invalid role: ${role}`);
    }
  }

  console.log(`Validated ${validRoles.length}/${roles.length} roles`);
  return validRoles;
}

/**
 * Get safe fallback permissions for user
 */
export function getSafeFallbackPermissions(): number[] {
  return [
    permissionEnum.CREATE_TICKET,     // 1
    permissionEnum.TRACK_TICKET,      // 2
    permissionEnum.VIEW_OWN_TICKETS,  // 12
    permissionEnum.SATISFACTION       // 14
  ];
}

/**
 * Get safe fallback roles for user
 */
export function getSafeFallbackRoles(): UserRole[] {
  return [ROLES.USER];
}

// ===== Utility Functions =====

/**
 * แปลง permissionEnum เป็น number
 */
export function enumToNumber(permission: permissionEnum): number {
  return permission as number;
}

/**
 * แปลง number เป็น permissionEnum (ถ้าเป็น valid enum)
 */
export function numberToEnum(num: number): permissionEnum | null {
  return Object.values(permissionEnum).includes(num) ? (num as permissionEnum) : null;
}

/**
 * แปลง number[] เป็น permissionEnum[]
 */
export function numbersToEnums(numbers: number[]): permissionEnum[] {
  return numbers
    .filter(n => Object.values(permissionEnum).includes(n))
    .map(n => n as permissionEnum);
}

/**
 * แปลง permissionEnum[] เป็น number[]
 */
export function enumsToNumbers(enums: permissionEnum[]): number[] {
  return enums.map(e => e as number);
}

/**
 * ตรวจสอบว่า number เป็น valid permission หรือไม่
 */
export function isValidPermissionNumber(num: number): boolean {
  return Object.values(permissionEnum).includes(num);
}

// ===== Permission Interfaces =====
export interface PermissionCheck {
  hasPermission: boolean;
  missingPermissions: number[];
  userPermissions: number[];
}

export interface RoleCheck {
  hasRole: boolean;
  missingRoles: UserRole[];
  userRoles: UserRole[];
}

export interface AccessControl {
  canAccess: boolean;
  reason?: string;
  requiredPermissions?: number[];
  requiredRoles?: UserRole[];
}

// ===== Permission Helper Functions =====

/**
 * UPDATED: แปลง permission number เป็นชื่อที่อ่านได้ (20 permissions)
 */
export function getPermissionName(permission: number | permissionEnum): string {
  const permissionNumber = typeof permission === 'number' ? permission : enumToNumber(permission);
  
  const permissionNames: Record<number, string> = {
    1: 'Create Ticket',
    2: 'Track Ticket', 
    3: 'Edit Ticket',
    4: 'Delete Ticket',
    5: 'Change Status',
    6: 'Reply Ticket',
    7: 'Close Ticket',
    8: 'Solve Problem',
    9: 'Assign Ticket',
    10: 'Manage Project',
    11: 'Restore Ticket',
    12: 'View Own Tickets',
    13: 'View All Tickets',
    14: 'Rate Satisfaction',
    15: 'Add User',
    16: 'Delete User',
    17: 'Manage Category',
    18: 'Manage Status',
    19: 'View Dashboard',
    20: 'Manage Customer'
  };
  
  return permissionNames[permissionNumber] || `Permission ${permissionNumber}`;
}

/**
 * UPDATED: แปลง permission number เป็นชื่อภาษาไทย (20 permissions)
 */
export function getPermissionNameTh(permission: number | permissionEnum): string {
  const permissionNumber = typeof permission === 'number' ? permission : enumToNumber(permission);
  
  const permissionNamesTh: Record<number, string> = {
    1: 'แจ้งปัญหา',
    2: 'ติดตามปัญหา',
    3: 'แก้ไข ticket',
    4: 'ลบ ticket',
    5: 'เปลี่ยนสถานะของ ticket',
    6: 'ตอบกลับ ticket',
    7: 'ปิด ticket',
    8: 'แก้ไขปัญหา',
    9: 'ผู้รับเรื่อง',
    10: 'จัดการ project',
    11: 'กู้คืน ticket',
    12: 'ดูรายงานตั๋วของตัวเอง',
    13: 'ดูรายงานทั้งหมด',
    14: 'ให้คะแนนความพึงพอใจ',
    15: 'เพิ่มผู้ใช้',
    16: 'ลบผู้ใช้',
    17: 'จัดการ category',
    18: 'จัดการ status',
    19: 'มอนเทอริ่ง',
    20: 'จัดการ customer'
  };
  
  return permissionNamesTh[permissionNumber] || `สิทธิ์ ${permissionNumber}`;
}

/**
 * UPDATED: ดึง permissions ทั้งหมดของ role (return number[])
 */
export function getRolePermissions(role: UserRole): number[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * UPDATED: ตรวจสอบว่า role มี permission หรือไม่
 */
export function roleHasPermission(role: UserRole, permission: number | permissionEnum): boolean {
  const permissionNumber = typeof permission === 'number' ? permission : enumToNumber(permission);
  const rolePermissions = getRolePermissions(role);
  return rolePermissions.includes(permissionNumber);
}

/**
 * UPDATED: ดึง permissions ทั้งหมดจาก roles หลายตัว (return number[])
 */
export function getPermissionsFromRoles(roles: UserRole[]): number[] {
  const allPermissions = roles.flatMap(role => getRolePermissions(role));
  return [...new Set(allPermissions)]; // Remove duplicates
}

/**
 * UPDATED: ตรวจสอบว่า user มี permission หรือไม่
 */
export function checkUserPermission(
  userPermissions: number[], 
  requiredPermissions: number[]
): PermissionCheck {
  const missingPermissions = requiredPermissions.filter(
    permission => !userPermissions.includes(permission)
  );
  
  return {
    hasPermission: missingPermissions.length === 0,
    missingPermissions,
    userPermissions
  };
}

/**
 * ตรวจสอบว่า user มี role หรือไม่
 */
export function checkUserRole(
  userRoles: UserRole[], 
  requiredRoles: UserRole[]
): RoleCheck {
  const missingRoles = requiredRoles.filter(
    role => !userRoles.includes(role)
  );
  
  return {
    hasRole: missingRoles.length === 0,
    missingRoles,
    userRoles
  };
}

/**
 * UPDATED: ตรวจสอบ access control แบบรวม (permissions + roles)
 */
export function checkAccess(
  userPermissions: number[],
  userRoles: UserRole[],
  requiredPermissions?: number[],
  requiredRoles?: UserRole[]
): AccessControl {
  // ถ้าไม่ระบุเงื่อนไขใดๆ = อนุญาต
  if (!requiredPermissions?.length && !requiredRoles?.length) {
    return { canAccess: true };
  }
  
  let hasRequiredPermissions = true;
  let hasRequiredRoles = true;
  let reason = '';
  
  // ตรวจสอบ permissions
  if (requiredPermissions?.length) {
    const permissionCheck = checkUserPermission(userPermissions, requiredPermissions);
    hasRequiredPermissions = permissionCheck.hasPermission;
    
    if (!hasRequiredPermissions) {
      const missingNames = permissionCheck.missingPermissions
        .map(p => getPermissionName(p))
        .join(', ');
      reason += `Missing permissions: ${missingNames}. `;
    }
  }
  
  // ตรวจสอบ roles
  if (requiredRoles?.length) {
    const roleCheck = checkUserRole(userRoles, requiredRoles);
    hasRequiredRoles = roleCheck.hasRole;
    
    if (!hasRequiredRoles) {
      const missingRoles = roleCheck.missingRoles.join(', ');
      reason += `Missing roles: ${missingRoles}. `;
    }
  }
  
  const canAccess = hasRequiredPermissions && hasRequiredRoles;
  
  return {
    canAccess,
    reason: canAccess ? undefined : reason.trim(),
    requiredPermissions,
    requiredRoles
  };
}

// ===== UPDATED: Common Permission Groups (ใช้ number[] - 20 permissions) =====
export const PERMISSION_GROUPS = {
  TICKET_MANAGEMENT: [
    1,  // CREATE_TICKET
    3,  // EDIT_TICKET
    4,  // DELETE_TICKET
    12  // VIEW_OWN_TICKETS
  ],
  TICKET_ADMINISTRATION: [
    13, // VIEW_ALL_TICKETS
    5,  // CHANGE_STATUS
    9,  // ASSIGNEE
    7,  // CLOSE_TICKET
    11  // RESTORE_TICKET
  ],
  USER_MANAGEMENT: [
    15, // ADD_USER
    16  // DELETE_USER
  ],
  SUPPORT_OPERATIONS: [
    6,  // REPLY_TICKET
    8,  // SOLVE_PROBLEM
    2   // TRACK_TICKET
  ],
  SYSTEM_ADMINISTRATION: [
    17, // MANAGE_CATEGORY
    18, // MANAGE_STATUS
    10, // MANAGE_PROJECT
    19  // VIEW_DASHBOARD
  ],
  CUSTOMER_MANAGEMENT: [
    20  // MANAGE_CUSTOMER
  ],
  SATISFACTION: [
    14  // SATISFACTION
  ]
} as const;

// ===== Type Guards =====
export function isValidPermission(value: any): value is permissionEnum {
  return Object.values(permissionEnum).includes(value);
}

export function isValidRole(value: any): value is UserRole {
  return Object.values(ROLES).includes(value);
}

export function isPermissionArray(value: any): value is permissionEnum[] {
  return Array.isArray(value) && value.every(isValidPermission);
}

export function isPermissionNumberArray(value: any): value is number[] {
  return Array.isArray(value) && value.every(isValidPermissionNumber);
}

// ===== Debug Helper Functions =====

/**
 * แสดงข้อมูล role และ permissions สำหรับ debug
 */
export function debugRolePermissions(role: UserRole): void {
  console.group(`🔍 Role Debug: ${role}`);
  const permissions = getRolePermissions(role);
  console.log('Permission numbers:', permissions);
  console.log('Permission names:', permissions.map(p => getPermissionName(p)));
  console.log('Permission names (TH):', permissions.map(p => getPermissionNameTh(p)));
  console.groupEnd();
}

/**
 * แสดงข้อมูล permissions ทั้งหมดสำหรับ debug
 */
export function debugAllRolePermissions(): void {
  console.group('🔍 All Role Permissions Debug');
  Object.values(ROLES).forEach(role => {
    debugRolePermissions(role as UserRole);
  });
  console.groupEnd();
}

/**
 * ตรวจสอบความถูกต้องของ permission mapping
 */
export function validatePermissionMapping(): boolean {
  console.group('✅ Permission Mapping Validation');
  
  let isValid = true;
  
  // ตรวจสอบว่าทุก permission ใน ROLE_PERMISSIONS เป็น valid enum หรือไม่
  Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
    const invalidPermissions = permissions.filter(p => !isValidPermissionNumber(p));
    
    if (invalidPermissions.length > 0) {
      console.error(`❌ Invalid permissions for role ${role}:`, invalidPermissions);
      isValid = false;
    } else {
      console.log(`✅ Role ${role} permissions valid:`, permissions.length, 'permissions');
    }
  });
  
  // ตรวจสอบว่าแต่ละ role มี permission อย่างน้อย 1 ตัว
  Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
    if (permissions.length === 0) {
      console.warn(`⚠️ Role ${role} has no permissions assigned`);
    }
  });
  
  console.log('Validation result:', isValid ? '✅ Valid' : '❌ Invalid');
  console.groupEnd();
  
  return isValid;
}

// ===== NEW: Specific Permission Checkers =====

/**
 * ตรวจสอบว่าสามารถจัดการ ticket ได้หรือไม่
 */
export function canManageTickets(userPermissions: number[]): boolean {
  return PERMISSION_GROUPS.TICKET_ADMINISTRATION.some(permission => 
    userPermissions.includes(permission)
  );
}

/**
 * ตรวจสอบว่าสามารถจัดการ user ได้หรือไม่
 */
export function canManageUsers(userPermissions: number[]): boolean {
  return PERMISSION_GROUPS.USER_MANAGEMENT.some(permission => 
    userPermissions.includes(permission)
  );
}

/**
 * ตรวจสอบว่าสามารถจัดการระบบได้หรือไม่
 */
export function canManageSystem(userPermissions: number[]): boolean {
  return PERMISSION_GROUPS.SYSTEM_ADMINISTRATION.some(permission => 
    userPermissions.includes(permission)
  );
}

/**
 * ตรวจสอบว่าสามารถทำงาน support ได้หรือไม่
 */
export function canDoSupport(userPermissions: number[]): boolean {
  return PERMISSION_GROUPS.SUPPORT_OPERATIONS.some(permission => 
    userPermissions.includes(permission)
  );
}

/**
 * NEW: ตรวจสอบว่าสามารถจัดการ customer ได้หรือไม่
 */
export function canManageCustomer(userPermissions: number[]): boolean {
  return userPermissions.includes(20); // MANAGE_CUSTOMER
}

/**
 * NEW: ตรวจสอบว่าสามารถจัดการ project ได้หรือไม่
 */
export function canManageProject(userPermissions: number[]): boolean {
  return userPermissions.includes(10); // MANAGE_PROJECT
}

/**
 * NEW: ตรวจสอบว่าสามารถจัดการ category ได้หรือไม่
 */
export function canManageCategory(userPermissions: number[]): boolean {
  return userPermissions.includes(17); // MANAGE_CATEGORY
}

/**
 * NEW: ตรวจสอบว่าสามารถจัดการ status ได้หรือไม่
 */
export function canManageStatus(userPermissions: number[]): boolean {
  return userPermissions.includes(18); // MANAGE_STATUS
}

/**
 * NEW: ตรวจสอบว่าสามารถดู dashboard ได้หรือไม่
 */
export function canViewDashboard(userPermissions: number[]): boolean {
  return userPermissions.includes(19); // VIEW_DASHBOARD
}

/**
 * NEW: ตรวจสอบว่าสามารถให้คะแนนความพึงพอใจได้หรือไม่
 */
export function canRateSatisfaction(userPermissions: number[]): boolean {
  return userPermissions.includes(14); // SATISFACTION
}

// ===== NEW: Permission Summary Functions =====

/**
 * สรุป permissions ที่ user มีทั้งหมด
 */
export function summarizeUserPermissions(userPermissions: number[]): {
  total: number;
  byGroup: Record<string, { permissions: number[]; names: string[] }>;
  missing: Record<string, { permissions: number[]; names: string[] }>;
} {
  const summary = {
    total: userPermissions.length,
    byGroup: {} as Record<string, { permissions: number[]; names: string[] }>,
    missing: {} as Record<string, { permissions: number[]; names: string[] }>
  };

  // จัดกลุ่ม permissions ที่มี
  Object.entries(PERMISSION_GROUPS).forEach(([groupName, groupPermissions]) => {
    const hasPermissions = groupPermissions.filter(p => userPermissions.includes(p));
    const missingPermissions = groupPermissions.filter(p => !userPermissions.includes(p));
    
    summary.byGroup[groupName] = {
      permissions: hasPermissions,
      names: hasPermissions.map(p => getPermissionNameTh(p))
    };
    
    if (missingPermissions.length > 0) {
      summary.missing[groupName] = {
        permissions: missingPermissions,
        names: missingPermissions.map(p => getPermissionNameTh(p))
      };
    }
  });

  return summary;
}

/**
 * แสดงสรุป permissions ใน console
 */
export function logPermissionSummary(userPermissions: number[], userRoles: UserRole[]): void {
  console.group('📊 Permission Summary');
  
  console.log('👥 User Roles:', userRoles);
  console.log('🔢 Total Permissions:', userPermissions.length, '/ 20');
  
  const summary = summarizeUserPermissions(userPermissions);
  
  Object.entries(summary.byGroup).forEach(([groupName, data]) => {
    if (data.permissions.length > 0) {
      console.log(`✅ ${groupName}:`, data.names);
    }
  });
  
  Object.entries(summary.missing).forEach(([groupName, data]) => {
    if (data.permissions.length > 0) {
      console.log(`❌ Missing ${groupName}:`, data.names);
    }
  });
  
  console.groupEnd();
}