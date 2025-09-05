import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TicketCreateComponent } from './pages/tickets/ticket-create/ticket-create.component';
import { TicketListComponent } from './pages/tickets/ticket-list/ticket-list.component';
import { TicketDetailComponent } from './pages/tickets/ticket-detail/ticket-detail.component';

// ✅ Import Report Components
import { WeeklyReportComponent } from './pages/reports/weekly-report/weekly-report.component';
import { MonthlyReportComponent } from './pages/reports/monthly-report/monthly-report.component';
import { ExportTicketComponent } from './pages/reports/export-ticket/export-ticket.component';

// ✅ Import Settings Components
import { GeneralComponent } from './pages/settings/general/general.component';
import { UserAccountComponent } from './pages/settings/user-account/user-account.component';
import { ProjectComponent } from './pages/settings/project/project.component';
import { TicketCategoriesComponent } from './pages/settings/ticket-categories/ticket-categories.component';

// ✅ Import Permission Guards
import { 
  authGuard, 
  adminGuard, 
  supportGuard, 
  userManagementGuard,
  createPermissionGuard
} from './shared/guards/auth.guard';

// ✅ Import Permission Enum
import { permissionEnum } from './shared/models/permission.model';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  
  // ===== Auth Routes (No Guard) ===== ✅
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        component: LoginComponent,
        title: 'Login - Support Ticket System'
      }
    ]
  },
  
  // ===== Protected Routes (With Auth Guard) ===== ✅
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      // ===== Dashboard ===== ✅
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Dashboard - Support Ticket System'
      },
      
      // ===== Ticket Routes ===== ✅
      {
        path: 'tickets',
        children: [
          // ✅ All Tickets List (Support team only)
          {
            path: '',
            component: TicketListComponent,
            canActivate: [authGuard],
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS],
              requireAllPermissions: false // มีอย่างน้อย 1 permission
            },
            title: 'All Tickets - Support Ticket System'
          },
          
          // ✅ My Tickets (User only - ดูแค่ของตัวเอง)
          {
            path: 'my-tickets',
            component: TicketListComponent,
            canActivate: [authGuard],
            data: {
              viewMode: 'own-only', // ส่งไปให้ component รู้
              permissions: [permissionEnum.VIEW_OWN_TICKETS]
            },
            title: 'My Tickets - Support Ticket System'
          },
          
          // ✅ Create New Ticket
          {
            path: 'new',
            component: TicketCreateComponent,
            canActivate: [createPermissionGuard([permissionEnum.CREATE_TICKET])],
            title: 'Create New Ticket - Support Ticket System'
          },
          
          // ✅ Edit Ticket (Own tickets or admin/supporter)
          {
            path: 'edit/:ticket_no',
            component: TicketCreateComponent,
            canActivate: [authGuard],
            data: {
              permissions: [
                permissionEnum.EDIT_TICKET, 
                permissionEnum.CHANGE_STATUS,
                permissionEnum.SOLVE_PROBLEM
              ],
              requireAllPermissions: false // มีอย่างน้อย 1 permission
            },
            title: 'Edit Ticket - Support Ticket System'
          },
          
          // ✅ Ticket Details
          {
            path: ':ticket_no',
            component: TicketDetailComponent,
            canActivate: [authGuard],
            data: {
              permissions: [
                permissionEnum.VIEW_ALL_TICKETS,
                permissionEnum.VIEW_OWN_TICKETS,
                permissionEnum.TRACK_TICKET
              ],
              requireAllPermissions: false // มีอย่างน้อย 1 permission
            },
            title: 'Ticket Details - Support Ticket System'
          }
        ]
      },

      // ===== Report Routes ===== ✅
      {
        path: 'reports',
        children: [
          {
            path: '',
            redirectTo: 'weekly',
            pathMatch: 'full'
          },
          
          // ✅ Weekly Report (Support/Admin only)
          {
            path: 'weekly',
            component: WeeklyReportComponent,
            canActivate: [authGuard],
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
              requireAllPermissions: false
            },
            title: 'Weekly Report - Support Ticket System'
          },
          
          // ✅ Monthly Report (Support/Admin only)
          {
            path: 'monthly',
            component: MonthlyReportComponent,
            canActivate: [authGuard],
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
              requireAllPermissions: false
            },
            title: 'Monthly Report - Support Ticket System'
          },
          
          // ✅ Export Ticket (Support/Admin only)
          {
            path: 'export',
            component: ExportTicketComponent,
            canActivate: [authGuard],
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS],
              requireAllPermissions: true
            },
            title: 'Export Tickets - Support Ticket System'
          }
        ]
      },
      
      // ===== Settings Routes ===== ✅
      {
        path: 'settings',
        children: [
          {
            path: '',
            redirectTo: 'general',
            pathMatch: 'full'
          },
          
          // ✅ General Settings (All authenticated users)
          {
            path: 'general',
            component: GeneralComponent,
            title: 'General Settings - Support Ticket System'
          },
          
          // ✅ User Account Management (Admin only)
          {
            path: 'user-account',
            canActivate: [userManagementGuard],
            component: UserAccountComponent,
            data: {
              permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
              requireAllPermissions: false
            },
            title: 'User Management - Support Ticket System'
          },
          
          // ✅ NEW: Create New User (Admin only)
          {
            path: 'user-create',
            canActivate: [createPermissionGuard([permissionEnum.ADD_USER])],
            loadComponent: () => import('./pages/settings/user-create/user-create.component')
              .then(m => m.UserCreateComponent),
            data: {
              permissions: [permissionEnum.ADD_USER],
              requireAllPermissions: true
            },
            title: 'Create User - Support Ticket System'
          },
          
          // ✅ NEW: Edit User (Admin only)
          {
            path: 'user-edit/:id',
            canActivate: [createPermissionGuard([permissionEnum.ADD_USER])],
            loadComponent: () => import('./pages/settings/user-create/user-create.component')
              .then(m => m.UserCreateComponent),
            data: {
              permissions: [permissionEnum.ADD_USER],
              requireAllPermissions: true,
              mode: 'edit' // ส่งไปให้ component รู้ว่าเป็นโหมดแก้ไข
            },
            title: 'Edit User - Support Ticket System'
          },
          
          // ✅ Project Settings (Admin only)
          {
            path: 'project',
            canActivate: [adminGuard],
            component: ProjectComponent,
            data: {
              permissions: [permissionEnum.ADD_USER], // Admin permission required
              requireAllPermissions: true
            },
            title: 'Project Settings - Support Ticket System'
          },
          
          // ✅ Ticket Categories (Admin only)
          {
            path: 'ticket-categories',
            canActivate: [adminGuard],
            component: TicketCategoriesComponent,
            data: {
              permissions: [permissionEnum.ADD_USER], // Admin permission required
              requireAllPermissions: true
            },
            title: 'Ticket Categories - Support Ticket System'
          }
        ]
      },
      
      // ===== Admin Routes ===== ✅
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full'
          },
          {
            path: 'dashboard',
            component: DashboardComponent, // Use existing component for now
            title: 'Admin Dashboard - Support Ticket System'
          },
          {
            path: 'users',
            component: DashboardComponent, // Use existing component for now
            data: {
              permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER]
            },
            title: 'User Management - Support Ticket System'
          }
        ]
      },
      
      // ===== Support Team Routes ===== ✅
      {
        path: 'support',
        canActivate: [supportGuard],
        children: [
          {
            path: '',
            redirectTo: 'queue',
            pathMatch: 'full'
          },
          {
            path: 'queue',
            component: TicketListComponent, // Use existing component
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
              viewMode: 'all'
            },
            title: 'Support Queue - Support Ticket System'
          },
          {
            path: 'assigned',
            component: TicketListComponent, // Use existing component
            data: {
              permissions: [permissionEnum.ASSIGNEE, permissionEnum.SOLVE_PROBLEM],
              viewMode: 'all'
            },
            title: 'Assigned Tickets - Support Ticket System'
          }
        ]
      },
      
      // ===== Simple Routes ===== ✅
      {
        path: 'profile',
        component: DashboardComponent, // Use existing component for now
        title: 'My Profile - Support Ticket System'
      },
      
      {
        path: 'access-denied',
        component: DashboardComponent, // Use existing component for now
        title: 'Access Denied - Support Ticket System'
      }
    ]
  },
  
  // ===== Fallback Route ===== ✅
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];

