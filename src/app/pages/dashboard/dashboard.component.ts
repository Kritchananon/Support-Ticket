// src/app/pages/dashboard/dashboard.component.ts

import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { DashboardService } from '../../shared/services/dashboard.service';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import {
  DashboardStatsResponse,
  CategoryStatsDTO,
  createInitialDashboardData,
  DashboardData
} from '../../shared/models/common.model';

// Register Chart.js components
Chart.register(...registerables);

interface TicketSummary {
  id: number;
  createdAt: string;
  completedAt: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private subscriptions = new Subscription(); // ✅ ใช้ Subscription เดียว

  // Chart References
  @ViewChild('monthlyChart', { static: false }) monthlyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart', { static: false }) categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChart', { static: false }) pieChartRef!: ElementRef<HTMLCanvasElement>;

  // Dashboard data state
  dashboardData = {
    loading: false,
    stats: null as any,
    categoryStats: null as CategoryStatsDTO[] | null,
    error: null as string | null,
    lastUpdated: null as Date | null
  };

  currentUser: any;

  // Chart instances
  private monthlyChart: Chart | null = null;
  private categoryChart: Chart | null = null;
  private pieChart: Chart | null = null;

  // Filter states
  selectedMonth = 'June';
  selectedYear = '2025';
  selectedCategoryYear = '2025';

  // Legacy data for projects
  customerForProjects: any[] = [];
  loadingCustomers = false;

  // Getters for convenience
  get dashboardStats(): any {
    return this.dashboardData.stats;
  }

  get categoryStats(): CategoryStatsDTO[] {
    return this.dashboardData.categoryStats || [];
  }

  get isLoading(): boolean {
    return this.dashboardData.loading;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    console.log('Dashboard initialized, current user:', this.currentUser);
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeAllCharts();
    }, 100);
  }

  // =============================================================================
  // DATA LOADING METHODS
  // =============================================================================

  loadDashboardData(): void {
    console.log('Loading dashboard data...');

    this.dashboardData.loading = true;
    this.dashboardData.error = null;

    this.loadDashboardStats();
    this.loadCategoryBreakdown();
    this.loadCustomerForProjects();
  }

  loadDashboardStats(): void {
    console.log('Loading dashboard stats from API...');

    const sub = this.dashboardService.getDashboardStats().subscribe({
      next: (response) => {
        console.log('Dashboard stats response:', response);

        if (response.status === 1 && response.code === '1') {
          this.dashboardData.stats = response.data;
          this.dashboardData.error = null;
          this.dashboardData.lastUpdated = new Date();
          console.log('Dashboard stats updated successfully:', this.dashboardData.stats);

          // Update all charts after data is loaded
          this.updateAllChartsWithNewData();
        } else {
          console.warn('Invalid API response:', response);
          this.dashboardData.error = 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
        }

        this.dashboardData.loading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.dashboardData.loading = false;
        this.dashboardData.error = 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์';

        this.dashboardData.stats = {
          total: 0,
          new: { count: 0, tickets: [] },
          inProgress: { count: 0, tickets: [] },
          complete: { count: 0, tickets: [] }
        } as any;
      }
    });

    this.subscriptions.add(sub);
  }

  loadCategoryBreakdown(): void {
    console.log('Loading category breakdown from API...');

    const currentYear = parseInt(this.selectedCategoryYear);
    const currentMonth = this.getMonthNumber(this.selectedMonth);
    const userId = this.currentUser?.id;

    const sub = this.dashboardService.getCategoryBreakdown(currentYear, currentMonth, userId).subscribe({
      next: (response) => {
        console.log('Category breakdown loaded:', response);

        // ✅ response ต้องเป็น ApiResponse<CategoryStatsDTO[]>
        const data = Array.isArray(response) ? response : response.data;

        if (!data || data.length === 0) {
          console.warn('ไม่มีข้อมูลหมวดหมู่จาก API');
          return;
        }

        // ----- Pie chart -----
        const labels = data.map(item => item.category);
        const counts = data.map(item => item.count);
        const colors = data.map(item => item.color);

        if (this.pieChart) this.pieChart.destroy();
        const piectx = document.getElementById('pieChart') as HTMLCanvasElement;
        this.pieChart = new Chart(piectx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: counts, backgroundColor: colors }] },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (tooltipItem) => {
                    const item = data[tooltipItem.dataIndex];
                    return `${item.category}: ${item.count} (${item.percentage}%)`;
                  }
                }
              }
            }
          }
        });

        // ----- Line chart -----
        if (this.categoryChart) this.categoryChart.destroy();
        const categoryCtx = document.getElementById('categoryChart') as HTMLCanvasElement;

        const datasets = data.map((item) => ({
          label: item.category,
          data: item.monthlyCounts,
          borderColor: item.color,
          backgroundColor: item.color + '33', // สีอ่อนสำหรับ fill
          fill: true,
          tension: 0.4
        }));

        this.categoryChart = new Chart(categoryCtx, {
          type: 'line',
          data: {
            labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
            datasets
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { mode: 'index', intersect: false }
            },
            interaction: { mode: 'nearest', intersect: false },
            scales: {
              y: { beginAtZero: true },
              x: { ticks: { autoSkip: false } }
            }
          }
        });

      },
      error: (err) => {
        console.error('Error loading category breakdown:', err);
      }
    });

    this.subscriptions.add(sub);
  }


  loadCustomerForProjects(): void {
    this.loadingCustomers = true;
    console.log('Loading customer for projects...');

    const sub = this.apiService.getCustomerForProject().subscribe({
      next: (response) => {
        console.log('Customer for projects response:', response);
        if (response.code === '2' || response.status === 1) {
          this.customerForProjects = response.data || [];
        }
        this.loadingCustomers = false;
      },
      error: (error) => {
        console.error('Error loading customer projects:', error);
        this.loadingCustomers = false;
        this.customerForProjects = [];
      }
    });

    this.subscriptions.add(sub);
  }

  // =============================================================================
  // CHART INITIALIZATION METHODS
  // =============================================================================

  initializeAllCharts(): void {
    this.initializeMonthlyChart();
    this.initializeCategoryChart();
    this.initializePieChart();
  }

  private initializeMonthlyChart(): void {
    if (!this.monthlyChartRef?.nativeElement) return;

    const ctx = this.monthlyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'New Tickets',
            data: [],
            borderColor: '#FFC107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#FFC107',
            pointBorderColor: '#FFC107',
            pointHoverBackgroundColor: '#FFC107',
            pointHoverBorderColor: '#FFC107'
          },
          {
            label: 'Completed',
            data: [],
            borderColor: '#28A745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#28A745',
            pointBorderColor: '#28A745',
            pointHoverBackgroundColor: '#28A745',
            pointHoverBorderColor: '#28A745'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1,
            callbacks: {
              title: (tooltipItems) => {
                const day = tooltipItems[0].label;
                const monthNames = [
                  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                ];
                const monthName = monthNames[this.getMonthNumber(this.selectedMonth) - 1];
                return `วันที่ ${day} ${monthName} ${this.selectedYear}`;
              },
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                const suffix = label.includes('New') ? 'ทิคเก็ตใหม่' : 'ทิคเก็ตที่เสร็จ';
                return `${suffix}: ${value} รายการ`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 15,
              font: {
                size: 11
              }
            },
            title: {
              display: true,
              text: 'วันที่',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            },
            ticks: {
              stepSize: 1,
              font: {
                size: 11
              }
            },
            title: {
              display: true,
              text: 'จำนวนทิคเก็ต',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          }
        },
        elements: {
          point: {
            radius: 3,
            hoverRadius: 6
          }
        }
      }
    });

    console.log('Monthly chart initialized');
  }

  private initializeCategoryChart(): void {
    if (!this.categoryChartRef?.nativeElement) return;

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    this.categoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            },
            ticks: {
              stepSize: 1,
              font: {
                size: 11
              }
            }
          }
        },
        elements: {
          point: {
            radius: 2,
            hoverRadius: 4
          }
        }
      }
    });

    console.log('Category chart initialized');
  }

  private initializePieChart(): void {
    if (!this.pieChartRef?.nativeElement) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 0,
          hoverBorderWidth: 2,
          hoverBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ${value.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });

    console.log('Pie chart initialized');
  }

  // =============================================================================
  // CHART UPDATE METHODS
  // =============================================================================

  private updateAllChartsWithNewData(): void {
    if (!this.dashboardData.stats) {
      console.log('Waiting for dashboard stats...');
      return;
    }

    console.log('Updating all charts with new data...');
    this.updateMonthlyChart();
    // Pie chart will be updated separately when category data is loaded
  }

  private updateMonthlyChart(): void {
    if (!this.monthlyChart || !this.dashboardData.stats) return;

    console.log('Updating monthly chart with API data...');

    const currentYear = parseInt(this.selectedYear);
    const currentMonth = this.getMonthNumber(this.selectedMonth);

    // Generate daily data from tickets
    const dailyData = this.generateDailyDataFromTickets(currentYear, currentMonth);

    // Update chart
    this.monthlyChart.data.labels = dailyData.labels;
    this.monthlyChart.data.datasets[0].data = dailyData.newTickets;
    this.monthlyChart.data.datasets[1].data = dailyData.completeTickets;

    this.monthlyChart.update('active');
    console.log('Monthly chart updated successfully');
  }

  private updateCategoryChart(): void {
    if (!this.categoryChart || !this.dashboardData.categoryStats || this.dashboardData.categoryStats.length === 0) return;

    console.log('Updating category chart with backend category data...');

    // Use actual category data from backend
    const categories = this.dashboardData.categoryStats.map(cat => ({
      category: cat.category || cat.category,
      count: cat.count || 0,
      color: this.getCategoryColor(cat.category || cat.category)
    }));

    // Generate monthly trend data for each category
    const monthlyData = this.generateMonthlyTrendFromCategories(categories);

    this.categoryChart.data.datasets = categories.map((category, index) => ({
      label: category.category,
      data: monthlyData[index],
      borderColor: category.color,
      backgroundColor: this.addAlphaToColor(category.color, 0.1),
      fill: true,
      tension: 0.4
    }));

    this.categoryChart.update('active');
    console.log('Category chart updated successfully with backend data');
  }

  private updatePieChart(): void {
    if (!this.pieChart || !this.dashboardData.stats) return;

    console.log('Updating pie chart with dashboard stats data...');

    // Create categories with percentages from dashboard stats
    const total = this.dashboardData.stats.total || 1; // Prevent division by zero
    const categories = [
      {
        category: 'ใหม่',
        count: this.getNewCount(),
        color: '#38a169',
        percentage: (this.getNewCount() / total) * 100
      },
      {
        category: 'กำลังดำเนินการ',
        count: this.getInProgressCount(),
        color: '#d69e2e',
        percentage: (this.getInProgressCount() / total) * 100
      },
      {
        category: 'เสร็จแล้ว',
        count: this.getCompleteCount(),
        color: '#9f7aea',
        percentage: (this.getCompleteCount() / total) * 100
      }
    ].filter(cat => cat.count > 0); // Only show categories with data

    const labels = categories.map(item => item.category);
    const percentages = categories.map(item => item.percentage);
    const colors = categories.map(item => item.color);

    this.pieChart.data.labels = labels;
    this.pieChart.data.datasets[0].data = percentages;
    this.pieChart.data.datasets[0].backgroundColor = colors;

    this.pieChart.update('active');
    console.log('Pie chart updated successfully with dashboard stats');
  }

  private updatePieChartWithCategoryData(): void {
    if (!this.pieChart || !this.dashboardData.categoryStats || this.dashboardData.categoryStats.length === 0) return;

    console.log('Updating pie chart with backend category data...');

    // Calculate total from backend category data
    const totalTickets = this.dashboardData.categoryStats.reduce((sum, cat) => sum + (cat.count || 0), 0);

    if (totalTickets === 0) {
      console.warn('No tickets found in category data');
      return;
    }

    // Create categories with percentages from backend data
    const categories = this.dashboardData.categoryStats
      .filter(cat => (cat.count || 0) > 0) // Only categories with tickets
      .map(cat => ({
        category: cat.category || cat.category || 'Unknown',
        count: cat.count || 0,
        color: this.getCategoryColor(cat.category || cat.category),
        percentage: ((cat.count || 0) / totalTickets) * 100
      }));

    const labels = categories.map(item => item.category);
    const percentages = categories.map(item => item.percentage);
    const colors = categories.map(item => item.color);

    this.pieChart.data.labels = labels;
    this.pieChart.data.datasets[0].data = percentages;
    this.pieChart.data.datasets[0].backgroundColor = colors;

    this.pieChart.update('active');
    console.log('Pie chart updated successfully with backend category data:', {
      totalTickets,
      categoriesCount: categories.length,
      categories: categories.map(c => ({ name: c.category, count: c.count, percentage: c.percentage.toFixed(1) + '%' }))
    });
  }

  // =============================================================================
  // DATA PROCESSING METHODS
  // =============================================================================

  private generateDailyDataFromTickets(year: number, month: number): {
    labels: string[],
    newTickets: number[],
    completeTickets: number[]
  } {
    const daysInMonth = new Date(year, month, 0).getDate();
    const labels: string[] = [];
    const newTicketsCount: number[] = [];
    const completeTicketsCount: number[] = [];

    // Create labels for each day
    for (let day = 1; day <= daysInMonth; day++) {
      labels.push(day.toString());
      newTicketsCount[day - 1] = 0;
      completeTicketsCount[day - 1] = 0;
    }

    // ✅ รวม tickets จากทุก status เพื่อนับ new tickets ที่สร้างในแต่ละวัน
    const allTickets: any[] = [];

    // รวม tickets จาก new status
    if (this.dashboardData.stats?.new) {
      const newTickets = this.extractTicketsArray(this.dashboardData.stats.new);
      allTickets.push(...newTickets);
    }

    // รวม tickets จาก inProgress status  
    if (this.dashboardData.stats?.inProgress) {
      const inProgressTickets = this.extractTicketsArray(this.dashboardData.stats.inProgress);
      allTickets.push(...inProgressTickets);
    }

    // รวม tickets จาก complete status
    if (this.dashboardData.stats?.complete) {
      const completeTickets = this.extractTicketsArray(this.dashboardData.stats.complete);
      allTickets.push(...completeTickets);
    }

    console.log('=== DEBUG: All tickets for new count ===');
    console.log('Total tickets from all statuses:', allTickets.length);
    console.log('New status tickets:', this.dashboardData.stats?.new ? this.extractTicketsArray(this.dashboardData.stats.new).length : 0);
    console.log('InProgress status tickets:', this.dashboardData.stats?.inProgress ? this.extractTicketsArray(this.dashboardData.stats.inProgress).length : 0);
    console.log('Complete status tickets:', this.dashboardData.stats?.complete ? this.extractTicketsArray(this.dashboardData.stats.complete).length : 0);

    // นับ new tickets จากทุก status ตามวันที่สร้าง
    allTickets.forEach((ticket, index) => {
      if (!ticket.createdAt) {
        console.warn(`Ticket ${index + 1} has no createdAt date`);
        return;
      }

      const createdDate = new Date(ticket.createdAt);
      if (createdDate.getFullYear() === year && createdDate.getMonth() + 1 === month) {
        const day = createdDate.getDate();
        if (day >= 1 && day <= daysInMonth) {
          newTicketsCount[day - 1]++;
          console.log(`Adding new ticket to day ${day}, total now: ${newTicketsCount[day - 1]}`);
        }
      }
    });

    // นับ complete tickets เฉพาะจาก complete status ตามวันที่สร้าง
    if (this.dashboardData.stats?.complete) {
      const completeTickets = this.extractTicketsArray(this.dashboardData.stats.complete);

      completeTickets.forEach((ticket, index) => {
        if (!ticket.createdAt) {
          console.warn(`Complete ticket ${index + 1} has no createdAt date`);
          return;
        }

        const createdDate = new Date(ticket.createdAt);
        if (createdDate.getFullYear() === year && createdDate.getMonth() + 1 === month) {
          const day = createdDate.getDate();
          if (day >= 1 && day <= daysInMonth) {
            completeTicketsCount[day - 1]++;
            console.log(`Adding complete ticket to day ${day}, total now: ${completeTicketsCount[day - 1]}`);
          }
        }
      });
    }

    console.log('=== FINAL RESULTS ===');
    console.log('New tickets by day:', newTicketsCount);
    console.log('Complete tickets by day:', completeTicketsCount);
    console.log('Total new tickets:', newTicketsCount.reduce((sum, count) => sum + count, 0));
    console.log('Total complete tickets:', completeTicketsCount.reduce((sum, count) => sum + count, 0));

    // แสดงข้อมูลที่ไม่เป็น 0
    newTicketsCount.forEach((count, index) => {
      if (count > 0) {
        console.log(`Day ${index + 1}: ${count} new tickets`);
      }
    });

    completeTicketsCount.forEach((count, index) => {
      if (count > 0) {
        console.log(`Day ${index + 1}: ${count} complete tickets`);
      }
    });

    return {
      labels,
      newTickets: newTicketsCount,
      completeTickets: completeTicketsCount
    };
  }

  private generateMonthlyDataFromCategories(categories: any[]): number[][] {
    const months = 12;
    return categories.map(category => {
      const baseValue = Math.max(1, category.count / 12);
      return Array.from({ length: months }, () => {
        const variation = 0.3;
        const randomFactor = 1 + (Math.random() - 0.5) * variation;
        return Math.round(baseValue * randomFactor);
      });
    });
  }

  private generateMonthlyTrendFromCategories(categories: any[]): number[][] {
    const months = 12;
    return categories.map(category => {
      // Use actual count to generate realistic monthly trend
      const baseValue = Math.max(0, category.count / 6); // Spread across 6 months for trend
      const trendData: number[] = [];

      for (let month = 0; month < months; month++) {
        // Create a trend pattern with some randomness
        const trendFactor = 0.5 + (month / months) * 0.8; // Gradual increase trend
        const randomVariation = 0.8 + Math.random() * 0.4; // 20% variation
        const value = Math.round(baseValue * trendFactor * randomVariation);
        trendData.push(Math.max(0, value));
      }

      return trendData;
    });
  }

  private getCategoryColor(categoryName: string): string {
    // Define colors for different categories
    const colorMap: { [key: string]: string } = {
      // Thai categories
      'ระบบล่ม/ใช้งานไม่ได้': '#e53e3e',
      'ระบบช้า': '#dd6b20',
      'ขอข้อมูล': '#38a169',
      'ขอแก้ไข': '#3182ce',
      'ขอเพิ่มฟีเจอร์': '#805ad5',
      'อื่นๆ': '#718096',
      // English categories
      'System Down': '#e53e3e',
      'Performance': '#dd6b20',
      'Data Request': '#38a169',
      'Modification': '#3182ce',
      'Feature Request': '#805ad5',
      'Others': '#718096',
      // Status categories
      'ใหม่': '#38a169',
      'กำลังดำเนินการ': '#d69e2e',
      'เสร็จแล้ว': '#9f7aea',
      'New': '#38a169',
      'In Progress': '#d69e2e',
      'Complete': '#9f7aea'
    };

    return colorMap[categoryName] || this.generateColorFromString(categoryName);
  }

  private generateColorFromString(str: string): string {
    // Generate consistent color from string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = ['#e53e3e', '#dd6b20', '#38a169', '#3182ce', '#805ad5', '#d53f8c', '#00a3c4', '#319795'];
    return colors[Math.abs(hash) % colors.length];
  }

  private extractTicketsArray(data: any): TicketSummary[] {
    // If object with tickets array
    if (data && typeof data === 'object' && 'tickets' in data && Array.isArray(data.tickets)) {
      return data.tickets;
    }

    // If direct array
    if (Array.isArray(data)) {
      return data;
    }

    // If no data
    return [];
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  getNewCount(): number {
    if (!this.dashboardData.stats) return 0;

    const newData = this.dashboardData.stats.new as any;

    if (newData && typeof newData === 'object' && 'count' in newData) {
      return Number(newData.count) || 0;
    }

    if (Array.isArray(newData)) {
      return newData.length;
    }

    if (typeof newData === 'number') {
      return newData;
    }

    return 0;
  }

  getInProgressCount(): number {
    if (!this.dashboardData.stats) return 0;

    const inProgressData = this.dashboardData.stats.inProgress as any;

    if (inProgressData && typeof inProgressData === 'object' && 'count' in inProgressData) {
      return Number(inProgressData.count) || 0;
    }

    if (Array.isArray(inProgressData)) {
      return inProgressData.length;
    }

    if (typeof inProgressData === 'number') {
      return inProgressData;
    }

    return 0;
  }

  getCompleteCount(): number {
    if (!this.dashboardData.stats) return 0;

    const completeData = this.dashboardData.stats.complete as any;

    if (completeData && typeof completeData === 'object' && 'count' in completeData) {
      return Number(completeData.count) || 0;
    }

    if (Array.isArray(completeData)) {
      return completeData.length;
    }

    if (typeof completeData === 'number') {
      return completeData;
    }

    return 0;
  }

  private getMonthNumber(monthName: string): number {
    const months: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    return months[monthName] || 2;
  }

  private addAlphaToColor(hex: string, alpha: number): string {
    if (!hex.startsWith('#')) return `rgba(0, 0, 0, ${alpha})`;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // =============================================================================
  // FILTER METHODS
  // =============================================================================

  selectYear(year: string): void {
    this.selectedYear = year;
    console.log(`Year changed to: ${year}`);
    this.updateMonthlyChart();
  }

  selectCategoryYear(year: string): void {
    this.selectedCategoryYear = year;
    console.log(`Category year changed to: ${year}`);
    // Reload category data which will update both category chart and pie chart
    this.loadCategoryBreakdown();
  }

  selectMonth(month: string): void {
    this.selectedMonth = month;
    console.log(`Month changed to: ${month}`);
    this.updateMonthlyChart();
    // Also reload category data if it depends on month
    this.loadCategoryBreakdown();
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  getCategoryColumns(): CategoryStatsDTO[][] {
    if (this.categoryStats.length === 0) return [];

    const itemsPerColumn = Math.ceil(this.categoryStats.length / 2);
    const column1 = this.categoryStats.slice(0, itemsPerColumn);
    const column2 = this.categoryStats.slice(itemsPerColumn);

    return [column1, column2];
  }

  refreshDashboard(): void {
    console.log('Refreshing dashboard data...');
    this.loadDashboardData();
  }

  isDataReady(): boolean {
    return this.dashboardStats !== null;
  }

  formatNumber(num: number): string {
    if (!num) return '0';
    return num.toLocaleString('th-TH');
  }

  calculatePercentageChange(current: number, previous: number): number {
    if (!previous) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  shouldShowLoading(): boolean {
    return this.isLoading && !this.dashboardStats;
  }

  shouldShowError(): boolean {
    return !!this.dashboardData.error && !this.isLoading;
  }

  clearError(): void {
    this.dashboardData.error = null;
  }

  updateUserAssignment(id: number, newUserId: number): void {
    const sub = this.apiService.updateCustomerForProject(id, { user_id: newUserId }).subscribe({
      next: (response) => {
        if (response.status === 1 || response.code === '2') {
          console.log('อัพเดทสำเร็จ');
          this.loadCustomerForProjects();
        }
      },
      error: (error) => {
        console.error('Error updating:', error);
      }
    });

    this.subscriptions.add(sub);
  }

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'bg-warning';
      case 2: return 'bg-info';
      case 3: return 'bg-secondary';
      case 4: return 'bg-primary';
      case 5: return 'bg-success';
      case 6: return 'bg-danger';
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
    this.subscriptions.unsubscribe();

    if (this.monthlyChart) {
      this.monthlyChart.destroy();
      this.monthlyChart = null;
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
      this.categoryChart = null;
    }
    if (this.pieChart) {
      this.pieChart.destroy();
      this.pieChart = null;
    }
  }
}