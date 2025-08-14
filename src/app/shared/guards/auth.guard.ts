import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { permissionEnum, UserRole, checkAccess } from '../models/permission.model';

/**
 * ✅ Enhanced Auth Guard with Permission and Role Support
 * 
 * Usage in routes:
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [authGuard],
 *   data: {
 *     permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
 *     roles: ['admin'],
 *     requireAllPermissions: true,
 *     requireAllRoles: false
 *   }
 * }
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot, 
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔐 Auth Guard checking access for:', state.url);
  console.log('Route data:', route.data);

  // ===== 1. Basic Authentication Check ===== ✅
  
  if (!authService.isAuthenticated()) {
    console.log('❌ Not authenticated, redirecting to login');
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  console.log('✅ User is authenticated');

  // ===== 2. Permission and Role Extraction ===== ✅
  
  const requiredPermissions: permissionEnum[] = route.data['permissions'] || [];
  const requiredRoles: UserRole[] = route.data['roles'] || [];
  const requireAllPermissions: boolean = route.data['requireAllPermissions'] || false;
  const requireAllRoles: boolean = route.data['requireAllRoles'] || false;

  // ถ้าไม่มีเงื่อนไข permission หรือ role = อนุญาต
  if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
    console.log('✅ No specific permissions or roles required, allowing access');
    return true;
  }

  // ===== 3. User Data Validation ===== ✅
  
  const userPermissions = authService.getEffectivePermissions();
  const userRoles = authService.getUserRoles();
  const currentUser = authService.getCurrentUser();

  console.log('🔍 Access control check:', {
    userRoles,
    userPermissionCount: userPermissions.length,
    requiredPermissions,
    requiredRoles,
    requireAllPermissions,
    requireAllRoles
  });

  // ===== 4. Permission Checking ===== ✅
  
  let hasRequiredPermissions = true;
  let permissionMessage = '';

  if (requiredPermissions.length > 0) {
    if (requireAllPermissions) {
      // ต้องมีทุก permission
      hasRequiredPermissions = authService.hasAllPermissions(requiredPermissions);
      if (!hasRequiredPermissions) {
        const missingPermissions = authService.getMissingPermissions(requiredPermissions);
        permissionMessage = `Missing required permissions: ${missingPermissions.join(', ')}`;
      }
    } else {
      // มีอย่างน้อย 1 permission
      hasRequiredPermissions = authService.hasAnyPermission(requiredPermissions);
      if (!hasRequiredPermissions) {
        permissionMessage = `Missing any of required permissions: ${requiredPermissions.join(', ')}`;
      }
    }
  }

  // ===== 5. Role Checking ===== ✅
  
  let hasRequiredRoles = true;
  let roleMessage = '';

  if (requiredRoles.length > 0) {
    if (requireAllRoles) {
      // ต้องมีทุก role
      hasRequiredRoles = authService.hasAllRoles(requiredRoles);
      if (!hasRequiredRoles) {
        const missingRoles = authService.getMissingRoles(requiredRoles);
        roleMessage = `Missing required roles: ${missingRoles.join(', ')}`;
      }
    } else {
      // มีอย่างน้อย 1 role
      hasRequiredRoles = authService.hasAnyRole(requiredRoles);
      if (!hasRequiredRoles) {
        roleMessage = `Missing any of required roles: ${requiredRoles.join(', ')}`;
      }
    }
  }

  // ===== 6. Access Decision ===== ✅
  
  const hasAccess = hasRequiredPermissions && hasRequiredRoles;

  if (hasAccess) {
    console.log('✅ Access granted to:', state.url);
    console.log('User has:', {
      roles: userRoles,
      permissions: userPermissions.length + ' permissions'
    });
    return true;
  } else {
    // ===== 7. Access Denied Handling ===== ✅
    
    const errorMessages: string[] = [];
    
    if (permissionMessage) {
      errorMessages.push(permissionMessage);
    }
    
    if (roleMessage) {
      errorMessages.push(roleMessage);
    }

    const fullErrorMessage = errorMessages.join('. ');
    
    console.log('❌ Access denied to:', state.url);
    console.log('Reason:', fullErrorMessage);
    console.log('User info:', {
      username: currentUser?.username,
      roles: userRoles,
      permissionCount: userPermissions.length
    });

    // ส่งไปหน้า access denied หรือกลับไป dashboard
    handleAccessDenied(router, state.url, fullErrorMessage, {
      requiredPermissions,
      requiredRoles,
      userPermissions,
      userRoles
    });

    return false;
  }
};

/**
 * ✅ จัดการเมื่อถูกปฏิเสธการเข้าถึง
 */
