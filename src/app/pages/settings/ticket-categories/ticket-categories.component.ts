import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// Category interface
export interface CategoryItem {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
}

// Create Category Form Interface
export interface CreateCategoryForm {
  name: string;
  description?: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-ticket-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ticket-categories.component.html',
  styleUrls: ['./ticket-categories.component.css']
})
export class TicketCategoriesComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search properties
  searchTerm: string = '';

  // Category data
  categories: CategoryItem[] = [];
  filteredCategories: CategoryItem[] = [];

  // Category stats
  categoryStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  // Modal-related properties
  isCreateModalVisible = false;
  isSubmitting = false;
  categoryForm!: FormGroup;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
  ) { 
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCategoryData();
    this.loadCategoryStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize form for modal
   */
  private initForm(): void {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      description: [''],
      status: ['active', [Validators.required]]
    });

    console.log('Category form initialized:', this.categoryForm);
  }

  /**
   * Check if field is invalid
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.categoryForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get description length
   */
  getDescriptionLength(): number {
    const descValue = this.categoryForm.get('description')?.value;
    return descValue ? descValue.length : 0;
  }

  /**
   * โหลดข้อมูล Category จาก API
   */
  loadCategoryData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading category data...');

    setTimeout(() => {
      try {
        this.categories = this.getMockCategoryData();
        this.filterCategories();
        this.isLoading = false;
        console.log('Category data loaded:', this.categories);
      } catch (error) {
        console.error('Error loading category data:', error);
        this.hasError = true;
        this.errorMessage = 'Failed to load category data. Please try again.';
        this.isLoading = false;
        this.loadFallbackData();
      }
    }, 1000);
  }

  /**
   * โหลดสถิติ Category
   */
  loadCategoryStats(): void {
    setTimeout(() => {
      this.categoryStats = {
        total: this.categories.length,
        active: this.categories.filter(c => c.status === 'active').length,
        inactive: this.categories.filter(c => c.status === 'inactive').length,
        newThisMonth: 2
      };
      console.log('Category stats loaded:', this.categoryStats);
    }, 500);
  }

  /**
   * Mock data สำหรับทดสอบ
   */
  private getMockCategoryData(): CategoryItem[] {
    return [
      {
        id: 1,
        name: 'Technical Issue',
        description: 'Issues related to technical problems',
        status: 'active',
        created_date: '2024-01-10T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-20T10:00:00Z',
        updated_by: 1
      },
      {
        id: 2,
        name: 'Account & Billing',
        description: 'Account management and billing inquiries',
        status: 'active',
        created_date: '2024-01-10T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-18T14:30:00Z',
        updated_by: 1
      },
      {
        id: 3,
        name: 'Feature Request',
        description: 'Requests for new features or improvements',
        status: 'active',
        created_date: '2024-02-15T00:00:00Z',
        created_by: 2,
        updated_date: '2025-08-15T09:00:00Z',
        updated_by: 2
      },
      {
        id: 4,
        name: 'Bug Report',
        description: 'Reports of software bugs and issues',
        status: 'active',
        created_date: '2024-02-20T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-10T16:45:00Z',
        updated_by: 1
      },
      {
        id: 5,
        name: 'General Inquiry',
        description: 'General questions and information requests',
        status: 'inactive',
        created_date: '2024-03-01T00:00:00Z',
        created_by: 2,
        updated_date: '2025-07-30T11:20:00Z',
        updated_by: 3
      }
    ];
  }

  /**
   * โหลดข้อมูล fallback เมื่อ API ล้มเหลว
   */
  private loadFallbackData(): void {
    this.categories = this.getMockCategoryData();
    this.filterCategories();
  }

  /**
   * Filter categories based on search term
   */
  filterCategories(): void {
    this.filteredCategories = this.categories.filter(category => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(category, this.searchTerm.toLowerCase());

      return matchesSearch;
    });

    console.log('Filtered categories:', this.filteredCategories.length, 'of', this.categories.length);
  }

  /**
   * ตรวจสอบว่าตรงกับคำค้นหาหรือไม่
   */
  private matchesSearchTerm(category: CategoryItem, searchTerm: string): boolean {
    const searchableFields = [
      category.name || '',
      category.description || '',
      category.status || ''
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Handle search input change
   */
  onSearchChange(): void {
    this.filterCategories();
  }

  // ============ MODAL METHODS ============

  /**
   * เปิด Modal สำหรับสร้าง Category ใหม่
   */
  createNewCategory(): void {
    console.log('Opening create new category modal');
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  /**
   * ปิด Modal
   */
  onModalClose(): void {
    console.log('Create category modal closed');
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
    this.categoryForm.reset({
      status: 'active'
    });
    this.isSubmitting = false;
    console.log('Category form reset');
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    console.log('Category form submitted');
    console.log('Form valid:', this.categoryForm.valid);
    console.log('Form value:', this.categoryForm.value);
    
    Object.keys(this.categoryForm.controls).forEach(key => {
      const control = this.categoryForm.get(key);
      console.log(`${key}:`, control?.value, control?.valid, control?.errors);
    });

    if (this.categoryForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      console.log('Creating category...');
      
      const formData = this.categoryForm.value;
      
      setTimeout(() => {
        this.onCategoryCreated(formData);
        this.isSubmitting = false;
      }, 1000);
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.categoryForm.controls).forEach(key => {
        const control = this.categoryForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * จัดการการสร้าง Category ใหม่จาก Modal
   */
  onCategoryCreated(categoryData: CreateCategoryForm): void {
    console.log('New category created:', categoryData);
    
    const newCategory: CategoryItem = {
      id: Date.now(),
      name: categoryData.name,
      description: categoryData.description || '',
      status: categoryData.status,
      created_date: new Date().toISOString(),
      created_by: 1,
    };

    this.categories.unshift(newCategory);
    this.filterCategories();
    this.loadCategoryStats();

    this.isCreateModalVisible = false;
    this.showSuccessMessage(`Category "${categoryData.name}" has been created successfully!`);
  }

  /**
   * แสดงข้อความสำเร็จ
   */
  private showSuccessMessage(message: string): void {
    alert(message);
    console.log('Success:', message);
  }

  /**
   * Edit category
   */
  editCategory(categoryId: number): void {
    console.log('Navigating to edit category:', categoryId);
    this.router.navigate(['/settings/category-edit', categoryId]);
  }

  /**
   * Delete category with confirmation
   */
  deleteCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      console.error('Category not found:', categoryId);
      return;
    }

    const confirmMessage = `Are you sure you want to delete category "${category.name}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteCategory(categoryId, category.name);
    }
  }

  /**
   * ลบ category จริงผ่าน API
   */
  private performDeleteCategory(categoryId: number, categoryName: string): void {
    console.log('Deleting category:', { categoryId, categoryName });

    this.isLoading = true;

    setTimeout(() => {
      try {
        this.categories = this.categories.filter(c => c.id !== categoryId);
        this.filterCategories();
        alert(`Category "${categoryName}" has been deleted successfully.`);
        this.isLoading = false;
        this.loadCategoryStats();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert(`Failed to delete category "${categoryName}". Please try again.`);
        this.isLoading = false;
      }
    }, 1000);
  }

  /**
   * รีเฟรชข้อมูล
   */
  refreshData(): void {
    console.log('Refreshing category data...');
    this.loadCategoryData(true);
  }

  /**
   * Permission methods
   */
  canManageCategories(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  canEditCategory(category: CategoryItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  canDeleteCategory(category: CategoryItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  canCreateCategory(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByCategoryId(index: number, category: CategoryItem): number {
    return category.id;
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
   * Get category status display
   */
  getCategoryStatus(category: CategoryItem): string {
    return category.status === 'active' ? 'Active' : 'Inactive';
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
      total: this.categoryStats.total.toLocaleString(),
      active: this.categoryStats.active.toLocaleString(),
      inactive: this.categoryStats.inactive.toLocaleString(),
      newThisMonth: this.categoryStats.newThisMonth.toLocaleString()
    };
  }

  /**
   * ได้รับ permission description สำหรับแสดงผล
   */
  getPermissionRequiredMessage(): string {
    return 'ต้องมีสิทธิ์ "จัดการ category" เพื่อดำเนินการนี้';
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
  onCreateNewCategory(): void {
    if (!this.canCreateCategory()) {
      this.showPermissionDeniedMessage('สร้าง category ใหม่');
      return;
    }
    this.createNewCategory();
  }

  onEditCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!this.canEditCategory(category)) {
      this.showPermissionDeniedMessage('แก้ไข category');
      return;
    }
    this.editCategory(categoryId);
  }

  onDeleteCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!this.canDeleteCategory(category)) {
      this.showPermissionDeniedMessage('ลบ category');
      return;
    }
    this.deleteCategory(categoryId);
  }
}