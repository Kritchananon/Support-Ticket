import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TicketCreateComponent } from './pages/tickets/ticket-create/ticket-create.component';
import { TicketListComponent } from './pages/tickets/ticket-list/ticket-list.component';
import { TicketDetailComponent } from './pages/tickets/ticket-detail/ticket-detail.component';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  // Auth routes (no guard)
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        component: LoginComponent
      }
    ]
  },
  // Protected routes (with auth guard)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent
      },
      // Ticket Routes
      {
        path: 'tickets',
        children: [
          {
            path: '',
            component: TicketListComponent // เปลี่ยนจาก ticket-list เป็น all tickets
          },
          {
            path: 'new',
            component: TicketCreateComponent
          },
          {
            path: ':id',
            component: TicketDetailComponent
          }
        ]
      }
      // เพิ่ม routes อื่นๆ ทีหลัง สำหรับ Reports และ Settings
    ]
  },
  // Fallback route
  {
    path: '**',
    redirectTo: '/login'
  }
];
