import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// Customer interface
export interface CustomerItem {
  id: number;
  company: string;
  address: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
}

// Create Customer Form Interface
export interface CreateCustomerForm {
  company: string;
  address: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css']
})
export class CustomersComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search properties
  searchTerm: string = '';

  // Customer data
  customers: CustomerItem[] = [];
  filteredCustomers: CustomerItem[] = [];

  // Customer stats
  customerStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  // Modal-related properties
  isCreateModalVisible = false;
  isSubmitting = false;
  customerForm!: FormGroup;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
  ) { 
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCustomerData();
    this.loadCustomerStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize form for modal
   */
  private initForm(): void {
    this.customerForm = this.fb.group({
      company: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],
      status: ['active', [Validators.required]]
    });

    console.log('Customer form initialized:', this.customerForm);
  }

  /**
   * Check if field is invalid
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.customerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get address length
   */
  getAddressLength(): number {
    const addressValue = this.customerForm.get('address')?.value;
    return addressValue ? addressValue.length : 0;
  }

  /**
   * โหลดข้อมูล Customer จาก API
   */
  loadCustomerData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading customer data...');

    setTimeout(() => {
      try {
        this.customers = this.getMockCustomerData();
        this.filterCustomers();
        this.isLoading = false;
        console.log('Customer data loaded:', this.customers);
      } catch (error) {
        console.error('Error loading customer data:', error);
        this.hasError = true;
        this.errorMessage = 'Failed to load customer data. Please try again.';
        this.isLoading = false;
        this.loadFallbackData();
      }
    }, 1000);
  }

  /**
   * โหลดสถิติ Customer
   */
  loadCustomerStats(): void {
    setTimeout(() => {
      this.customerStats = {
        total: this.customers.length,
        active: this.customers.filter(c => c.status === 'active').length,
        inactive: this.customers.filter(c => c.status === 'inactive').length,
        newThisMonth: 3
      };
      console.log('Customer stats loaded:', this.customerStats);
    }, 500);
  }

  /**
   * Mock data สำหรับทดสอบ
   */
  private getMockCustomerData(): CustomerItem[] {
    return [
      {
        id: 1,
        company: 'ABC Technology Co., Ltd.',
        address: '123 Technology Drive, Bangkok 10110',
        email: 'contact@abctech.com',
        phone: '+66-2-123-4567',
        status: 'active',
        created_date: '2024-01-10T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-20T10:00:00Z',
        updated_by: 1
      },
      {
        id: 2,
        company: 'XYZ Solutions Ltd.',
        address: '456 Business Avenue, Chiang Mai 50000',
        email: 'info@xyzsolutions.co.th',
        phone: '+66-53-987-6543',
        status: 'active',
        created_date: '2024-01-15T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-18T14:30:00Z',
        updated_by: 1
      },
      {
        id: 3,
        company: 'Global Trade Corporation',
        address: '789 International Plaza, Phuket 83000',
        email: 'admin@globaltrade.th',
        phone: '+66-76-555-0123',
        status: 'active',
        created_date: '2024-02-01T00:00:00Z',
        created_by: 2,
        updated_date: '2025-08-15T09:00:00Z',
        updated_by: 2
      },
      {
        id: 4,
        company: 'Innovative Systems Inc.',
        address: '321 Innovation Street, Khon Kaen 40000',
        email: 'hello@innovative.systems',
        phone: '+66-43-777-8888',
        status: 'active',
        created_date: '2024-02-10T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-10T16:45:00Z',
        updated_by: 1
      },
      {
        id: 5,
        company: 'Legacy Holdings Co.',
        address: '654 Old Town Road, Ayutthaya 13000',
        email: 'legacy@holdings.th',
        phone: '+66-35-222-3333',
        status: 'inactive',
        created_date: '2024-03-01T00:00:00Z',
        created_by: 2,
        updated_date: '2025-07-30T11:20:00Z',
        updated_by: 3
      },
      {
        id: 6,
        company: 'Smart Digital Agency',
        address: '987 Digital Hub, Nonthaburi 11000',
        email: 'contact@smartdigital.agency',
        phone: '+66-2-444-5555',
        status: 'active',
        created_date: '2024-07-15T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-25T08:15:00Z',
        updated_by: 1
      }
    ];
  }

  /**
   * โหลดข้อมูล fallback เมื่อ API ล้มเหลว
   */
  private loadFallbackData(): void {
    this.customers = this.getMockCustomerData();
    this.filterCustomers();
  }

  /**
   * Filter customers based on search term
   */
  filterCustomers(): void {
    this.filteredCustomers = this.customers.filter(customer => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(customer, this.searchTerm.toLowerCase());

      return matchesSearch;
    });

    console.log('Filtered customers:', this.filteredCustomers.length, 'of', this.customers.length);
  }

  /**
   * ตรวจสอบว่าตรงกับคำค้นหาหรือไม่
   */
  private matchesSearchTerm(customer: CustomerItem, searchTerm: string): boolean {
    const searchableFields = [
      customer.company || '',
      customer.address || '',
      customer.email || '',
      customer.phone || '',
      customer.status || ''
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Handle search input change
   */
  onSearchChange(): void {
    this.filterCustomers();
  }

  // ============ MODAL METHODS ============

  /**
   * เปิด Modal สำหรับสร้าง Customer ใหม่
   */
  createNewCustomer(): void {
    console.log('Opening create new customer modal');
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  /**
   * ปิด Modal
   */
  onModalClose(): void {
    console.log('Create customer modal closed');
    if (!this.isSubmitting) {
      this.resetForm();
      this.isCreateModalVisible = false;
    }
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(): void {
    this.onModalClose();
  }

  /**
   * Reset form
   */
  private resetForm(): void {
    this.customerForm.reset({
      status: 'active'
    });
    this.isSubmitting = false;
    console.log('Customer form reset');
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    console.log('Customer form submitted');
    console.log('Form valid:', this.customerForm.valid);
    console.log('Form value:', this.customerForm.value);
    
    Object.keys(this.customerForm.controls).forEach(key => {
      const control = this.customerForm.get(key);
      console.log(`${key}:`, control?.value, control?.valid, control?.errors);
    });

    if (this.customerForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      console.log('Creating customer...');
      
      const formData = this.customerForm.value;
      
      setTimeout(() => {
        this.onCustomerCreated(formData);
        this.isSubmitting = false;
      }, 1000);
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.customerForm.controls).forEach(key => {
        const control = this.customerForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * จัดการการสร้าง Customer ใหม่จาก Modal
   */
  onCustomerCreated(customerData: CreateCustomerForm): void {
    console.log('New customer created:', customerData);
    
    const newCustomer: CustomerItem = {
      id: Date.now(),
      company: customerData.company,
      address: customerData.address,
      email: customerData.email,
      phone: customerData.phone,
      status: customerData.status,
      created_date: new Date().toISOString(),
      created_by: 1,
    };

    this.customers.unshift(newCustomer);
    this.filterCustomers();
    this.loadCustomerStats();

    this.isCreateModalVisible = false;
    this.showSuccessMessage(`Customer "${customerData.company}" has been created successfully!`);
  }

  /**
   * แสดงข้อความสำเร็จ
   */
  private showSuccessMessage(message: string): void {
    alert(message);
    console.log('Success:', message);
  }

  /**
   * Edit customer
   */
  editCustomer(customerId: number): void {
    console.log('Navigating to edit customer:', customerId);
    this.router.navigate(['/settings/customer-edit', customerId]);
  }

  /**
   * Delete customer with confirmation
   */
  deleteCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) {
      console.error('Customer not found:', customerId);
      return;
    }

    const confirmMessage = `Are you sure you want to delete customer "${customer.company}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteCustomer(customerId, customer.company);
    }
  }

  /**
   * ลบ customer จริงผ่าน API
   */
  private performDeleteCustomer(customerId: number, companyName: string): void {
    console.log('Deleting customer:', { customerId, companyName });

    this.isLoading = true;

    setTimeout(() => {
      try {
        this.customers = this.customers.filter(c => c.id !== customerId);
        this.filterCustomers();
        alert(`Customer "${companyName}" has been deleted successfully.`);
        this.isLoading = false;
        this.loadCustomerStats();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert(`Failed to delete customer "${companyName}". Please try again.`);
        this.isLoading = false;
      }
    }, 1000);
  }

  /**
   * รีเฟรชข้อมูล
   */
  refreshData(): void {
    console.log('Refreshing customer data...');
    this.loadCustomerData(true);
  }

  /**
   * Permission methods
   */
  canManageCustomers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  canEditCustomer(customer: CustomerItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  canDeleteCustomer(customer: CustomerItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  canCreateCustomer(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByCustomerId(index: number, customer: CustomerItem): number {
    return customer.id;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'N/A';
    }
  }

  /**
   * Format datetime for display
   */
  formatDateTime(dateTimeString: string | undefined): string {
    if (!dateTimeString) return 'N/A';

    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting datetime:', dateTimeString, error);
      return 'N/A';
    }
  }

  /**
   * Get customer status display
   */
  getCustomerStatus(customer: CustomerItem): string {
    return customer.status === 'active' ? 'Active' : 'Inactive';
  }

  /**
   * แสดงข้อมูลสถิติ
   */
  getStatsDisplay(): {
    total: string;
    active: string;
    inactive: string;
    newThisMonth: string;
  } {
    return {
      total: this.customerStats.total.toLocaleString(),
      active: this.customerStats.active.toLocaleString(),
      inactive: this.customerStats.inactive.toLocaleString(),
      newThisMonth: this.customerStats.newThisMonth.toLocaleString()
    };
  }

  /**
   * ได้รับ permission description สำหรับแสดงผล
   */
  getPermissionRequiredMessage(): string {
    return 'ต้องมีสิทธิ์ "จัดการ customer" เพื่อดำเนินการนี้';
  }

  /**
   * แสดงข้อความเมื่อไม่มีสิทธิ์
   */
  showPermissionDeniedMessage(action: string): void {
    alert(`คุณไม่มีสิทธิ์ในการ${action}\n\n${this.getPermissionRequiredMessage()}`);
  }

  /**
   * Wrapper methods ที่มีการตรวจสอบสิทธิ์
   */
  onCreateNewCustomer(): void {
    if (!this.canCreateCustomer()) {
      this.showPermissionDeniedMessage('สร้าง customer ใหม่');
      return;
    }
    this.createNewCustomer();
  }

  onEditCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    if (!this.canEditCustomer(customer)) {
      this.showPermissionDeniedMessage('แก้ไข customer');
      return;
    }
    this.editCustomer(customerId);
  }

  onDeleteCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    if (!this.canDeleteCustomer(customer)) {
      this.showPermissionDeniedMessage('ลบ customer');
      return;
    }
    this.deleteCustomer(customerId);
  }
}