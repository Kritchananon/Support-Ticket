// ===== Permission Enum (ตรงกับ Backend) =====
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
  OPEN_TICKET = 10,           // เปิด ticket
  RESTORE_TICKET = 11,        // กู้คืน ticket
  VIEW_OWN_TICKETS = 12,      // ดูตั๋วทั้งหมดที่ตัวเองสร้าง
  VIEW_ALL_TICKETS = 13,      // ดูตั๋วทั้งหมด
  SATISFACTION = 14,          // ประเมินความพึงพอใจ
  ADD_USER = 15,              // เพิ่มผู้ใช้
  DEL_USER = 16               // ลบผู้ใช้
}

// ===== Role Constants =====
export const ROLES = {
  ADMIN: 'admin',
  SUPPORTER: 'supporter', 
  USER: 'user',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// ===== ✅ FIXED: Role-Based Permissions Mapping (ใช้ number[] แทน permissionEnum[]) =====
export const ROLE_PERMISSIONS: Record<UserRole, number[]> = {
  [ROLES.ADMIN]: [
    15, // ADD_USER
    9,  // ASSIGNEE
    5,  // CHANGE_STATUS
    7,  // CLOSE_TICKET
    16, // DEL_USER
    10, // OPEN_TICKET
    6,  // REPLY_TICKET
    2,  // TRACK_TICKET
    13, // VIEW_ALL_TICKETS
    8   // SOLVE_PROBLEM
  ],
  [ROLES.SUPPORTER]: [
    5,  // CHANGE_STATUS
    7,  // CLOSE_TICKET
    10, // OPEN_TICKET
    6,  // REPLY_TICKET
    13, // VIEW_ALL_TICKETS
    8,  // SOLVE_PROBLEM
    9   // ASSIGNEE
  ],
  [ROLES.USER]: [
    1,  // CREATE_TICKET
    4,  // DELETE_TICKET
    3,  // EDIT_TICKET
    11, // RESTORE_TICKET
    14, // SATISFACTION
    2,  // TRACK_TICKET
    12  // VIEW_OWN_TICKETS
  ]
};

// ===== ✅ Utility Functions (ไม่ duplicate) =====

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
  missingPermissions: number[];  // ✅ เปลี่ยนเป็น number[]
  userPermissions: number[];     // ✅ เปลี่ยนเป็ number[]
}

export interface RoleCheck {
  hasRole: boolean;
  missingRoles: UserRole[];
  userRoles: UserRole[];
}

export interface AccessControl {
  canAccess: boolean;
  reason?: string;
  requiredPermissions?: number[];  // ✅ เปลี่ยนเป็น number[]
  requiredRoles?: UserRole[];
}

// ===== Permission Helper Functions =====

/**
 * ✅ UPDATED: แปลง permission number เป็นชื่อที่อ่านได้
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
    10: 'Open Ticket',
    11: 'Restore Ticket',
    12: 'View Own Tickets',
    13: 'View All Tickets',
    14: 'Rate Satisfaction',
    15: 'Add User',
    16: 'Delete User'
  };
  
  return permissionNames[permissionNumber] || `Permission ${permissionNumber}`;
}

/**
 * ✅ UPDATED: แปลง permission number เป็นชื่อภาษาไทย
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
    10: 'เปิด ticket',
    11: 'กู้คืน ticket',
    12: 'ดูตั๋วทั้งหมดที่ตัวเองสร้าง',
    13: 'ดูตั๋วทั้งหมด',
    14: 'ประเมินความพึงพอใจ',
    15: 'เพิ่มผู้ใช้',
    16: 'ลบผู้ใช้'
  };
  
  return permissionNamesTh[permissionNumber] || `สิทธิ์ ${permissionNumber}`;
}

/**
 * ✅ UPDATED: ดึง permissions ทั้งหมดของ role (return number[])
 */
export function getRolePermissions(role: UserRole): number[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * ✅ UPDATED: ตรวจสอบว่า role มี permission หรือไม่
 */
export function roleHasPermission(role: UserRole, permission: number | permissionEnum): boolean {
  const permissionNumber = typeof permission === 'number' ? permission : enumToNumber(permission);
  const rolePermissions = getRolePermissions(role);
  return rolePermissions.includes(permissionNumber);
}

/**
 * ✅ UPDATED: ดึง permissions ทั้งหมดจาก roles หลายตัว (return number[])
 */
export function getPermissionsFromRoles(roles: UserRole[]): number[] {
  const allPermissions = roles.flatMap(role => getRolePermissions(role));
  return [...new Set(allPermissions)]; // Remove duplicates
}

/**
 * ✅ UPDATED: ตรวจสอบว่า user มี permission หรือไม่
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
 * ✅ ตรวจสอบว่า user มี role หรือไม่
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
 * ✅ UPDATED: ตรวจสอบ access control แบบรวม (permissions + roles)
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

// ===== ✅ UPDATED: Common Permission Groups (ใช้ number[]) =====
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
    7   // CLOSE_TICKET
  ],
  USER_MANAGEMENT: [
    15, // ADD_USER
    16  // DEL_USER
  ],
  SUPPORT_OPERATIONS: [
    6,  // REPLY_TICKET
    8,  // SOLVE_PROBLEM
    10, // OPEN_TICKET
    11  // RESTORE_TICKET
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

// ===== ✅ Debug Helper Functions (ไม่ duplicate) =====

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