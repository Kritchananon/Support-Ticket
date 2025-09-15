import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TicketCreateComponent } from './pages/tickets/ticket-create/ticket-create.component';
import { TicketListComponent } from './pages/tickets/ticket-list/ticket-list.component';
import { TicketDetailComponent } from './pages/tickets/ticket-detail/ticket-detail.component';

// Import Report Components
import { WeeklyReportComponent } from './pages/reports/weekly-report/weekly-report.component';
import { MonthlyReportComponent } from './pages/reports/monthly-report/monthly-report.component';
import { ExportTicketComponent } from './pages/reports/export-ticket/export-ticket.component';

// Import Settings Components
import { GeneralComponent } from './pages/settings/general/general.component';
import { UserAccountComponent } from './pages/settings/user-account/user-account.component';
import { ProjectComponent } from './pages/settings/project/project.component';
import { TicketCategoriesComponent } from './pages/settings/ticket-categories/ticket-categories.component';
import { CustomersComponent } from './pages/settings/customers/customers.component';

// Import Permission Guards
import { 
  authGuard, 
  adminGuard, 
  supportGuard, 
  userManagementGuard,
  createPermissionGuard
} from './shared/guards/auth.guard';

// Import Permission Enum
import { permissionEnum } from './shared/models/permission.model';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  
  // ===== Auth Routes (No Guard) =====
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
  
  // ===== Protected Routes (With Auth Guard) =====
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      // ===== Dashboard =====
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [authGuard],
        data: {
          permissions: [permissionEnum.VIEW_DASHBOARD],
          requireAllPermissions: false
        },
        title: 'Dashboard - Support Ticket System'
      },
      
      // ===== Ticket Routes =====
      {
        path: 'tickets',
        children: [
          {
            path: '',
            component: TicketListComponent,
            canActivate: [authGuard],
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS],
              requireAllPermissions: false
            },
            title: 'All Tickets - Support Ticket System'
          },
          {
            path: 'my-tickets',
            component: TicketListComponent,
            canActivate: [authGuard],
            data: {
              viewMode: 'own-only',
              permissions: [permissionEnum.VIEW_OWN_TICKETS]
            },
            title: 'My Tickets - Support Ticket System'
          },
          {
            path: 'new',
            component: TicketCreateComponent,
            canActivate: [createPermissionGuard([permissionEnum.CREATE_TICKET])],
            title: 'Create New Ticket - Support Ticket System'
          },
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
              requireAllPermissions: false
            },
            title: 'Edit Ticket - Support Ticket System'
          },
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
              requireAllPermissions: false
            },
            title: 'Ticket Details - Support Ticket System'
          }
        ]
      },

      // ===== Report Routes =====
      {
        path: 'reports',
        children: [
          {
            path: '',
            redirectTo: 'weekly',
            pathMatch: 'full'
          },
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
      
      // ===== Settings Routes =====
      {
        path: 'settings',
        children: [
          {
            path: '',
            redirectTo: 'general',
            pathMatch: 'full'
          },
          {
            path: 'general',
            component: GeneralComponent,
            title: 'General Settings - Support Ticket System'
          },
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
          {
            path: 'user-edit/:id',
            canActivate: [createPermissionGuard([permissionEnum.ADD_USER])],
            loadComponent: () => import('./pages/settings/user-create/user-create.component')
              .then(m => m.UserCreateComponent),
            data: {
              permissions: [permissionEnum.ADD_USER],
              requireAllPermissions: true,
              mode: 'edit'
            },
            title: 'Edit User - Support Ticket System'
          },
          {
            path: 'project',
            canActivate: [adminGuard],
            component: ProjectComponent,
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Project Settings - Support Ticket System'
          },
          {
            path: 'ticket-categories',
            canActivate: [adminGuard],
            component: TicketCategoriesComponent,
            data: {
              permissions: [permissionEnum.MANAGE_CATEGORY],
              requireAllPermissions: true
            },
            title: 'Ticket Categories - Support Ticket System'
          },
          {
            path: 'customers',
            canActivate: [adminGuard],
            component: CustomersComponent,
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Customers Management - Support Ticket System'
          },
          
          // ===== NEW: Customer for Project Routes =====
          {
            path: 'customer-for-project',
            canActivate: [adminGuard],
            loadComponent: () => import('./pages/settings/customer-for-project/customer-for-project.component')
              .then(m => m.CustomerForProjectComponent),
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Customer for Project - Support Ticket System'
          }
        ]
      },
      
      // ===== Admin Routes =====
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
            component: DashboardComponent,
            data: {
              permissions: [permissionEnum.VIEW_DASHBOARD],
              viewMode: 'admin'
            },
            title: 'Admin Dashboard - Support Ticket System'
          },
          {
            path: 'users',
            component: UserAccountComponent,
            data: {
              permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER]
            },
            title: 'User Management - Support Ticket System'
          }
        ]
      },
      
      // ===== Support Team Routes =====
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
            component: TicketListComponent,
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
              viewMode: 'support-queue'
            },
            title: 'Support Queue - Support Ticket System'
          },
          {
            path: 'assigned',
            component: TicketListComponent,
            data: {
              permissions: [permissionEnum.ASSIGNEE, permissionEnum.SOLVE_PROBLEM],
              viewMode: 'assigned-to-me'
            },
            title: 'Assigned Tickets - Support Ticket System'
          },
          {
            path: 'dashboard',
            component: DashboardComponent,
            data: {
              permissions: [permissionEnum.VIEW_DASHBOARD],
              viewMode: 'support'
            },
            title: 'Support Dashboard - Support Ticket System'
          }
        ]
      },
      
      // ===== Simple Routes =====
      {
        path: 'profile',
        component: DashboardComponent,
        title: 'My Profile - Support Ticket System'
      },
      {
        path: 'access-denied',
        component: DashboardComponent,
        title: 'Access Denied - Support Ticket System'
      }
    ]
  },
  
  // ===== Fallback Route =====
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];

