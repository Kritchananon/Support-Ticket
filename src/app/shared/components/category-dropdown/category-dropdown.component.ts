import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CategoryService } from '../../services/category.service';
import { CategoryDDL, CategoryStatus, isCategoryStatus } from '../../models/category.model';

@Component({
  selector: 'app-category-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-dropdown.component.html',
  styleUrls: ['./category-dropdown.component.css']
})
export class CategoryDropdownComponent implements OnInit, OnDestroy {
  private categoryService = inject(CategoryService);
  
  @Input() label: string = 'เลือกหมวดหมู่';
  @Input() placeholder: string = '-- เลือกหมวดหมู่ --';
  @Input() selectedCategoryId: number | string = '';
  @Input() status: string = 'active';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showCode: boolean = false;
  @Input() errorText: string = '';
  
  @Output() selectionChange = new EventEmitter<{
    category: CategoryDDL | null, 
    categoryId: number | string
  }>();

  categories: CategoryDDL[] = [];
  loading = false;
  error: string = '';
  hasError = false;
  
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.loading = true;
    this.error = '';
    this.hasError = false;

    // ✅ Fix: Type guard เพื่อให้แน่ใจว่า status เป็น CategoryStatus
    const statusValue: CategoryStatus = isCategoryStatus(this.status) ? this.status : 'active';

    this.categoryService.getCategoriesDDLWithCache({ status: statusValue })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Categories DDL Response:', response);
          if (response.code === 1) {
            this.categories = response.data;
            this.error = '';
          } else {
            this.error = response.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
            this.categories = [];
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading categories:', err);
          
          // ✅ PWA: ลองใช้ cached data ถ้า API ล้มเหลว
          this.categoryService.getCachedCategories(statusValue)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (cachedData) => {
                if (cachedData && cachedData.length > 0) {
                  console.log('✅ Using cached categories:', cachedData.length);
                  this.categories = cachedData;
                  this.error = ''; // Clear error ถ้ามี cached data
                  this.showOfflineIndicator();
                } else {
                  this.error = typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
                  this.categories = [];
                }
                this.loading = false;
              },
              error: () => {
                this.error = typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
                this.categories = [];
                this.loading = false;
              }
            });
        }
      });
  }

  private showOfflineIndicator(): void {
    // แสดง indicator ว่าใช้ cached data
    const offlineMsg = 'ใช้ข้อมูลที่เก็บไว้ (ออฟไลน์)';
    console.log('📱 PWA:', offlineMsg);
    
    // อาจจะแสดง toast notification หรือ indicator ใน UI
    setTimeout(() => {
      const event = new CustomEvent('pwa-offline-data', {
        detail: { component: 'category-dropdown', message: offlineMsg }
      });
      window.dispatchEvent(event);
    }, 100);
  }

  onSelectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const categoryId = target.value;
    let selectedCategory: CategoryDDL | null = null;
    
    if (categoryId) {
      selectedCategory = this.categories.find(c => c.id === +categoryId) || null;
    }

    // Reset validation error when user selects something
    if (categoryId && this.hasError) {
      this.hasError = false;
    }

    this.selectedCategoryId = categoryId;
    this.selectionChange.emit({
      category: selectedCategory,
      categoryId: categoryId
    });
  }

  refresh(): void {
    this.loadCategories();
  }

  // Method สำหรับ validation จากภายนอก
  validate(): boolean {
    if (this.required && !this.selectedCategoryId) {
      this.hasError = true;
      return false;
    }
    this.hasError = false;
    return true;
  }

  getCategoryDisplayName(category: CategoryDDL): string {
    // รองรับทั้ง format จาก API ใหม่ (categoryName) และ API เก่า (name)
    console.log(`category21212121212121 ${category}`);
    
    return `${category.categoryName}` || `${category.categories_name}`;
  }

  // Method สำหรับ reset
  reset(): void {
    this.selectedCategoryId = '';
    this.hasError = false;
    this.selectionChange.emit({
      category: null,
      categoryId: ''
    });
  }

  // Method สำหรับตรวจสอบว่ามี validation error จาก parent component หรือไม่
  get isInvalid(): boolean {
    return this.hasError;
  }
}