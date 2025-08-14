import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService, MasterFilterCategory, MasterFilterProject, AllTicketData } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';

// ✅ Import Permission Models
import { permissionEnum, UserRole, ROLES } from '../../../shared/models/permission.model';
import { UserWithPermissions } from '../../../shared/models/user.model';

// ✅ Import Permission Directives
import { HasPermissionDirective, HasRoleDirective } from '../../../shared/directives/permission.directive';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    HasPermissionDirective,  // ✅ Import permission directives
    HasRoleDirective
  ],
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.css']
})
export class TicketListComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // ✅ Permission Enums (for template usage)
  readonly permissionEnum = permissionEnum;
  readonly ROLES = ROLES;

  // ✅ User and Permission Data
  currentUser: UserWithPermissions | null = null;
  userPermissions: permissionEnum[] = [];
  userRoles: UserRole[] = [];

  // ✅ View Mode Configuration
  viewMode: 'all' | 'own-only' = 'all';
  canViewAllTickets = false;
  canViewOwnTickets = false;
  canCreateTickets = false;
  canManageTickets = false;

  // ✅ Ticket Data
  tickets: AllTicketData[] = [];
  filteredTickets: AllTicketData[] = [];
  isLoading = false;
  ticketsError = '';
  noTicketsFound = false;

  // ✅ Filter Data
  categories: MasterFilterCategory[] = [];
  projects: MasterFilterProject[] = [];
  loadingFilters = false;
  filterError = '';

  // ✅ Status Management
  statusCacheLoaded = false;
  isLoadingStatuses = false;
  statusError = '';

  // ✅ Filter States
  searchText = '';
  selectedPriority = '';
  selectedStatus = '';
  selectedProject = '';
  selectedCategory = '';

  // ✅ Priority Options
  priorityOptions = [
    { value: '', label: 'All Priority' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  // ✅ Status Options
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
    console.log('🎫 TicketListComponent initialized');
    
    // ✅ Load user data and permissions
    this.loadUserData();
    
    // ✅ Determine view mode from route data
    this.determineViewMode();
    
    // ✅ Check permissions
    this.checkPermissions();
    
    // ✅ Load data
    this.loadStatusCache();
    this.loadMasterFilters();
    this.loadTickets();
  }

  // ===== USER DATA & PERMISSIONS ===== ✅

  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUserWithPermissions();
    this.userPermissions = this.authService.getUserPermissions();
    this.userRoles = this.authService.getUserRoles();
    
    console.log('👤 User data loaded:', {
      username: this.currentUser?.username,
      permissions: this.userPermissions.length,
      roles: this.userRoles,
      primaryRole: this.authService.getPrimaryRole()
    });
  }

  private determineViewMode(): void {
    // ✅ Check route data for view mode
    const routeViewMode = this.route.snapshot.data['viewMode'];
    if (routeViewMode === 'own-only') {
      this.viewMode = 'own-only';
      console.log('📋 View mode set to: own-only (from route data)');
    } else {
      // ✅ Auto-determine based on permissions
      if (this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS)) {
        this.viewMode = 'all';
        console.log('📋 View mode set to: all (has VIEW_ALL_TICKETS permission)');
      } else if (this.authService.hasPermission(permissionEnum.VIEW_OWN_TICKETS)) {
        this.viewMode = 'own-only';
        console.log('📋 View mode set to: own-only (has VIEW_OWN_TICKETS permission only)');
      } else {
        console.warn('⚠️ User has no ticket viewing permissions');
        this.viewMode = 'own-only'; // Default fallback
      }
    }
  }

  private checkPermissions(): void {
    this.canViewAllTickets = this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS);
    this.canViewOwnTickets = this.authService.hasPermission(permissionEnum.VIEW_OWN_TICKETS);
    this.canCreateTickets = this.authService.hasPermission(permissionEnum.CREATE_TICKET);
    this.canManageTickets = this.authService.canManageTickets();

    console.log('🔐 Permission check results:', {
      canViewAllTickets: this.canViewAllTickets,
      canViewOwnTickets: this.canViewOwnTickets,
      canCreateTickets: this.canCreateTickets,
      canManageTickets: this.canManageTickets,
      viewMode: this.viewMode
    });

    // ✅ Redirect if no permissions
    if (!this.canViewAllTickets && !this.canViewOwnTickets) {
      console.error('❌ User has no ticket viewing permissions, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
      return;
    }
  }

  // ===== PERMISSION HELPER METHODS ===== ✅

  hasPermission(permission: permissionEnum): boolean {
    return this.authService.hasPermission(permission);
  }

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  canEditTicket(ticket: AllTicketData): boolean {
    // ✅ Admin/Supporter can edit any ticket
    if (this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER])) {
      return this.hasPermission(permissionEnum.EDIT_TICKET) || 
             this.hasPermission(permissionEnum.CHANGE_STATUS);
    }
    
    // ✅ Users can edit their own tickets
    if (this.hasRole(ROLES.USER)) {
      return this.hasPermission(permissionEnum.EDIT_TICKET) && 
             ticket.create_by === this.currentUser?.id;
    }
    
    return false;
  }

  canDeleteTicket(ticket: AllTicketData): boolean {
    // ✅ Admin can delete any ticket
    if (this.hasRole(ROLES.ADMIN)) {
      return this.hasPermission(permissionEnum.DELETE_TICKET);
    }
    
    // ✅ Users can delete their own tickets (if not in progress)
    if (this.hasRole(ROLES.USER)) {
      return this.hasPermission(permissionEnum.DELETE_TICKET) && 
             ticket.create_by === this.currentUser?.id &&
             ticket.status_id === 1; // Only if status is "Created"
    }
    
    return false;
  }

  canChangeStatus(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.CHANGE_STATUS) &&
           this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canAssignTicket(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.ASSIGNEE) &&
           this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canReplyToTicket(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.REPLY_TICKET) &&
           this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canSolveProblem(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.SOLVE_PROBLEM) &&
           this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canRateSatisfaction(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.SATISFACTION) &&
           ticket.create_by === this.currentUser?.id &&
           ticket.status_id === 5; // Completed status
  }

  // ===== DATA LOADING ===== ✅

  private loadStatusCache(): void {
    console.log('=== Loading Status Cache ===');
    
    if (this.apiService.isStatusCacheLoaded()) {
      this.statusCacheLoaded = true;
      console.log('✅ Status cache already loaded');
      return;
    }

    this.isLoadingStatuses = true;
    this.statusError = '';

    this.apiService.loadAndCacheStatuses().subscribe({
      next: (success) => {
        if (success) {
          this.statusCacheLoaded = true;
          console.log('✅ Status cache loaded successfully');
        } else {
          console.warn('Status cache loading failed, using defaults');
          this.statusError = 'ไม่สามารถโหลดข้อมูลสถานะได้';
        }
        this.isLoadingStatuses = false;
      },
      error: (error) => {
        console.error('❌ Error loading status cache:', error);
        this.statusError = 'เกิดข้อผิดพลาดในการโหลดสถานะ';
        this.isLoadingStatuses = false;
      }
    });
  }

  private loadTickets(): void {
    console.log(`=== Loading Tickets (${this.viewMode} mode) ===`);
    this.isLoading = true;
    this.ticketsError = '';
    this.noTicketsFound = false;

    // ✅ Use different methods based on view mode
    const ticketObservable = this.viewMode === 'all' 
      ? this.apiService.getAllTicketsWithDetails()
      : this.apiService.getAllTicketsWithDetails(); // TODO: Implement getOwnTickets() if needed

    ticketObservable.subscribe({
      next: (tickets) => {
        console.log('✅ Tickets loaded successfully:', tickets.length);
        
        // ✅ Filter tickets based on view mode and permissions
        const filteredTickets = this.filterTicketsByPermission(tickets);
        
        if (filteredTickets.length === 0) {
          this.noTicketsFound = true;
          this.tickets = [];
          this.filteredTickets = [];
        } else {
          this.tickets = filteredTickets;
          this.filteredTickets = [...this.tickets];
          this.applyFilters();
          this.noTicketsFound = false;
        }
        
        this.isLoading = false;
        
        console.log('📊 Ticket loading summary:', {
          totalLoaded: tickets.length,
          afterPermissionFilter: filteredTickets.length,
          viewMode: this.viewMode,
          userCanViewAll: this.canViewAllTickets,
          userCanViewOwn: this.canViewOwnTickets
        });
      },
      error: (error) => {
        console.error('❌ Error loading tickets:', error);
        this.ticketsError = typeof error === 'string' ? error : 'เกิดข้อผิดพลาดในการโหลดตั๋ว';
        this.isLoading = false;
        this.noTicketsFound = true;
      }
    });
  }

  private filterTicketsByPermission(tickets: AllTicketData[]): AllTicketData[] {
    if (this.viewMode === 'all' && this.canViewAllTickets) {
      // ✅ Can view all tickets
      return tickets;
    } else if (this.canViewOwnTickets && this.currentUser) {
      // ✅ Can only view own tickets
      return tickets.filter(ticket => ticket.create_by === this.currentUser!.id);
    } else {
      // ✅ No permission to view any tickets
      console.warn('⚠️ User has no permission to view tickets');
      return [];
    }
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
        }
        
        this.loadingFilters = false;
      },
      error: (error) => {
        console.error('Error loading master filters:', error);
        this.filterError = typeof error === 'string' ? error : 'เกิดข้อผิดพลาดในการโหลดข้อมูล filter';
        this.loadingFilters = false;
      }
    });
  }

  // ===== STATUS MANAGEMENT ===== ✅

  getStatusText(statusId: number): string {
    if (this.statusCacheLoaded) {
      return this.apiService.getCachedStatusName(statusId);
    }
    
    // Fallback ถ้า cache ยังไม่โหลด
    switch (statusId) {
      case 1: return 'Created';
      case 2: return 'Open Ticket';
      case 3: return 'In Progress';
      case 4: return 'Resolved';
      case 5: return 'Completed';
      case 6: return 'Cancel';
      default: return 'Unknown';
    }
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

  getStatusIcon(statusId: number): string {
    switch (statusId) {
      case 1: return 'bi-plus-circle';      // Created
      case 2: return 'bi-clock';            // Open Ticket
      case 3: return 'bi-play-circle';      // In Progress
      case 4: return 'bi-clipboard-check';  // Resolved
      case 5: return 'bi-check-circle';     // Completed
      case 6: return 'bi-x-circle';         // Cancel
      default: return 'bi-clock';
    }
  }

  // ===== FILTER METHODS ===== ✅

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
        (ticket.project_name && ticket.project_name.toLowerCase().includes(searchLower)) ||
        (ticket.user_name && ticket.user_name.toLowerCase().includes(searchLower)) ||
        (ticket.category_name && ticket.category_name.toLowerCase().includes(searchLower))
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

  // ===== STYLING METHODS ===== ✅

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

  // ===== NAVIGATION METHODS ===== ✅

  viewTicket(ticket: AllTicketData): void {
    console.log('Viewing ticket:', ticket.ticket_no);
    this.router.navigate(['/tickets', ticket.ticket_no]);
  }

  editTicket(ticket: AllTicketData): void {
    if (!this.canEditTicket(ticket)) {
      console.warn('User cannot edit this ticket');
      return;
    }
    
    console.log('Editing ticket:', ticket.ticket_no);
    this.router.navigate(['/tickets/edit', ticket.ticket_no]);
  }

  createNewTicket(): void {
    if (!this.canCreateTickets) {
      console.warn('User cannot create tickets');
      return;
    }
    
    console.log('Creating new ticket');
    this.router.navigate(['/tickets/new']);
  }

  // ===== TICKET ACTIONS ===== ✅

  deleteTicket(ticket: AllTicketData): void {
    if (!this.canDeleteTicket(ticket)) {
      console.warn('User cannot delete this ticket');
      return;
    }

    const confirmDelete = confirm(
      `คุณต้องการลบตั๋ว ${ticket.ticket_no} หรือไม่?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้`
    );

    if (confirmDelete) {
      console.log('Deleting ticket:', ticket.ticket_no);
      
      this.apiService.deleteTicketByTicketNo(ticket.ticket_no).subscribe({
        next: (response) => {
          if (response.code === 1) {
            console.log('✅ Ticket deleted successfully');
            // Reload tickets
            this.loadTickets();
          } else {
            console.error('❌ Failed to delete ticket:', response.message);
            alert('ไม่สามารถลบตั๋วได้: ' + response.message);
          }
        },
        error: (error) => {
          console.error('❌ Error deleting ticket:', error);
          alert('เกิดข้อผิดพลาดในการลบตั๋ว');
        }
      });
    }
  }

  changeTicketStatus(ticket: AllTicketData, newStatusId: number): void {
    if (!this.canChangeStatus(ticket)) {
      console.warn('User cannot change ticket status');
      return;
    }

    console.log('Changing ticket status:', ticket.ticket_no, 'to', newStatusId);
    
    this.apiService.updateTicketByTicketNo(ticket.ticket_no, {
      status_id: newStatusId
    }).subscribe({
      next: (response) => {
        if (response.code === 1) {
          console.log('✅ Ticket status changed successfully');
          // Update local ticket data
          ticket.status_id = newStatusId;
        } else {
          console.error('❌ Failed to change ticket status:', response.message);
          alert('ไม่สามารถเปลี่ยนสถานะตั๋วได้: ' + response.message);
        }
      },
      error: (error) => {
        console.error('❌ Error changing ticket status:', error);
        alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะตั๋ว');
      }
    });
  }

  assignTicket(ticket: AllTicketData): void {
    if (!this.canAssignTicket(ticket)) {
      console.warn('User cannot assign tickets');
      return;
    }

    // TODO: Implement ticket assignment logic
    console.log('Assigning ticket:', ticket.ticket_no);
    alert('ฟีเจอร์การมอบหมายตั๋วยังไม่พร้อมใช้งาน');
  }

  // ===== UTILITY METHODS ===== ✅

  reloadTickets(): void {
    console.log('🔄 Reloading tickets');
    this.loadTickets();
  }

  reloadStatusCache(): void {
    console.log('Reloading status cache...');
    this.apiService.clearStatusCache();
    this.statusCacheLoaded = false;
    this.loadStatusCache();
  }

  getDebugInfo(): any {
    return {
      totalTickets: this.tickets.length,
      filteredTickets: this.filteredTickets.length,
      currentUser: this.currentUser?.id,
      viewMode: this.viewMode,
      permissions: {
        canViewAll: this.canViewAllTickets,
        canViewOwn: this.canViewOwnTickets,
        canCreate: this.canCreateTickets,
        canManage: this.canManageTickets
      },
      hasError: !!this.ticketsError,
      isLoading: this.isLoading,
      statusCache: {
        loaded: this.statusCacheLoaded,
        loading: this.isLoadingStatuses,
        error: this.statusError
      },
      filters: {
        search: this.searchText,
        priority: this.selectedPriority,
        status: this.selectedStatus,
        project: this.selectedProject,
        category: this.selectedCategory
      }
    };
  }

  // ===== VIEW MODE METHODS ===== ✅

  getViewModeTitle(): string {
    return this.viewMode === 'all' ? 'All Tickets' : 'My Tickets';
  }

  getViewModeDescription(): string {
    if (this.viewMode === 'all') {
      return 'Viewing all tickets in the system';
    } else {
      return 'Viewing only tickets created by you';
    }
  }

  canSwitchViewMode(): boolean {
    return this.canViewAllTickets && this.canViewOwnTickets;
  }

  switchToAllTickets(): void {
    if (this.canViewAllTickets) {
      this.router.navigate(['/tickets']);
    }
  }

  switchToMyTickets(): void {
    if (this.canViewOwnTickets) {
      this.router.navigate(['/tickets/my-tickets']);
    }
  }
}