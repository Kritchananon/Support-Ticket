// ===== Base Category Interface =====
export interface Category {
  id: number;
  name: string;
  description?: string;
  status?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

// ===== Category DDL (Dropdown List) Interface =====
export interface CategoryDDL {
  id: number;
  categoryName?: string; // API à¹ƒà¸«à¸¡à¹ˆ
  categories_name?: string;         // API à¹€à¸à¹ˆà¸² - fallback
  status?: string;
  isenabled?: boolean;
}

// ===== API Request/Response Interfaces =====
export interface CategoryDDLRequest {
  status?: 'active' | 'inactive' | 'all';
}

export interface CategoryDDLResponse {
  code: number;
  message: string;
  data: CategoryDDL[];
  success?: boolean;
}

// ===== Extended Category with Language Support =====
export interface CategoryWithLang extends CategoryDDL {
  categoryLang?: {
    name: string;
    language: string;
  }[];
}

// ===== Category Form Data =====
export interface CategoryFormData {
  id?: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
}

// ===== Category Filter Options =====
export interface CategoryFilterOptions {
  status?: 'active' | 'inactive' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

// ===== Category Selection Event =====
export interface CategorySelectionEvent {
  category: CategoryDDL | null;
  categoryId: number | string;
}

// ===== Category Validation =====
export interface CategoryValidation {
  isValid: boolean;
  errors: {
    name?: string;
    status?: string;
    general?: string;
  };
}

// ===== Helper Types =====
export type CategoryStatus = 'active' | 'inactive' | 'all';
export type CategoryDisplayFormat = 'name-only' | 'with-code' | 'with-status';

// ===== Type Guards =====
export function isCategoryStatus(value: string): value is CategoryStatus {
  return ['active', 'inactive', 'all'].includes(value);
}

// ===== Default Values =====
export const DEFAULT_CATEGORY_DDL_REQUEST: CategoryDDLRequest = {
  status: 'active'
};

export const CATEGORY_STATUS_OPTIONS = [
  { value: 'active', label: 'à¹ƒà¸Šà¹‰à¸‡à¸²à¸™', labelEn: 'Active' },
  { value: 'inactive', label: 'à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¸‡à¸²à¸™', labelEn: 'Inactive' },
  { value: 'all', label: 'à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”', labelEn: 'All' }
] as const;

// ===== Helper Functions =====
export function getCategoryDisplayName(category: CategoryDDL): string {
  return `${category.categoryName}` || `${category.categories_name}`;
}

export function isCategoryActive(category: CategoryDDL): boolean {
  return category.status === 'active' && category.isenabled !== false;
}

export function formatCategoryForDisplay(
  category: CategoryDDL, 
  format: CategoryDisplayFormat = 'name-only'
): string {
  const name = getCategoryDisplayName(category);
  
  switch (format) {
    case 'with-code':
      return `[${category.id}] ${name}`;
    case 'with-status':
      return `${name} (${category.status || 'unknown'})`;
    case 'name-only':
    default:
      return name;
  }
}