import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, MasterFilterCategory, MasterFilterProject } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule
  ],
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.css']
})
export class TicketListComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  tickets: any[] = [];
  filteredTickets: any[] = [];
  isLoading = false;
  currentUser: any;

  categories: MasterFilterCategory[] = [];
  projects: MasterFilterProject[] = [];
  loadingFilters = false;
  filterError = '';

  // Filter states
  searchText = '';
  selectedPriority = '';
  selectedStatus = '';
  selectedProject = '';
  selectedCategory = '';

  // Priority options
  priorityOptions = [
    { value: '', label: 'All Priority' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  // Status options
  statusOptions = [
    { value: '', label: 'All Status' },
    { value: '1', label: 'Pending' },
    { value: '2', label: 'In Progress' },
    { value: '3', label: 'Hold' },
    { value: '4', label: 'Resolved' },
    { value: '5', label: 'Complete' },
    { value: '6', label: 'Cancel' }
  ];

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMasterFilters();
    this.loadTickets();
  }

  loadMasterFilters(): void {
    this.loadingFilters = true;
    this.filterError = '';

    this.apiService.getAllMasterFilter().subscribe({
      next: (response) => {
        console.log('Master filter response:', response);
        
        if (response.code === 1 && response.data) {
          this.categories = response.data.categories || [];
          this.projects = response.data.projects || [];
          console.log('Categories loaded:', this.categories.length);
          console.log('Projects loaded:', this.projects.length);
        } else {
          this.filterError = response.message || 'ไม่สามารถโหลดข้อมูล filter ได้';
          this.loadMockFilterData();
        }
        
        this.loadingFilters = false;
      },
      error: (error) => {
        console.error('Error loading master filters:', error);
        this.filterError = typeof error === 'string' ? error : 'เกิดข้อผิดพลาดในการโหลดข้อมูล filter';
        this.loadMockFilterData();
        this.loadingFilters = false;
      }
    });
  }

  private loadMockFilterData(): void {
    this.categories = [
      { id: 1, name: 'ระบบล่ม/ใช้งานไม่ได้' },
      { id: 2, name: 'หน้าจอ Error' },
      { id: 3, name: 'ต้องการพัฒนาเพิ่ม' }
    ];
    
    this.projects = [
      { id: 1, name: 'Human Resource Management System (HRMS)' },
      { id: 2, name: 'ระบบจัดการงานขาย' }
    ];
    
    console.log('Using mock filter data');
  }

  loadTickets(): void {
    this.isLoading = true;
    
    this.apiService.getTickets().subscribe({
      next: (response) => {
        if (response.code === '2' || response.status === 1) {
          this.tickets = response.data || [];
          this.filteredTickets = [...this.tickets];
          this.applyFilters();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading tickets:', error);
        this.isLoading = false;
        this.tickets = this.generateMockTickets();
        this.filteredTickets = [...this.tickets];
      }
    });
  }

  generateMockTickets(): any[] {
    return [
      {
        id: 1,
        ticket_no: '#68050001',
        categories_id: 1,
        category_name: 'ระบบล่ม/ใช้งานไม่ได้',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        status_id: 1,
        priority: 'high',
        create_date: '2025-05-08T09:00:00Z',
        create_by: 1,
        user_name: 'Wasan Rungsavang',
        avatar: null
      },
      {
        id: 2,
        ticket_no: '#68050002',
        categories_id: 1,
        category_name: 'ระบบล่ม/ใช้งานไม่ได้',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
        issue_description: 'ระบบแสดงข้อผิดพลาดเมื่อพยายามบันทึกข้อมูลการลา พนักงานไม่สามารถยื่นใบลาได้',
        status_id: 2,
        priority: 'medium',
        create_date: '2025-05-08T09:00:00Z',
        create_by: 1,
        user_name: 'Wasan Rungsavang',
        avatar: null
      },
      {
        id: 3,
        ticket_no: '#68050003',
        categories_id: 2,
        category_name: 'หน้าจอ Error',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        status_id: 3,
        priority: 'low',
        create_date: '2025-05-08T09:00:00Z',
        create_by: 1,
        user_name: 'Wasan Rungsavang',
        avatar: null
      },
      {
        id: 4,
        ticket_no: '#68050004',
        categories_id: 3,
        category_name: 'ต้องการพัฒนาเพิ่ม',
        project_id: 2,
        project_name: 'ระบบจัดการงานขาย',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        status_id: 4,
        priority: 'high',
        create_date: '2025-05-08T09:00:00Z',
        create_by: 1,
        user_name: 'Wasan Rungsavang',
        avatar: null
      },
      {
        id: 5,
        ticket_no: '#68050005',
        categories_id: 1,
        category_name: 'ระบบล่ม/ใช้งานไม่ได้',
        project_id: 2,
        project_name: 'ระบบจัดการงานขาย',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        status_id: 5,
        priority: 'medium',
        create_date: '2025-05-08T09:00:00Z',
        create_by: 1,
        user_name: 'Wasan Rungsavang',
        avatar: null
      },
      {
        id: 6,
        ticket_no: '#68050006',
        categories_id: 2,
        category_name: 'หน้าจอ Error',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        status_id: 6,
        priority: 'low',
        create_date: '2025-05-08T09:00:00Z',
        create_by: 1,
        user_name: 'Wasan Rungsavang',
        avatar: null
      }
    ];
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onPriorityChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedPriority = target.value;
    this.applyFilters();
  }

  onStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStatus = target.value;
    this.applyFilters();
  }

  onProjectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedProject = target.value;
    console.log('Project changed to:', this.selectedProject);
    this.applyFilters();
  }

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory = target.value;
    console.log('Category changed to:', this.selectedCategory);
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.tickets];

    if (this.searchText.trim()) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.ticket_no.toLowerCase().includes(searchLower) ||
        ticket.issue_description.toLowerCase().includes(searchLower) ||
        ticket.project_name.toLowerCase().includes(searchLower) ||
        ticket.user_name.toLowerCase().includes(searchLower) ||
        ticket.category_name.toLowerCase().includes(searchLower)
      );
    }

    if (this.selectedPriority) {
      filtered = filtered.filter(ticket => ticket.priority === this.selectedPriority);
    }

    if (this.selectedStatus) {
      filtered = filtered.filter(ticket => ticket.status_id.toString() === this.selectedStatus);
    }

    if (this.selectedProject) {
      filtered = filtered.filter(ticket => ticket.project_id.toString() === this.selectedProject);
    }

    if (this.selectedCategory) {
      filtered = filtered.filter(ticket => ticket.categories_id.toString() === this.selectedCategory);
    }

    this.filteredTickets = filtered;
    console.log('Filtered tickets:', this.filteredTickets.length, 'of', this.tickets.length);
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedPriority = '';
    this.selectedStatus = '';
    this.selectedProject = '';
    this.selectedCategory = '';
    this.filteredTickets = [...this.tickets];
  }

  refreshFilters(): void {
    this.loadMasterFilters();
  }

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'badge-pending';
      case 2: return 'badge-in-progress';
      case 3: return 'badge-hold';
      case 4: return 'badge-resolved';
      case 5: return 'badge-complete';
      case 6: return 'badge-cancel';
      default: return 'badge-pending';
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

  getStatusIcon(statusId: number): string {
    switch (statusId) {
      case 1: return 'bi-clock';
      case 2: return 'bi-chat';
      case 3: return 'bi-pause-circle';
      case 4: return 'bi-check-circle';
      case 5: return 'bi-check-circle-fill';
      case 6: return 'bi-x-circle';
      default: return 'bi-clock';
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high': return 'badge-priority-high';
      case 'medium': return 'badge-priority-medium';
      case 'low': return 'badge-priority-low';
      default: return 'badge-priority-medium';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  }

  // ✅ แก้ไข: ใช้ ticket_no แทน ticket id สำหรับการ navigate
  viewTicket(ticket: any): void {
    console.log('Viewing ticket:', ticket.ticket_no);
    this.router.navigate(['/tickets', ticket.ticket_no]);
  }

  createNewTicket(): void {
    this.router.navigate(['/tickets/new']);
  }
}