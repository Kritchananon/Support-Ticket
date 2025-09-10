import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { 
  permissionEnum, 
  UserRole, 
  enumToNumber,
  isValidPermissionNumber,
  ROLES 
} from '../models/permission.model';

/**
 * ✅ ENHANCED: Directive สำหรับตรวจสอบ permissions และแสดง/ซ่อน elements
 * รองรับทั้ง number และ permissionEnum (19 permissions)
 * 
 * Usage:
 * <div *hasPermission="[1, 2]">Create Button</div>
 * <div *hasPermission="[permissionEnum.EDIT_TICKET, permissionEnum.DELETE_TICKET]" [requireAll]="true">Admin Actions</div>
 * <div *hasRole="['admin', 'supporter']">Support Menu</div>
 * <div *hasRole="['admin']" *hasPermission="[15]">User Management</div>
 */

// ===== ✅ ENHANCED: Permission Directive =====
@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _permissions: number[] = [];
  private _requireAll = false;
  private _isVisible = false;

  /**
   * ✅ ENHANCED: รับทั้ง number[], permissionEnum[], หรือ mixed array
   * รองรับ requireAll mode ด้วย
   */
  @Input() set hasPermission(permissions: number | permissionEnum | (number | permissionEnum)[] | {
    permissions: (number | permissionEnum)[];
    requireAll?: boolean;
  }) {
    // ถ้าเป็น object ที่มี permissions และ requireAll
    if (typeof permissions === 'object' && !Array.isArray(permissions) && 'permissions' in permissions) {
      const config = permissions as { permissions: (number | permissionEnum)[]; requireAll?: boolean };
      this._requireAll = config.requireAll || false;
      
      this._permissions = config.permissions.map(p => {
        if (typeof p === 'number') {
          return p;
        } else {
          return enumToNumber(p as permissionEnum);
        }
      }).filter(p => isValidPermissionNumber(p));
    }
    // Handle single number
    else if (typeof permissions === 'number') {
      this._permissions = [permissions];
    } 
    // Handle array
    else if (Array.isArray(permissions)) {
      this._permissions = permissions.map(p => {
        if (typeof p === 'number') {
          return p;
        } else {
          return enumToNumber(p as permissionEnum);
        }
      }).filter(p => isValidPermissionNumber(p));
    } 
    // Handle single enum
    else {
      try {
        const permissionNumber = enumToNumber(permissions as permissionEnum);
        this._permissions = [permissionNumber];
      } catch (error) {
        console.warn('⚠ Invalid permissions provided to hasPermission directive:', permissions);
        this._permissions = [];
      }
    }

    console.log('🔍 HasPermission directive updated:', {
      original: permissions,
      processed: this._permissions,
      requireAll: this._requireAll
    });

    this.updateVisibility();
  }

  @Input() set requireAll(value: boolean) {
    this._requireAll = value;
    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasPermission directive initialized');
    
    // ✅ Subscribe to auth state changes
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating permission visibility');
        this.updateVisibility();
      });

    // ✅ Initial visibility check
    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasRequiredPermissions = this.checkPermissions();
    
    console.log('🔍 Permission check result:', {
      permissions: this._permissions,
      requireAll: this._requireAll,
      hasPermissions: hasRequiredPermissions,
      currentVisibility: this._isVisible
    });
    
    if (hasRequiredPermissions && !this._isVisible) {
      // แสดง element
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by permission directive');
    } else if (!hasRequiredPermissions && this._isVisible) {
      // ซ่อน element
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Element hidden by permission directive');
    }
  }

  private checkPermissions(): boolean {
    if (!this._permissions.length) {
      console.log('📋 No permissions required, allowing access');
      return true; // ไม่มีเงื่อนไข = แสดง
    }

    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const userPermissions = this.authService.getEffectivePermissions();
    
    console.log('🔍 Checking permissions:', {
      required: this._permissions,
      user: userPermissions,
      requireAll: this._requireAll
    });
    
    if (this._requireAll) {
      // ต้องมีทุก permission
      const hasAll = this._permissions.every(permission => 
        userPermissions.includes(permission)
      );
      console.log('🎯 Require ALL permissions:', hasAll);
      return hasAll;
    } else {
      // มีอย่างน้อย 1 permission
      const hasAny = this._permissions.some(permission => 
        userPermissions.includes(permission)
      );
      console.log('🎯 Require ANY permission:', hasAny);
      return hasAny;
    }
  }
}