// ===== Route Configuration Constants ===== ✅
export const ROUTE_PERMISSIONS = {
  TICKETS: {
    VIEW_ALL: [permissionEnum.VIEW_ALL_TICKETS],
    VIEW_OWN: [permissionEnum.VIEW_OWN_TICKETS],
    CREATE: [permissionEnum.CREATE_TICKET],
    EDIT: [permissionEnum.EDIT_TICKET, permissionEnum.CHANGE_STATUS],
    DELETE: [permissionEnum.DELETE_TICKET]
  },
  REPORTS: {
    VIEW: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
    EXPORT: [permissionEnum.VIEW_ALL_TICKETS]
  },
  SETTINGS: {
    GENERAL: [], // All authenticated users
    USER_MANAGEMENT: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
    USER_CREATE: [permissionEnum.ADD_USER], // ✅ เพิ่มใหม่
    USER_EDIT: [permissionEnum.ADD_USER],   // ✅ เพิ่มใหม่
    PROJECT: [permissionEnum.ADD_USER], // Admin only
    CATEGORIES: [permissionEnum.ADD_USER] // Admin only
  },
  ADMIN: {
    USERS: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
    SETTINGS: [permissionEnum.ADD_USER] // Admin role required
  },
  SUPPORT: {
    QUEUE: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
    SOLVE: [permissionEnum.SOLVE_PROBLEM, permissionEnum.REPLY_TICKET]
  }
} as const;

// ===== Route Utility Functions ===== ✅
export function getRouteTitle(path: string): string {
  const route = routes
    .flatMap(r => r.children || [r])
    .find(r => r.path === path);
  
  return route?.title as string || 'Support Ticket System';
}

export function getRoutePermissions(path: string): permissionEnum[] {
  const route = routes
    .flatMap(r => r.children || [r])
    .find(r => r.path === path);
  
  return route?.data?.['permissions'] || [];
}

export function isRouteAccessible(path: string, userPermissions: permissionEnum[]): boolean {
  const requiredPermissions = getRoutePermissions(path);
  
  if (requiredPermissions.length === 0) {
    return true; // No specific permissions required
  }
  
  return requiredPermissions.some(permission => 
    userPermissions.includes(permission)
  );
}

// ===== NEW: User Management Route Helpers ===== ✅
export const USER_MANAGEMENT_ROUTES = {
  LIST: '/settings/user-account',
  CREATE: '/settings/user-create',
  EDIT: '/settings/user-edit/:id'
} as const;

export function getUserEditRoute(userId: number): string {
  return `/settings/user-edit/${userId}`;
}

export function isUserManagementRoute(path: string): boolean {
  return path.includes('/settings/user-');
}