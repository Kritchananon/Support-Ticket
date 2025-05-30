import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ProjectDropdownComponent } from '../../../shared/components/project-dropdown/project-dropdown.component';
import { CategoryDropdownComponent } from '../../../shared/components/category-dropdown/category-dropdown.component';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    ProjectDropdownComponent,
    CategoryDropdownComponent
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
    this.loadTickets();
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
        // Mock data for development
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
        categories_id: 1,
        category_name: 'ระบบล่ม/ใช้งานไม่ได้',
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
        categories_id: 1,
        category_name: 'ระบบล่ม/ใช้งานไม่ได้',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
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
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
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
        categories_id: 1,
        category_name: 'ระบบล่ม/ใช้งานไม่ได้',
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

  onProjectChange(event: { project: any, projectId: string | number }): void {
    this.selectedProject = event.projectId.toString();
    this.applyFilters();
  }

  onCategoryChange(event: { category: any, categoryId: string | number }): void {
    this.selectedCategory = event.categoryId.toString();
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.tickets];

    // Apply search filter
    if (this.searchText.trim()) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.ticket_no.toLowerCase().includes(searchLower) ||
        ticket.issue_description.toLowerCase().includes(searchLower) ||
        ticket.project_name.toLowerCase().includes(searchLower) ||
        ticket.user_name.toLowerCase().includes(searchLower)
      );
    }

    // Apply priority filter
    if (this.selectedPriority) {
      filtered = filtered.filter(ticket => ticket.priority === this.selectedPriority);
    }

    // Apply status filter
    if (this.selectedStatus) {
      filtered = filtered.filter(ticket => ticket.status_id.toString() === this.selectedStatus);
    }

    // Apply project filter
    if (this.selectedProject) {
      filtered = filtered.filter(ticket => ticket.project_id.toString() === this.selectedProject);
    }

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(ticket => ticket.categories_id.toString() === this.selectedCategory);
    }

    this.filteredTickets = filtered;
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedPriority = '';
    this.selectedStatus = '';
    this.selectedProject = '';
    this.selectedCategory = '';
    this.filteredTickets = [...this.tickets];
  }

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'badge-pending';     // Pending
      case 2: return 'badge-in-progress'; // In Progress
      case 3: return 'badge-hold';        // Hold
      case 4: return 'badge-resolved';    // Resolved
      case 5: return 'badge-complete';    // Complete
      case 6: return 'badge-cancel';      // Cancel
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
      case 1: return 'bi-clock';                    // Pending
      case 2: return 'bi-chat';                     // In Progress
      case 3: return 'bi-pause-circle';             // Hold
      case 4: return 'bi-check-circle';             // Resolved
      case 5: return 'bi-check-circle-fill';        // Complete
      case 6: return 'bi-x-circle';                 // Cancel
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

  viewTicket(ticketId: number): void {
    this.router.navigate(['/tickets', ticketId]);
  }

  createNewTicket(): void {
    this.router.navigate(['/tickets/new']);
  }
}
