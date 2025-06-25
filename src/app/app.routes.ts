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
            component: TicketListComponent
          },
          {
            path: 'new',
            component: TicketCreateComponent
          },
          {
            // ✅ แก้ไข: เปลี่ยนจาก :id เป็น :ticketNo เพื่อรับ ticket_no แทน ticket_id
            path: ':ticket_no',
            component: TicketDetailComponent
          }
        ]
      }
    ]
  },
  // Fallback route
  {
    path: '**',
    redirectTo: '/login'
  }
];