// ===== Route Configuration Constants =====
export const ROUTE_PERMISSIONS = {
  DASHBOARD: {
    VIEW: [permissionEnum.VIEW_DASHBOARD]
  },
  TICKETS: {
    VIEW_ALL: [permissionEnum.VIEW_ALL_TICKETS],
    VIEW_OWN: [permissionEnum.VIEW_OWN_TICKETS],
    CREATE: [permissionEnum.CREATE_TICKET],
    EDIT: [permissionEnum.EDIT_TICKET, permissionEnum.CHANGE_STATUS],
    DELETE: [permissionEnum.DELETE_TICKET],
    TRACK: [permissionEnum.TRACK_TICKET],
    ASSIGN: [permissionEnum.ASSIGNEE],
    SOLVE: [permissionEnum.SOLVE_PROBLEM],
    REPLY: [permissionEnum.REPLY_TICKET],
    CLOSE: [permissionEnum.CLOSE_TICKET],
    RESTORE: [permissionEnum.RESTORE_TICKET]
  },
  REPORTS: {
    VIEW: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
    EXPORT: [permissionEnum.VIEW_ALL_TICKETS]
  },
  SETTINGS: {
    GENERAL: [],
    USER_MANAGEMENT: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
    USER_CREATE: [permissionEnum.ADD_USER],
    USER_EDIT: [permissionEnum.ADD_USER],
    PROJECT: [permissionEnum.MANAGE_PROJECT],
    CATEGORIES: [permissionEnum.MANAGE_CATEGORY],
    CUSTOMERS: [permissionEnum.MANAGE_PROJECT],
    CUSTOMER_PROJECT: [permissionEnum.MANAGE_PROJECT], // NEW
    STATUS: [permissionEnum.MANAGE_STATUS]
  },
  ADMIN: {
    USERS: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
    SETTINGS: [permissionEnum.MANAGE_PROJECT, permissionEnum.MANAGE_CATEGORY, permissionEnum.MANAGE_STATUS],
    DASHBOARD: [permissionEnum.VIEW_DASHBOARD]
  },
  SUPPORT: {
    QUEUE: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGNEE],
    SOLVE: [permissionEnum.SOLVE_PROBLEM, permissionEnum.REPLY_TICKET],
    DASHBOARD: [permissionEnum.VIEW_DASHBOARD]
  },
  SATISFACTION: [permissionEnum.SATISFACTION]
} as const;

// ===== Navigation Helper =====
export interface NavigationItem {
  path: string;
  title: string;
  permissions: number[];
  icon?: string;
  children?: NavigationItem[];
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    permissions: [],
    icon: 'dashboard'
  },
  {
    path: '/tickets',
    title: 'Tickets',
    permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS],
    icon: 'ticket',
    children: [
      {
        path: '/tickets',
        title: 'All Tickets',
        permissions: [permissionEnum.VIEW_ALL_TICKETS]
      },
      {
        path: '/tickets/my-tickets',
        title: 'My Tickets',
        permissions: [permissionEnum.VIEW_OWN_TICKETS]
      },
      {
        path: '/tickets/new',
        title: 'Create Ticket',
        permissions: [permissionEnum.CREATE_TICKET]
      }
    ]
  },
  {
    path: '/reports',
    title: 'Reports',
    permissions: [permissionEnum.VIEW_ALL_TICKETS],
    icon: 'report',
    children: [
      {
        path: '/reports/weekly',
        title: 'Weekly Report',
        permissions: [permissionEnum.VIEW_ALL_TICKETS]
      },
      {
        path: '/reports/monthly',
        title: 'Monthly Report',
        permissions: [permissionEnum.VIEW_ALL_TICKETS]
      },
      {
        path: '/reports/export',
        title: 'Export Tickets',
        permissions: [permissionEnum.VIEW_ALL_TICKETS]
      }
    ]
  },
  {
    path: '/settings',
    title: 'Settings',
    permissions: [],
    icon: 'settings',
    children: [
      {
        path: '/settings/general',
        title: 'General Settings',
        permissions: []
      },
      {
        path: '/settings/user-account',
        title: 'User Management',
        permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER]
      },
      {
        path: '/settings/project',
        title: 'Project Settings',
        permissions: [permissionEnum.MANAGE_PROJECT]
      },
      {
        path: '/settings/ticket-categories',
        title: 'Categories',
        permissions: [permissionEnum.MANAGE_CATEGORY]
      },
      {
        path: '/settings/customers',
        title: 'Customers',
        permissions: [permissionEnum.MANAGE_PROJECT]
      },
      {
        path: '/settings/customer-for-project',
        title: 'Customer for Project',
        permissions: [permissionEnum.MANAGE_PROJECT]
      }
    ]
  }
];

/**
 * Filter navigation items based on user permissions
 */
export function getAccessibleNavigation(userPermissions: number[]): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(item => {
    const hasParentAccess = item.permissions.length === 0 || 
      item.permissions.some(p => userPermissions.includes(p));
    
    if (!hasParentAccess) {
      return false;
    }
    
    if (item.children) {
      const accessibleChildren = item.children.filter(child => 
        child.permissions.length === 0 || 
        child.permissions.some(p => userPermissions.includes(p))
      );
      
      return accessibleChildren.length > 0 || item.children.length === 0;
    }
    
    return true;
  }).map(item => ({
    ...item,
    children: item.children?.filter(child => 
      child.permissions.length === 0 || 
      child.permissions.some(p => userPermissions.includes(p))
    )
  }));
}