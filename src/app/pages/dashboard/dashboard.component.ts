import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('monthlyChart', { static: false }) monthlyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart', { static: false }) categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChart', { static: false }) pieChartRef!: ElementRef<HTMLCanvasElement>;

  customerForProjects: any[] = [];
  tickets: any[] = [];
  dashboardStats: any = null;
  loading = false;
  loadingCustomers = false;
  currentUser: any;

  // Chart instances
  monthlyChart: Chart | null = null;
  categoryChart: Chart | null = null;
  pieChart: Chart | null = null;

  // Filter states
  selectedMonth = 'February';
  selectedYear = '2025';
  selectedCategoryYear = '2025';

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Initialize charts after view is ready
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  loadDashboardData(): void {
    this.loadDashboardStats();
    this.loadRecentTickets();
    this.loadCustomerForProjects();
  }

  loadDashboardStats(): void {
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

  initializeCharts(): void {
    this.createMonthlyChart();
    this.createCategoryChart();
    this.createPieChart();
  }

  createMonthlyChart(): void {
    if (!this.monthlyChartRef?.nativeElement) return;

    const ctx = this.monthlyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Sample data for monthly chart
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const newTicketData = [40, 35, 45, 60, 65, 45, 50, 55, 48, 52, 70, 68, 45, 50, 55, 60, 45, 50, 40, 35, 45, 50, 55, 75, 65, 70, 50, 45, 40, 45, 50];
    const completeData = [30, 25, 35, 50, 55, 35, 40, 45, 38, 42, 60, 58, 35, 40, 45, 50, 35, 40, 30, 25, 35, 40, 45, 65, 55, 60, 40, 35, 30, 35, 40];

    this.monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'New Ticket',
            data: newTicketData,
            borderColor: '#fdcb6e',
            backgroundColor: 'rgba(253, 203, 110, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: 'Complete',
            data: completeData,
            borderColor: '#00b894',
            backgroundColor: 'rgba(0, 184, 148, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 10
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          }
        },
        elements: {
          point: {
            radius: 0,
            hoverRadius: 6
          }
        }
      }
    });
  }

  createCategoryChart(): void {
    if (!this.categoryChartRef?.nativeElement) return;

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Sample data for category chart
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    this.categoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'บันทึกข้อมูลไม่ได้',
            data: [20, 25, 30, 35, 25, 30, 35, 40, 35, 30, 25, 15],
            borderColor: '#17a2b8',
            backgroundColor: 'rgba(23, 162, 184, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'ปัญหาอื่นๆ',
            data: [15, 20, 25, 20, 15, 20, 25, 30, 25, 20, 15, 10],
            borderColor: '#6c5ce7',
            backgroundColor: 'rgba(108, 92, 231, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'ระบบล่ม/ใช้งานไม่ได้',
            data: [25, 30, 20, 25, 30, 35, 25, 20, 25, 30, 35, 20],
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'อื่นๆ',
            data: [10, 15, 20, 15, 20, 15, 20, 25, 20, 15, 10, 5],
            borderColor: '#6c757d',
            backgroundColor: 'rgba(108, 117, 125, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            max: 60,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          }
        },
        elements: {
          point: {
            radius: 0,
            hoverRadius: 4
          }
        }
      }
    });
  }

  createPieChart(): void {
    if (!this.pieChartRef?.nativeElement) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['บันทึกข้อมูลไม่ได้', 'ปัญหาอื่นๆ', 'ระบบล่ม/ใช้งานไม่ได้', 'อื่นๆ'],
        datasets: [{
          data: [35, 25, 30, 10],
          backgroundColor: [
            '#17a2b8',
            '#6c5ce7', 
            '#dc3545',
            '#6c757d'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  // Filter methods
  selectMonth(month: string): void {
    this.selectedMonth = month;
    // Reload monthly chart data based on selected month
    this.updateMonthlyChart();
  }

  selectYear(year: string): void {
    this.selectedYear = year;
    this.updateMonthlyChart();
  }

  selectCategoryYear(year: string): void {
    this.selectedCategoryYear = year;
    this.updateCategoryChart();
  }

  updateMonthlyChart(): void {
    // Update chart data based on selected month/year
    // This would typically fetch new data from API
    console.log(`Updating monthly chart for ${this.selectedMonth} ${this.selectedYear}`);
  }

  updateCategoryChart(): void {
    // Update chart data based on selected year
    console.log(`Updating category chart for ${this.selectedCategoryYear}`);
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

  ngOnDestroy(): void {
    // Clean up chart instances
    if (this.monthlyChart) {
      this.monthlyChart.destroy();
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
    if (this.pieChart) {
      this.pieChart.destroy();
    }
  }
}
