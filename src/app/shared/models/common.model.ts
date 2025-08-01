// ===== Generic API Response Interface =====
export interface ApiResponse<T = any> {
  code?: number | string;
  status?: number;
  message: string;
  data: T;
  success?: boolean;
  total?: number;
  page?: number;
  limit?: number;
}

// ===== Generic Dropdown Option Interface =====
export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

// ===== Loading States =====
export interface LoadingState {
  loading: boolean;
  error: string;
  data: any;
  lastUpdated?: Date;
}

// ===== Generic Form Validation =====
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
}

// ===== Pagination Interface =====
export interface PaginationOptions {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
}

// ===== Filter Options Interface =====
export interface FilterOptions {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: any;
}

// ===== Sort Options Interface =====
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// ===== Generic List Response =====
export interface ListResponse<T> {
  data: T[];
  pagination: PaginationOptions;
  filters?: FilterOptions;
  sort?: SortOptions;
}

// ===== User Information Interface =====
export interface UserInfo {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  role?: string;
  permissions?: string[];
}

// ===== Language Support =====
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' }
];

// ===== Status Types =====
export type EntityStatus = 'active' | 'inactive' | 'all';
export type TicketStatus = 'pending' | 'open' | 'in_progress' | 'resolved' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// ===== Priority Options =====
export const PRIORITY_OPTIONS: DropdownOption[] = [
  { value: 'low', label: 'ต่ำ' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'high', label: 'สูง' },
  { value: 'urgent', label: 'เร่งด่วน' }
];

// ===== Status Badge Classes =====
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'badge bg-success',
  inactive: 'badge bg-secondary',
  pending: 'badge bg-warning text-dark',
  open: 'badge bg-info',
  in_progress: 'badge bg-primary',
  resolved: 'badge bg-success',
  completed: 'badge bg-success',
  cancelled: 'badge bg-danger'
};

// ===== File Upload Interface =====
export interface FileUploadResult {
  success: boolean;
  filename?: string;
  originalName?: string;
  size?: number;
  path?: string;
  error?: string;
}

// ===== Attachment Interface =====
export interface Attachment {
  id: number;
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType?: string;
  uploadDate: string;
  uploadedBy?: number;
}

// ===== Breadcrumb Interface =====
export interface BreadcrumbItem {
  label: string;
  url?: string;
  active?: boolean;
  icon?: string;
}

// ===== Toast Notification Interface =====
export interface ToastNotification {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
}

// ===== Modal Configuration =====
export interface ModalConfig {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// ===== Form Field Configuration =====
export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: DropdownOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
}

// ===== PWA Update Interface =====
export interface PWAUpdateEvent {
  type: 'available' | 'installed' | 'failed';
  message: string;
  action?: () => void;
}

// ===== Cache Management =====
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresIn?: number; // milliseconds
}

export interface CacheConfig {
  defaultTTL: number; // milliseconds
  maxSize?: number;
  enableOffline?: boolean;
}

// ===== Error Handling =====
export interface ApplicationError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: number;
  action?: string;
}

// ===== Utility Functions =====
export function createLoadingState<T>(initialData?: T): LoadingState {
  return {
    loading: false,
    error: '',
    data: initialData || null
  };
}

export function createApiResponse<T>(
  data: T, 
  message: string = 'Success', 
  code: number = 1
): ApiResponse<T> {
  return {
    code,
    message,
    data,
    success: code === 1
  };
}

export function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] || 'badge bg-light text-dark';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

// ===== Date Utilities =====
export function formatDate(date: string | Date, locale: string = 'th-TH'): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateTime(date: string | Date, locale: string = 'th-TH'): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===== Storage Keys =====
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  LANGUAGE: 'language',
  THEME: 'theme',
  LAST_ROUTE: 'last_route',
  OFFLINE_DATA: 'offline_data'
} as const;

// ===== Default Values =====
export const DEFAULT_PAGINATION: PaginationOptions = {
  page: 1,
  limit: 20
};

export const DEFAULT_FILTER: FilterOptions = {
  search: '',
  status: 'active'
};

// ===== Application Constants =====
export const APP_CONSTANTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ],
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 5000,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
} as const;