// ===== ✅ ENHANCED: Role Directive =====
@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _roles: UserRole[] = [];
  private _requireAll = false;
  private _isVisible = false;

  /**
   * ✅ ENHANCED: รับ single role หรือ array of roles พร้อม validation
   */
  @Input() set hasRole(roles: UserRole | UserRole[]) {
    if (typeof roles === 'string') {
      // ตรวจสอบว่าเป็น valid role
      if (Object.values(ROLES).includes(roles as UserRole)) {
        this._roles = [roles as UserRole];
      } else {
        console.warn('⚠ Invalid role provided to hasRole directive:', roles);
        this._roles = [];
      }
    } else if (Array.isArray(roles)) {
      // กรองเฉพาะ valid roles
      this._roles = roles.filter(role => Object.values(ROLES).includes(role));
      
      if (this._roles.length !== roles.length) {
        const invalidRoles = roles.filter(role => !Object.values(ROLES).includes(role));
        console.warn('⚠ Some invalid roles filtered out:', invalidRoles);
      }
    } else {
      console.warn('⚠ Invalid roles provided to hasRole directive:', roles);
      this._roles = [];
    }

    console.log('👥 HasRole directive updated:', {
      original: roles,
      processed: this._roles
    });

    this.updateVisibility();
  }

  @Input() set requireAll(value: boolean) {
    this._requireAll = value;
    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasRole directive initialized');
    
    // ✅ Subscribe to auth state changes
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating role visibility');
        this.updateVisibility();
      });

    // ✅ Initial visibility check
    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasRequiredRoles = this.checkRoles();
    
    console.log('🔍 Role check result:', {
      roles: this._roles,
      requireAll: this._requireAll,
      hasRoles: hasRequiredRoles,
      currentVisibility: this._isVisible
    });
    
    if (hasRequiredRoles && !this._isVisible) {
      // แสดง element
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by role directive');
    } else if (!hasRequiredRoles && this._isVisible) {
      // ซ่อน element
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Element hidden by role directive');
    }
  }

  private checkRoles(): boolean {
    if (!this._roles.length) {
      console.log('📋 No roles required, allowing access');
      return true; // ไม่มีเงื่อนไข = แสดง
    }

    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const userRoles = this.authService.getUserRoles();
    
    console.log('🔍 Checking roles:', {
      required: this._roles,
      user: userRoles,
      requireAll: this._requireAll
    });
    
    if (this._requireAll) {
      // ต้องมีทุก role
      const hasAll = this._roles.every(role => userRoles.includes(role));
      console.log('🎯 Require ALL roles:', hasAll);
      return hasAll;
    } else {
      // มีอย่างน้อย 1 role
      const hasAny = this._roles.some(role => userRoles.includes(role));
      console.log('🎯 Require ANY role:', hasAny);
      return hasAny;
    }
  }
}

