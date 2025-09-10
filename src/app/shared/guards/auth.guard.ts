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
 *     permissions: [permissionEnum.ADD_USER, permissionEnum.DELETE_USER],
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
  
  const requiredPermissions: number[] = route.data['permissions'] || []; // ✅ เปลี่ยนเป็น number[]
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
    userPermissions,
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
      hasRequiredPermissions = requiredPermissions.every(p => userPermissions.includes(p));
      if (!hasRequiredPermissions) {
        const missingPermissions = requiredPermissions.filter(p => !userPermissions.includes(p));
        permissionMessage = `Missing required permissions: ${missingPermissions.join(', ')}`;
      }
    } else {
      // มีอย่างน้อย 1 permission
      hasRequiredPermissions = requiredPermissions.some(p => userPermissions.includes(p));
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
      hasRequiredRoles = requiredRoles.every(role => userRoles.includes(role));
      if (!hasRequiredRoles) {
        const missingRoles = requiredRoles.filter(role => !userRoles.includes(role));
        roleMessage = `Missing required roles: ${missingRoles.join(', ')}`;
      }
    } else {
      // มีอย่างน้อย 1 role
      hasRequiredRoles = requiredRoles.some(role => userRoles.includes(role));
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
      permissions: userPermissions,
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
    requiredPermissions: number[]; // ✅ เปลี่ยนเป็น number[]
    requiredRoles: UserRole[];
    userPermissions: number[]; // ✅ เปลี่ยนเป็น number[]
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
 * ✅ สร้างข้อความแจ้งเตือนที่เป็นมิตรกับผู้ใช้ (ปรับให้รองรับ 19 permissions)
 */
function createUserFriendlyAccessDeniedMessage(context: {
  requiredPermissions: number[]; // ✅ เปลี่ยนเป็น number[]
  requiredRoles: UserRole[];
  userPermissions: number[]; // ✅ เปลี่ยนเป็น number[]
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
      // ✅ แปลง permission number เป็นชื่อที่อ่านได้ (19 permissions)
      switch (permission) {
        case 1: return 'แจ้งปัญหา';
        case 2: return 'ติดตามปัญหา';
        case 3: return 'แก้ไข ticket';
        case 4: return 'ลบ ticket';
        case 5: return 'เปลี่ยนสถานะของ ticket';
        case 6: return 'ตอบกลับ ticket';
        case 7: return 'ปิด ticket';
        case 8: return 'แก้ไขปัญหา';
        case 9: return 'ผู้รับเรื่อง';
        case 10: return 'จัดการ project';
        case 11: return 'กู้คืน ticket';
        case 12: return 'ดูรายงานตั๋วของตัวเอง';
        case 13: return 'ดูรายงานทั้งหมด';
        case 14: return 'ให้คะแนนความพึงพอใจ';
        case 15: return 'เพิ่มผู้ใช้';
        case 16: return 'ลบผู้ใช้';
        case 17: return 'จัดการ category';
        case 18: return 'จัดการ status';
        case 19: return 'มอนเทอริ่ง';
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
 * ✅ Guard สำหรับ Admin เท่านั้น (แก้ไขให้ทำงานถูกต้อง)
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👑 Admin Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // ✅ แก้ไข: ตรวจสอบทั้ง role และ permissions
  const isAdmin = authService.isAdmin();
  const hasAdminPermissions = authService.hasAnyPermission([15, 16]); // ADD_USER, DELETE_USER
  const hasManageProject = authService.hasPermission(10); // MANAGE_PROJECT

  console.log('👑 Admin check details:', {
    isAdmin,
    hasAdminPermissions,
    hasManageProject,
    userRoles: authService.getUserRoles(),
    userPermissions: authService.getEffectivePermissions()
  });

  // ✅ อนุโลมให้ผ่านถ้ามี admin role หรือ admin permissions
  if (!isAdmin && !hasAdminPermissions && !hasManageProject) {
    console.log('❌ User is not admin and has no admin permissions');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์ผู้ดูแลระบบ', {
      requiredPermissions: [15], // ADD_USER as minimum admin permission
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

  // ✅ ตรวจสอบทั้ง role และ permissions
  const hasRole = authService.hasAnyRole(['admin', 'supporter']);
  const hasSupportPermissions = authService.hasAnyPermission([13, 9, 6, 8]); // VIEW_ALL_TICKETS, ASSIGNEE, REPLY_TICKET, SOLVE_PROBLEM

  console.log('🛠️ Support check details:', {
    hasRole,
    hasSupportPermissions,
    userRoles: authService.getUserRoles(),
    userPermissions: authService.getEffectivePermissions()
  });

  if (!hasRole && !hasSupportPermissions) {
    console.log('❌ User is not support team member');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์ทีมสนับสนุน', {
      requiredPermissions: [13, 9], // VIEW_ALL_TICKETS, ASSIGNEE
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
 * ✅ Guard สำหรับ User Management (แก้ไข permissions)
 */
export const userManagementGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👥 User Management Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const canManageUsers = authService.hasAnyPermission([15, 16]); // ADD_USER, DELETE_USER

  if (!canManageUsers) {
    console.log('❌ User cannot manage users');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์จัดการผู้ใช้', {
      requiredPermissions: [15, 16], // ADD_USER, DELETE_USER
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
 * ✅ Guard สำหรับ Ticket Management (แก้ไข permissions)
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
    13, // VIEW_ALL_TICKETS
    5,  // CHANGE_STATUS
    9,  // ASSIGNEE
    8   // SOLVE_PROBLEM
  ]);

  if (!canManage) {
    console.log('❌ User cannot manage tickets');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์จัดการตั๋ว', {
      requiredPermissions: [13, 5, 9, 8], // VIEW_ALL_TICKETS, CHANGE_STATUS, ASSIGNEE, SOLVE_PROBLEM
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
  const hasViewOwn = authService.hasPermission(12); // VIEW_OWN_TICKETS
  const hasViewAll = authService.hasPermission(13); // VIEW_ALL_TICKETS
  const canViewOwnOnly = hasViewOwn && !hasViewAll;

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
 * ✅ Helper function สำหรับสร้าง custom permission guard (แก้ไข type)
 */
export function createPermissionGuard(
  requiredPermissions: number[], // ✅ เปลี่ยนเป็น number[]
  requireAll: boolean = false
): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    console.log('🔑 Custom Permission Guard:', {
      requiredPermissions,
      requireAll,
      url: state.url
    });

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const userPermissions = authService.getEffectivePermissions();
    
    const hasPermission = requireAll 
      ? requiredPermissions.every(p => userPermissions.includes(p))
      : requiredPermissions.some(p => userPermissions.includes(p));

    console.log('🔑 Permission check result:', {
      hasPermission,
      userPermissions,
      requiredPermissions,
      requireAll
    });

    if (!hasPermission) {
      const action = requireAll ? 'ทั้งหมด' : 'อย่างน้อยหนึ่งรายการ';
      handleAccessDenied(router, state.url, `ต้องการสิทธิ์ ${action}`, {
        requiredPermissions,
        requiredRoles: [],
        userPermissions,
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

    const userRoles = authService.getUserRoles();

    const hasRole = requireAll 
      ? requiredRoles.every(role => userRoles.includes(role))
      : requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      const action = requireAll ? 'ทั้งหมด' : 'อย่างน้อยหนึ่งตำแหน่ง';
      handleAccessDenied(router, state.url, `ต้องการตำแหน่ง ${action}`, {
        requiredPermissions: [],
        requiredRoles,
        userPermissions: authService.getEffectivePermissions(),
        userRoles
      });
      return false;
    }

    return true;
  };
}

/**
 * ✅ Guard สำหรับตรวจสอบหลายเงื่อนไขพร้อมกัน (แก้ไข type)
 */
export function createComplexGuard(config: {
  permissions?: number[]; // ✅ เปลี่ยนเป็น number[]
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

    const userPermissions = authService.getEffectivePermissions();
    const userRoles = authService.getUserRoles();

    // ตรวจสอบ permissions
    if (config.permissions?.length) {
      const hasPermissions = config.requireAllPermissions
        ? config.permissions.every(p => userPermissions.includes(p))
        : config.permissions.some(p => userPermissions.includes(p));
      
      if (!hasPermissions) {
        handleAccessDenied(router, state.url, config.errorMessage || 'ไม่มีสิทธิ์ที่จำเป็น', {
          requiredPermissions: config.permissions,
          requiredRoles: config.roles || [],
          userPermissions,
          userRoles
        });
        return false;
      }
    }

    // ตรวจสอบ roles
    if (config.roles?.length) {
      const hasRoles = config.requireAllRoles
        ? config.roles.every(role => userRoles.includes(role))
        : config.roles.some(role => userRoles.includes(role));
      
      if (!hasRoles) {
        handleAccessDenied(router, state.url, config.errorMessage || 'ไม่มีตำแหน่งที่จำเป็น', {
          requiredPermissions: config.permissions || [],
          requiredRoles: config.roles,
          userPermissions,
          userRoles
        });
        return false;
      }
    }

    // ตรวจสอบ custom logic
    if (config.customCheck && !config.customCheck(authService)) {
      handleAccessDenied(router, state.url, config.errorMessage || 'ไม่ผ่านเงื่อนไขการตรวจสอบ', {
        requiredPermissions: config.permissions || [],
        requiredRoles: config.roles || [],
        userPermissions,
        userRoles
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