function handleAccessDenied(
  router: Router, 
  attemptedUrl: string, 
  reason: string,
  context: {
    requiredPermissions: permissionEnum[];
    requiredRoles: UserRole[];
    userPermissions: permissionEnum[];
    userRoles: UserRole[];
  }
): void {
  
  // ตัวอย่าง: ถ้ามีหน้า access-denied
  // router.navigate(['/access-denied'], {
  //   queryParams: {
  //     attemptedUrl,
  //     reason: encodeURIComponent(reason)
  //   }
  // });

  // หรือแสดง alert และกลับไป dashboard
  const userFriendlyMessage = createUserFriendlyAccessDeniedMessage(context);
  
  // แสดง notification (ถ้ามี notification service)
  console.warn('🚫 Access Denied:', userFriendlyMessage);
  
  // TODO: เพิ่ม notification service
  // this.notificationService.showError(userFriendlyMessage);
  
  // กลับไป dashboard
  router.navigate(['/dashboard'], {
    queryParams: {
      accessDenied: 'true',
      reason: encodeURIComponent(reason)
    }
  });
}

/**
 * ✅ สร้างข้อความแจ้งเตือนที่เป็นมิตรกับผู้ใช้
 */
function createUserFriendlyAccessDeniedMessage(context: {
  requiredPermissions: permissionEnum[];
  requiredRoles: UserRole[];
  userPermissions: permissionEnum[];
  userRoles: UserRole[];
}): string {
  
  const messages: string[] = [];
  
  // ตรวจสอบ role requirements
  if (context.requiredRoles.length > 0) {
    const roleNames = context.requiredRoles.map(role => {
      switch (role) {
        case 'admin': return 'ผู้ดูแลระบบ';
        case 'supporter': return 'ผู้สนับสนุน';
        case 'user': return 'ผู้ใช้งาน';
        default: return role;
      }
    });
    
    messages.push(`ต้องการสิทธิ์: ${roleNames.join(' หรือ ')}`);
  }
  
  // ตรวจสอบ permission requirements
  if (context.requiredPermissions.length > 0) {
    const permissionNames = context.requiredPermissions.map(permission => {
      // แปลง permission enum เป็นชื่อที่อ่านได้
      switch (permission) {
        case permissionEnum.ADD_USER: return 'เพิ่มผู้ใช้';
        case permissionEnum.DEL_USER: return 'ลบผู้ใช้';
        case permissionEnum.VIEW_ALL_TICKETS: return 'ดูตั๋วทั้งหมด';
        case permissionEnum.CREATE_TICKET: return 'สร้างตั๋ว';
        case permissionEnum.EDIT_TICKET: return 'แก้ไขตั๋ว';
        case permissionEnum.DELETE_TICKET: return 'ลบตั๋ว';
        case permissionEnum.CHANGE_STATUS: return 'เปลี่ยนสถานะตั๋ว';
        default: return `Permission ${permission}`;
      }
    });
    
    messages.push(`ต้องการสิทธิ์: ${permissionNames.join(', ')}`);
  }
  
  if (messages.length === 0) {
    return 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้';
  }
  
  return `ไม่สามารถเข้าถึงได้ ${messages.join(' และ ')}`;
}

// ===== Specialized Guards ===== ✅

/**
 * ✅ Guard สำหรับ Admin เท่านั้น
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👑 Admin Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (!authService.isAdmin()) {
    console.log('❌ User is not admin');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์ผู้ดูแลระบบ', {
      requiredPermissions: [],
      requiredRoles: ['admin'],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles()
    });
    return false;
  }

  console.log('✅ Admin access granted');
  return true;
};

/**
 * ✅ Guard สำหรับ Support Team (Admin + Supporter)
 */
export const supportGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🛠️ Support Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (!authService.hasAnyRole(['admin', 'supporter'])) {
    console.log('❌ User is not support team member');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์ทีมสนับสนุน', {
      requiredPermissions: [],
      requiredRoles: ['admin', 'supporter'],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles()
    });
    return false;
  }

  console.log('✅ Support team access granted');
  return true;
};

/**
 * ✅ Guard สำหรับ Ticket Management
 */
export const ticketManagementGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🎫 Ticket Management Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const canManage = authService.hasAnyPermission([
    permissionEnum.VIEW_ALL_TICKETS,
    permissionEnum.CHANGE_STATUS,
    permissionEnum.ASSIGNEE,
    permissionEnum.SOLVE_PROBLEM
  ]);

  if (!canManage) {
    console.log('❌ User cannot manage tickets');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์จัดการตั๋ว', {
      requiredPermissions: [
        permissionEnum.VIEW_ALL_TICKETS,
        permissionEnum.CHANGE_STATUS,
        permissionEnum.ASSIGNEE,
        permissionEnum.SOLVE_PROBLEM
      ],
      requiredRoles: [],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles()
    });
    return false;
  }

  console.log('✅ Ticket management access granted');
  return true;
};

/**
 * ✅ Guard สำหรับ User Management
 */
export const userManagementGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👥 User Management Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const canManageUsers = authService.hasAnyPermission([
    permissionEnum.ADD_USER,
    permissionEnum.DEL_USER
  ]);

  if (!canManageUsers) {
    console.log('❌ User cannot manage users');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์จัดการผู้ใช้', {
      requiredPermissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
      requiredRoles: [],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles()
    });
    return false;
  }

  console.log('✅ User management access granted');
  return true;
};