// ===== ✅ ENHANCED: Combined Permission & Role Directive =====
@Directive({
  selector: '[hasAccess]',
  standalone: true
})
export class HasAccessDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _permissions: number[] = [];
  private _roles: UserRole[] = [];
  private _requireAllPermissions = false;
  private _requireAllRoles = false;
  private _isVisible = false;

  /**
   * ✅ ENHANCED: รับ config object พร้อม validation
   */
  @Input() set hasAccess(config: {
    permissions?: (number | permissionEnum)[];
    roles?: UserRole[];
    requireAllPermissions?: boolean;
    requireAllRoles?: boolean;
  }) {
    // Process permissions
    if (config.permissions) {
      this._permissions = config.permissions.map(p => 
        typeof p === 'number' ? p : enumToNumber(p as permissionEnum)
      ).filter(p => isValidPermissionNumber(p));
    } else {
      this._permissions = [];
    }

    // Process roles
    if (config.roles) {
      this._roles = config.roles.filter(role => Object.values(ROLES).includes(role));
    } else {
      this._roles = [];
    }

    this._requireAllPermissions = config.requireAllPermissions || false;
    this._requireAllRoles = config.requireAllRoles || false;

    console.log('🔍👥 HasAccess directive updated:', {
      permissions: this._permissions,
      roles: this._roles,
      requireAllPermissions: this._requireAllPermissions,
      requireAllRoles: this._requireAllRoles
    });

    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasAccess directive initialized');
    
    // ✅ Subscribe to auth state changes
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating access visibility');
        this.updateVisibility();
      });

    // ✅ Initial visibility check
    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasAccess = this.checkAccess();
    
    console.log('🔍 Access check result:', {
      permissions: this._permissions,
      roles: this._roles,
      hasAccess: hasAccess,
      currentVisibility: this._isVisible
    });
    
    if (hasAccess && !this._isVisible) {
      // แสดง element
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by access directive');
    } else if (!hasAccess && this._isVisible) {
      // ซ่อน element
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Element hidden by access directive');
    }
  }

  private checkAccess(): boolean {
    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const hasPermissions = this.checkPermissions();
    const hasRoles = this.checkRoles();
    
    // ต้องผ่านทั้ง permission และ role checks
    const result = hasPermissions && hasRoles;
    
    console.log('🎯 Combined access check:', {
      hasPermissions,
      hasRoles,
      result
    });
    
    return result;
  }

  private checkPermissions(): boolean {
    if (!this._permissions.length) {
      return true; // ไม่มีเงื่อนไข permission = ผ่าน
    }

    const userPermissions = this.authService.getEffectivePermissions();
    
    if (this._requireAllPermissions) {
      return this._permissions.every(permission => 
        userPermissions.includes(permission)
      );
    } else {
      return this._permissions.some(permission => 
        userPermissions.includes(permission)
      );
    }
  }

  private checkRoles(): boolean {
    if (!this._roles.length) {
      return true; // ไม่มีเงื่อนไข role = ผ่าน
    }

    const userRoles = this.authService.getUserRoles();
    
    if (this._requireAllRoles) {
      return this._roles.every(role => userRoles.includes(role));
    } else {
      return this._roles.some(role => userRoles.includes(role));
    }
  }
}

// ===== ✅ ENHANCED: Utility Directive สำหรับ Debug =====
@Directive({
  selector: '[debugPermissions]',
  standalone: true
})
export class DebugPermissionsDirective implements OnInit {
  private authService = inject(AuthService);

  @Input() debugPermissions: boolean = false;

  ngOnInit(): void {
    if (this.debugPermissions) {
      console.group('🔍 Permission Debug from Directive');
      console.log('🔍 User Permissions:', this.authService.getEffectivePermissions());
      console.log('👥 User Roles:', this.authService.getUserRoles());
      console.log('🎯 Is Authenticated:', this.authService.isAuthenticated());
      console.log('🔧 Auth Methods:', {
        isAdmin: this.authService.isAdmin(),
        isSupporter: this.authService.isSupporter(),
        isUser: this.authService.isUser(),
        canManageTickets: this.authService.canManageTickets(),
        canViewAllTickets: this.authService.canViewAllTickets()
      });
      console.groupEnd();
    }
  }
}

// ===== ✅ NEW: Specific Permission Directives =====

/**
 * ✅ NEW: Directive สำหรับ Supporter features เฉพาะ
 */
