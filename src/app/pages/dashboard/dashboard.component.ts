import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  customerForProjects: any[] = [];
  tickets: any[] = [];
  dashboardStats: any = null;
  loading = false;
  loadingCustomers = false;
  currentUser: any;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadDashboardStats();
    this.loadRecentTickets();
    this.loadCustomerForProjects();
  }

  loadDashboardStats(): void {
    // ถ้า backend มี API สำหรับ dashboard stats
    this.apiService.getDashboardStats().subscribe({
      next: (response) => {
        if (response.code === '2' || response.status === 1) {
          this.dashboardStats = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        // ใช้ข้อมูล mock ถ้าเกิดข้อผิดพลาด
        this.dashboardStats = {
          totalTickets: 240,
          newTickets: 20,
          inProgress: 20,
          completed: 210
        };
      }
    });
  }

  loadRecentTickets(): void {
    this.loading = true;
    
    this.apiService.getTickets().subscribe({
      next: (response) => {
        if (response.code === '2' || response.status === 1) {
          this.tickets = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading tickets:', error);
        this.loading = false;
      }
    });
  }

  loadCustomerForProjects(): void {
    this.loadingCustomers = true;
    
    this.apiService.getCustomerForProject().subscribe({
      next: (response) => {
        if (response.code === '2' || response.status === 1) {
          this.customerForProjects = response.data;
        }
        this.loadingCustomers = false;
      },
      error: (error) => {
        console.error('Error loading customer projects:', error);
        this.loadingCustomers = false;
      }
    });
  }

  updateUserAssignment(id: number, newUserId: number): void {
    this.apiService.updateCustomerForProject(id, { user_id: newUserId }).subscribe({
      next: (response) => {
        if (response.status === 1 || response.code === '2') {
          console.log('อัพเดทสำเร็จ');
          this.loadCustomerForProjects(); // โหลดข้อมูลใหม่
        }
      },
      error: (error) => {
        console.error('Error updating:', error);
      }
    });
  }

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'bg-warning';    // Pending
      case 2: return 'bg-info';       // In Progress  
      case 3: return 'bg-secondary';  // Hold
      case 4: return 'bg-primary';    // Resolved
      case 5: return 'bg-success';    // Complete
      case 6: return 'bg-danger';     // Cancel
      default: return 'bg-secondary';
    }
  }

  getStatusText(statusId: number): string {
    switch (statusId) {
      case 1: return 'Pending';
      case 2: return 'In Progress';
      case 3: return 'Hold';
      case 4: return 'Resolved';
      case 5: return 'Complete';
      case 6: return 'Cancel';
      default: return 'Unknown';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('th-TH');
    } catch {
      return 'N/A';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