/**
 * ✅ Guard สำหรับ Own Tickets Only (ห้าม admin/supporter เข้า)
 */
export const ownTicketsOnlyGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('📄 Own Tickets Only Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // ตรวจสอบว่าสามารถดูแค่ tickets ของตัวเองได้เท่านั้น
  const canViewOwnOnly = authService.canViewOwnTicketsOnly();

  if (!canViewOwnOnly) {
    console.log('❌ User has elevated permissions, redirecting to all tickets');
    router.navigate(['/tickets']); // Redirect ไปหน้า all tickets
    return false;
  }

  console.log('✅ Own tickets only access granted');
  return true;
};

// ===== Guard Utility Functions ===== ✅

/**
 * ✅ Helper function สำหรับสร้าง custom permission guard
 */
export function createPermissionGuard(
  requiredPermissions: permissionEnum[],
  requireAll: boolean = false
): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const hasPermission = requireAll 
      ? authService.hasAllPermissions(requiredPermissions)
      : authService.hasAnyPermission(requiredPermissions);

    if (!hasPermission) {
      const action = requireAll ? 'ทั้งหมด' : 'อย่างน้อยหนึ่งรายการ';
      handleAccessDenied(router, state.url, `ต้องการสิทธิ์ ${action}`, {
        requiredPermissions,
        requiredRoles: [],
        userPermissions: authService.getEffectivePermissions(),
        userRoles: authService.getUserRoles()
      });
      return false;
    }

    return true;
  };
}

/**
 * ✅ Helper function สำหรับสร้าง custom role guard
 */
export function createRoleGuard(
  requiredRoles: UserRole[],
  requireAll: boolean = false
): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const hasRole = requireAll 
      ? authService.hasAllRoles(requiredRoles)
      : authService.hasAnyRole(requiredRoles);

    if (!hasRole) {
      const action = requireAll ? 'ทั้งหมด' : 'อย่างน้อยหนึ่งตำแหน่ง';
      handleAccessDenied(router, state.url, `ต้องการตำแหน่ง ${action}`, {
        requiredPermissions: [],
        requiredRoles,
        userPermissions: authService.getEffectivePermissions(),
        userRoles: authService.getUserRoles()
      });
      return false;
    }

    return true;
  };
}

/**
 * ✅ Guard สำหรับตรวจสอบหลายเงื่อนไขพร้อมกัน
 */
export function createComplexGuard(config: {
  permissions?: permissionEnum[];
  roles?: UserRole[];
  requireAllPermissions?: boolean;
  requireAllRoles?: boolean;
  customCheck?: (authService: AuthService) => boolean;
  errorMessage?: string;
}): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    // ตรวจสอบ permissions
    if (config.permissions?.length) {
      const hasPermissions = config.requireAllPermissions
        ? authService.hasAllPermissions(config.permissions)
        : authService.hasAnyPermission(config.permissions);
      
      if (!hasPermissions) {
        handleAccessDenied(router, state.url, config.errorMessage || 'ไม่มีสิทธิ์ที่จำเป็น', {
          requiredPermissions: config.permissions,
          requiredRoles: config.roles || [],
          userPermissions: authService.getEffectivePermissions(),
          userRoles: authService.getUserRoles()
        });
        return false;
      }
    }

    // ตรวจสอบ roles
    if (config.roles?.length) {
      const hasRoles = config.requireAllRoles
        ? authService.hasAllRoles(config.roles)
        : authService.hasAnyRole(config.roles);
      
      if (!hasRoles) {
        handleAccessDenied(router, state.url, config.errorMessage || 'ไม่มีตำแหน่งที่จำเป็น', {
          requiredPermissions: config.permissions || [],
          requiredRoles: config.roles,
          userPermissions: authService.getEffectivePermissions(),
          userRoles: authService.getUserRoles()
        });
        return false;
      }
    }

    // ตรวจสอบ custom logic
    if (config.customCheck && !config.customCheck(authService)) {
      handleAccessDenied(router, state.url, config.errorMessage || 'ไม่ผ่านเงื่อนไขการตรวจสอบ', {
        requiredPermissions: config.permissions || [],
        requiredRoles: config.roles || [],
        userPermissions: authService.getEffectivePermissions(),
        userRoles: authService.getUserRoles()
      });
      return false;
    }

    return true;
  };
}

// ===== Export All Guards ===== ✅
export const PERMISSION_GUARDS = {
  auth: authGuard,
  admin: adminGuard,
  support: supportGuard,
  ticketManagement: ticketManagementGuard,
  userManagement: userManagementGuard,
  ownTicketsOnly: ownTicketsOnlyGuard,
  // Helper functions
  createPermissionGuard,
  createRoleGuard,
  createComplexGuard
} as const;