@Directive({
  selector: '[supporterOnly]',
  standalone: true
})
export class SupporterOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 SupporterOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    // ✅ ใช้ method ที่มีอยู่แล้วใน AuthService
    const canAccess = this.authService.isSupporter() || this.authService.isAdmin();
    
    console.log('🔍 Supporter access check:', {
      canAccess,
      isSupporter: this.authService.isSupporter(),
      isAdmin: this.authService.isAdmin(),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Supporter element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Supporter element hidden');
    }
  }
}

/**
 * ✅ NEW: Directive สำหรับ Admin features เฉพาะ
 */
@Directive({
  selector: '[adminOnly]',
  standalone: true
})
export class AdminOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 AdminOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const canAccess = this.authService.isAdmin();
    
    console.log('🔍 Admin access check:', {
      canAccess,
      isAdmin: this.authService.isAdmin(),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Admin element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Admin element hidden');
    }
  }
}

/**
 * ✅ NEW: Directive สำหรับ User features เฉพาะ (ไม่ใช่ admin/supporter)
 */
@Directive({
  selector: '[userOnly]',
  standalone: true
})
export class UserOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 UserOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    // User only = มี USER role แต่ไม่มี ADMIN หรือ SUPPORTER role
    const canAccess = this.authService.isUser() && 
                     !this.authService.isAdmin() && 
                     !this.authService.isSupporter();
    
    console.log('🔍 User only access check:', {
      canAccess,
      isUser: this.authService.isUser(),
      isAdmin: this.authService.isAdmin(),
      isSupporter: this.authService.isSupporter(),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ User-only element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ User-only element hidden');
    }
  }
}

// ===== ✅ NEW: Specific Feature Directives (รองรับ 19 permissions) =====

/**
 * ✅ NEW: Directive สำหรับ Project Management features
 */
@Directive({
  selector: '[canManageProject]',
  standalone: true
})
export class CanManageProjectDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 CanManageProject directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const userPermissions = this.authService.getEffectivePermissions();
    const canAccess = userPermissions.includes(10); // MANAGE_PROJECT
    
    console.log('🔍 Project management access check:', {
      canAccess,
      hasManageProject: userPermissions.includes(10),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Project management element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Project management element hidden');
    }
  }
}

/**
 * ✅ NEW: Directive สำหรับ Category/Status Management features
 */
@Directive({
  selector: '[canManageSystem]',
  standalone: true
})
export class CanManageSystemDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 CanManageSystem directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const userPermissions = this.authService.getEffectivePermissions();
    // ตรวจสอบว่ามี permission จัดการ category หรือ status
    const canAccess = userPermissions.includes(17) || userPermissions.includes(18); // MANAGE_CATEGORY || MANAGE_STATUS
    
    console.log('🔍 System management access check:', {
      canAccess,
      hasManageCategory: userPermissions.includes(17),
      hasManageStatus: userPermissions.includes(18),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ System management element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ System management element hidden');
    }
  }
}

/**
 * ✅ NEW: Directive สำหรับ Dashboard/Monitoring features
 */
@Directive({
  selector: '[canViewDashboard]',
  standalone: true
})
export class CanViewDashboardDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 CanViewDashboard directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const userPermissions = this.authService.getEffectivePermissions();
    const canAccess = userPermissions.includes(19); // VIEW_DASHBOARD
    
    console.log('🔍 Dashboard access check:', {
      canAccess,
      hasViewDashboard: userPermissions.includes(19),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Dashboard element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠ Dashboard element hidden');
    }
  }
}

// ===== ✅ Export ทั้งหมดเพื่อใช้งาน =====
export const PERMISSION_DIRECTIVES = [
  HasPermissionDirective,
  HasRoleDirective, 
  HasAccessDirective,
  DebugPermissionsDirective,
  SupporterOnlyDirective,
  AdminOnlyDirective,
  UserOnlyDirective,
  CanManageProjectDirective,
  CanManageSystemDirective,
  CanViewDashboardDirective
] as const;