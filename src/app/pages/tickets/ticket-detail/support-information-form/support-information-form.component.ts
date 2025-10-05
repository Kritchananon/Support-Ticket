import { Component, OnInit, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// API Services
import {
  ApiService,
  StatusDDLItem,
  StatusDDLResponse
} from '../../../../shared/services/api.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { TicketService } from '../../../../shared/services/ticket.service';

// Business Hours Calculator
import { BusinessHoursCalculator } from '../../../../shared/services/business-hours-calculator.service';

// Models
import {
  SaveSupporterFormData,
  SaveSupporterResponse,
  TICKET_STATUS_IDS,
  canChangeStatus,
  statusIdToActionType,
  actionTypeToStatusId
} from '../../../../shared/models/ticket.model';

import {
  SupporterFormState,
  FileUploadProgress,
  SupporterFormValidation
} from '../../../../shared/models/common.model';

import {
  AssignTicketPayload,
  AssignTicketResponse,
  Role9UsersResponse,
  UserListItem,
  getUserFullName,
} from '../../../../shared/models/user.model';

// Environment
import { environment } from '../../../../../environments/environment';

// ===== Fix Issue Attachment Interfaces =====
interface UploadFixIssueAttachmentResponse {
  success: boolean;
  message: string;
  data: {
    uploaded_files: Array<{
      id: number;
      filename: string;
      original_name: string;
      file_size: number;
      file_url: string;
      extension: string;
    }>;
    total_uploaded: number;
    total_files: number;
    errors?: Array<{
      filename: string;
      error: string;
    }>;
  };
}

// เพิ่ม interface สำหรับ existing attachments
interface ExistingAttachment {
  attachment_id: number;
  path: string;
  filename?: string;
  file_type?: string;
  file_size?: number;
  is_image?: boolean;
  preview_url?: string;
  download_url?: string;
}

// Interfaces
interface ActionDropdownOption {
  value: string;
  label: string;
  statusId: number;
  disabled?: boolean;
}

interface TicketData {
  ticket: {
    id: number;
    ticket_no: string;
    categories_id: number;
    categories_name: string;
    project_id: number;
    project_name: string;
    issue_description: string;
    fix_issue_description: string;
    status_id: number;
    status_name: string;
    close_estimate: string;
    estimate_time: string;
    due_date: string;
    lead_time: string;
    related_ticket_id: number | null;
    change_request: string;
    create_date: string;
    create_by: string;
    update_date: string;
    update_by: string;
    isenabled: boolean;
    priority?: string;
  } | null;
  issue_attachment: Array<{
    attachment_id: number;
    path: string;
    filename?: string;
    file_type?: string;
    file_size?: number;
  }>;
  fix_attachment: Array<{
    attachment_id: number;
    path: string;
    filename?: string;
    file_type?: string;
    file_size?: number;
  }>;
  status_history: Array<{
    status_id: number;
    status_name: string;
    create_date: string;
  }>;
  assign: Array<{
    ticket_no: string;
    assignTo: string;
    assignBy: string;
  }>;
}

@Component({
  selector: 'app-support-information-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './support-information-form.component.html',
  styleUrls: ['./support-information-form.component.css'],
})
export class SupportInformationFormComponent implements OnInit, OnChanges, OnDestroy {
  estimateTime: number = 0;
  leadTime: number = 0;

  // Dependency Injection
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  public ticketService = inject(TicketService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  // API URL
  public apiUrl = environment.apiUrl;

  // Business Hours Calculator
  private businessHoursCalculator: BusinessHoursCalculator;

  // Input Properties
  @Input() ticketData: TicketData | null = null;
  @Input() ticket_no: string = '';
  @Input() isLoadingTicketData: boolean = false;

  // Output Events
  @Output() supporterDataSaved = new EventEmitter<SaveSupporterResponse>();
  @Output() ticketAssigned = new EventEmitter<AssignTicketResponse>();
  @Output() refreshRequired = new EventEmitter<void>();

  // Component State
  isComponentInitialized = false;
  hasTicketDataChanged = false;

  // Form Properties
  supporterForm!: FormGroup;
  supporterFormState: SupporterFormState = {
    isVisible: true,
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null
  };

  // Action Dropdown Properties
  actionDropdownOptions: ActionDropdownOption[] = [];
  statusList: StatusDDLItem[] = [];
  isLoadingActions = false;
  actionError = '';

  // Assignee Properties
  isLoadingAssignees: boolean = false;
  assigneeError: string = '';
  selectedAssigneeId: number | null = null;
  assigneeList: UserListItem[] = [];

  // File Upload Properties
  selectedFiles: File[] = [];
  fileUploadProgress: FileUploadProgress[] = [];
  existingFixAttachments: ExistingAttachment[] = [];
  maxFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB

  // File Preview URLs
  private filePreviewUrls: { [key: string]: string } = {};

  // Form Validation
  supporterFormValidation: SupporterFormValidation = {
    estimate_time: { isValid: true },
    due_date: { isValid: true },
    lead_time: { isValid: true },
    close_estimate: { isValid: true },
    fix_issue_description: { isValid: true },
    related_ticket_id: { isValid: true },
    attachments: { isValid: true }
  };

  // Permission Properties
  canUserSaveSupporter = false;

  // Enhanced Form State Management Properties
  justSaved = false;
  formDataBeforeRefresh: any = null;
  formStateSnapshot: any = null;
  isRefreshing = false;
  private formPersistenceKey = 'support-form-data';
  private lastFormSnapshot: any = null;
  private formChangeSubscription: any = null;

  // ===== Fix Issue Attachment Properties =====
  isUploadingFixAttachment = false;
  fixAttachmentUploadError = '';

  // File Analysis Properties
  attachmentTypes: {
    [key: number]: {
      type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
      extension: string;
      filename: string;
      isLoading?: boolean;
      isAnalyzed?: boolean;
    }
  } = {};

  constructor() {
    this.businessHoursCalculator = new BusinessHoursCalculator();
    this.initializeHolidays();
  }

  private initializeHolidays(): void {
    const holidays2025 = [
      new Date('2025-01-01'),
      new Date('2025-02-12'),
      new Date('2025-04-06'),
      new Date('2025-04-13'),
      new Date('2025-04-14'),
      new Date('2025-04-15'),
      new Date('2025-05-01'),
      new Date('2025-05-05'),
      new Date('2025-05-12'),
      new Date('2025-06-03'),
      new Date('2025-07-10'),
      new Date('2025-07-28'),
      new Date('2025-08-12'),
      new Date('2025-10-13'),
      new Date('2025-10-23'),
      new Date('2025-12-05'),
      new Date('2025-12-10'),
      new Date('2025-12-31'),
    ];

    this.businessHoursCalculator.setHolidays(holidays2025);
    console.log('Initialized holidays:', holidays2025.length, 'days');
  }

  ngOnInit(): void {
    console.log('SupportInformationFormComponent initialized');
    console.log('Initial ticketData:', this.ticketData);
    console.log('Initial isLoadingTicketData:', this.isLoadingTicketData);

    this.initializeSupporterForm();
    this.checkUserPermissions();
    this.loadActionDropdownOptions();
    this.initializeAssigneeList();
    this.restorePersistedFormData();
    this.setupFormPersistence();
    this.setupAutoCalculation();

    this.isComponentInitialized = true;
    console.log('Form component initialization complete');
  }

  ngOnDestroy(): void {
    // Revoke blob URLs
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    if (this.formChangeSubscription) {
      this.formChangeSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('=== NgOnChanges Debug ===');
    console.log('Changes detected:', Object.keys(changes));

    if (changes['ticketData'] && this.isComponentInitialized) {
      const change = changes['ticketData'];
      console.log('TicketData change details:', {
        previousValue: !!change.previousValue?.ticket,
        currentValue: !!change.currentValue?.ticket,
        isFirstChange: change.isFirstChange(),
        justSaved: this.justSaved,
        isRefreshing: this.isRefreshing
      });

      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.hasTicketDataChanged = true;
        this.onTicketDataChanged();

        setTimeout(() => {
          this.isRefreshing = false;
        }, 100);
      }
    }

    if (changes['isLoadingTicketData']) {
      const loadingChange = changes['isLoadingTicketData'];
      console.log('Loading state changed:', {
        from: loadingChange.previousValue,
        to: loadingChange.currentValue
      });

      if (loadingChange.currentValue === true && !this.isRefreshing) {
        this.takeFormSnapshot();
      }
    }

    setTimeout(() => {
      console.log('🔍 Delayed check - ticketData:', this.ticketData);
      console.log('🔍 Delayed check - fix_attachment:', this.ticketData?.fix_attachment);

      if (this.ticketData?.fix_attachment) {
        console.log('✅ Found fix_attachment, loading...');
        this.loadExistingFixAttachments();
      } else {
        console.log('❌ No fix_attachment found');
      }
    }, 500);
  }

  // ===== Fix Issue Attachment Methods =====

  /**
   * อัปโหลดไฟล์แนบ fix issue
   */
  private async uploadFixIssueAttachments(ticketId: number, files: File[]): Promise<boolean> {
    if (!files || files.length === 0) return true;

    try {
      this.isUploadingFixAttachment = true;
      this.fixAttachmentUploadError = '';

      const formData = new FormData();
      formData.append('ticket_id', ticketId.toString());
      files.forEach(file => formData.append('files', file));

      const token = this.authService.getToken();
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      const response = await this.http.patch<UploadFixIssueAttachmentResponse>(
        `${this.apiUrl}/fix_issue/attachment`,
        formData,
        { headers }
      ).toPromise();

      if (response && response.success) {
        console.log('✅ Fix attachments uploaded:', response.data.total_uploaded, 'files');

        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Upload errors:', response.data.errors);
        }

        return true;
      } else {
        this.fixAttachmentUploadError = response?.message || 'ไม่สามารถอัปโหลดไฟล์ได้';
        return false;
      }

    } catch (error: any) {
      console.error('Error uploading fix attachments:', error);
      this.fixAttachmentUploadError = error?.error?.message || 'เกิดข้อผิดพลาดในการอัปโหลด';
      return false;

    } finally {
      this.isUploadingFixAttachment = false;
    }
  }

  /**
   * โหลด existing attachments และวิเคราะห์ไฟล์
   */
  private loadExistingFixAttachments(): void {
    if (!this.ticketData?.fix_attachment) {
      this.existingFixAttachments = [];
      return;
    }

    console.log('=== Fix Attachment Data ===');
    console.log('API URL:', this.apiUrl);

    this.existingFixAttachments = this.ticketData.fix_attachment.map(att => {
      console.log('Raw attachment:', att);

      // วิธีที่ 1: เช็คจาก extension
      const extension = att.filename ?
        att.filename.split('.').pop()?.toLowerCase() :
        att.path.split('.').pop()?.toLowerCase();

      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      let isImage = imageExtensions.includes(extension || '');

      // ✅ วิธีที่ 2: ถ้าไม่มี extension ให้เช็คจาก file_type
      if (!isImage && att.file_type) {
        isImage = att.file_type.toLowerCase().includes('image');
      }

      // ✅ วิธีที่ 3: ถ้า path มี /images/ ก็น่าจะเป็นรูปภาพ
      if (!isImage && att.path) {
        isImage = att.path.includes('/images/');
      }

      let previewUrl: string | undefined = undefined;
      if (isImage) {
        if (att.path.startsWith('http://') || att.path.startsWith('https://')) {
          previewUrl = att.path;
        } else {
          previewUrl = `${this.apiUrl}${att.path.startsWith('/') ? '' : '/'}${att.path}`;
        }
      }

      const mappedAttachment = {
        ...att,
        is_image: isImage,
        preview_url: previewUrl
      };

      console.log('Mapped attachment:', mappedAttachment);

      return mappedAttachment;
    });

    console.log('Loaded existing fix attachments:', this.existingFixAttachments);

    setTimeout(() => {
      this.analyzeAllExistingAttachments();
    }, 100);
  }

  /**
   * ได้รับ URL สำหรับดาวน์โหลด attachment
   */
  getAttachmentDownloadUrl(attachment: any): string {
    if (!attachment || !attachment.path) {
      return '#';
    }

    const path = attachment.path;

    // ถ้า path เป็น full URL อยู่แล้ว (ขึ้นต้นด้วย http:// หรือ https://)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // ถ้า path เป็น data URL
    if (path.startsWith('data:')) {
      return path;
    }

    // ถ้าเป็น relative path ให้เพิ่ม apiUrl
    return `${this.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * วิเคราะห์ไฟล์ existing attachments ทั้งหมด
   */
  private analyzeAllExistingAttachments(): void {
    if (!this.existingFixAttachments || this.existingFixAttachments.length === 0) {
      console.log('No existing attachments to analyze');
      return;
    }

    console.log('🔍 Starting analysis of existing attachments:', this.existingFixAttachments.length);

    this.existingFixAttachments.forEach((attachment, index) => {
      console.log(`🔍 Analyzing attachment ${index + 1}:`, {
        id: attachment.attachment_id,
        path: attachment.path,
        filename: attachment.filename
      });

      this.analyzeExistingAttachment(attachment);
    });
  }

  /**
   * วิเคราะห์ไฟล์ existing attachment แต่ละไฟล์
   */
  private async analyzeExistingAttachment(attachment: any): Promise<void> {
    if (!attachment || !attachment.attachment_id) {
      console.warn('Invalid attachment data:', attachment);
      return;
    }

    const attachmentId = attachment.attachment_id;

    if (this.attachmentTypes[attachmentId]?.isAnalyzed) {
      console.log('✅ Attachment already analyzed:', attachmentId);
      return;
    }

    this.attachmentTypes[attachmentId] = {
      type: 'file',
      extension: '',
      filename: 'Loading...',
      isLoading: true,
      isAnalyzed: false
    };

    try {
      // ✅ เรียก API เพื่อดึงข้อมูลไฟล์จริง
      const response = await fetch(attachment.path, { method: 'HEAD' });
      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type') || '';

      let realFilename = `attachment_${attachmentId}`;

      // ดึงชื่อไฟล์จริงจาก Content-Disposition header
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          realFilename = filenameMatch[1].replace(/['"]/g, '');
          realFilename = decodeURIComponent(realFilename);
        }
      }

      const extension = this.getFileExtensionHelper(realFilename) ||
        this.getExtensionFromMimeType(contentType);

      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByMimeType(contentType),
        extension: extension,
        filename: realFilename,
        isLoading: false,
        isAnalyzed: true
      };

      console.log('✅ File analyzed from HTTP headers:', {
        id: attachmentId,
        contentType,
        filename: realFilename,
        category: this.attachmentTypes[attachmentId].type
      });

    } catch (error) {
      console.error('Error analyzing attachment:', error);

      // Fallback
      this.attachmentTypes[attachmentId] = {
        type: 'file',
        extension: '',
        filename: `attachment_${attachmentId}`,
        isLoading: false,
        isAnalyzed: true
      };
    }
  }

  /**
   * แปลง MIME type เป็น file extension
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'rar'
    };

    return mimeMap[mimeType.toLowerCase()] || '';
  }

  /**
   * กำหนดประเภทไฟล์จาก MIME type
   */
  private determineFileCategoryByMimeType(mimeType: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = mimeType.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'excel';
    if (type.includes('word') || type.includes('document')) return 'word';
    if (type.startsWith('text/')) return 'text';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return 'archive';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';

    return 'file';
  }

  /**
   * แยกชื่อไฟล์จาก path
   */
  private extractFilenameFromPath(path: string): string {
    if (!path || typeof path !== 'string') {
      console.warn('Invalid path provided:', path);
      return 'unknown';
    }

    try {
      if (path.startsWith('data:')) {
        return 'data_file';
      }

      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      const cleanFilename = lastPart.split('?')[0];

      try {
        return decodeURIComponent(cleanFilename) || 'unknown';
      } catch {
        return cleanFilename || 'unknown';
      }
    } catch (error) {
      console.warn('Error extracting filename from path:', path, error);
      return 'unknown';
    }
  }

  /**
   * ได้รับ file extension
   */
  private getFileExtensionHelper(filename: string): string {
    if (!filename || filename === 'unknown' || typeof filename !== 'string') {
      return '';
    }

    try {
      const parts = filename.split('.');
      if (parts.length > 1) {
        const extension = parts[parts.length - 1].toLowerCase();
        return /^[a-z0-9]+$/i.test(extension) ? extension : '';
      }
      return '';
    } catch (error) {
      console.warn('Error getting file extension:', filename, error);
      return '';
    }
  }

  private getFileTypeFromFilename(filename: string): string {
    const extension = this.getFileExtensionHelper(filename);
    return extension || 'unknown';
  }

  /**
   * กำหนดประเภทไฟล์
   */
  private determineFileCategory(fileType: string, filename: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = (fileType || '').toLowerCase();
    const ext = this.getFileExtensionHelper(filename).toLowerCase();

    // Image files
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'].includes(ext)) {
      return 'image';
    }

    // PDF files
    if (type.includes('pdf') || ext === 'pdf') {
      return 'pdf';
    }

    // Excel files
    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      return 'excel';
    }

    // Word files
    if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      return 'word';
    }

    // Text files
    if (type.includes('text') || ['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'csv'].includes(ext)) {
      return 'text';
    }

    // Archive files
    if (type.includes('archive') || type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return 'archive';
    }

    // Video files
    if (type.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
      return 'video';
    }

    // Audio files
    if (type.includes('audio') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return 'audio';
    }

    return 'file';
  }

  private determineFileCategoryByExtension(extension: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const ext = extension.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'].includes(ext)) {
      return 'image';
    }

    if (ext === 'pdf') {
      return 'pdf';
    }

    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      return 'excel';
    }

    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      return 'word';
    }

    if (['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }

    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return 'archive';
    }

    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
      return 'video';
    }

    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return 'audio';
    }

    return 'file';
  }

  /**
   * ตรวจสอบว่า existing attachment เป็นไฟล์รูปภาพหรือไม่
   */
  isExistingAttachmentImage(attachment: any): boolean {
    if (!attachment) {
      return false;
    }

    const attachmentId = attachment.attachment_id;

    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].type === 'image';
    }

    // Fallback
    if (attachment.path && attachment.path.startsWith('data:image/')) {
      return true;
    }

    const filename = attachment.filename || '';
    const fileType = attachment.file_type || '';

    const isImageByType = fileType.toLowerCase().includes('image');
    const isImageByExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|ico)$/i.test(filename);

    return isImageByType || isImageByExtension;
  }

  /**
 * ดึง preview URL สำหรับ existing attachment
 */
  getExistingAttachmentPreviewUrl(attachment: any): string {
    if (!attachment) return '';

    if (attachment.preview_url) {
      return attachment.preview_url;
    }

    const path = attachment.path;
    if (!path) return '';

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    return `${this.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * ได้รับ icon สำหรับ existing attachment
   */
  getExistingAttachmentIcon(attachment: any): string {
    if (!attachment) return 'bi-file-earmark-fill';

    const attachmentId = attachment.attachment_id;

    if (attachmentId && this.attachmentTypes[attachmentId]) {
      const fileInfo = this.attachmentTypes[attachmentId];

      switch (fileInfo.type) {
        case 'image': return 'bi-image-fill';
        case 'pdf': return 'bi-file-earmark-pdf-fill';
        case 'excel': return 'bi-file-earmark-excel-fill';
        case 'word': return 'bi-file-earmark-word-fill';
        case 'text': return 'bi-file-earmark-text-fill';
        case 'archive': return 'bi-file-earmark-zip-fill';
        case 'video': return 'bi-file-earmark-play-fill';
        case 'audio': return 'bi-file-earmark-music-fill';
        default: return 'bi-file-earmark-fill';
      }
    }

    // Fallback
    const filename = attachment.filename || '';
    const fileType = attachment.file_type || '';

    if (fileType.includes('image') || filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
      return 'bi-image-fill';
    }

    if (fileType.includes('pdf') || filename.match(/\.pdf$/i)) {
      return 'bi-file-earmark-pdf-fill';
    }

    if (fileType.includes('excel') || fileType.includes('spreadsheet') || filename.match(/\.(xls|xlsx|csv)$/i)) {
      return 'bi-file-earmark-excel-fill';
    }

    if (fileType.includes('word') || fileType.includes('document') || filename.match(/\.(doc|docx|rtf)$/i)) {
      return 'bi-file-earmark-word-fill';
    }

    if (fileType.includes('text') || filename.match(/\.(txt|log|md|json|xml)$/i)) {
      return 'bi-file-earmark-text-fill';
    }

    return 'bi-file-earmark-fill';
  }

  /**
   * ได้รับชื่อไฟล์ที่แสดงสำหรับ existing attachment
   */
  getExistingAttachmentDisplayName(attachment: any): string {
    if (!attachment) return 'Unknown file';

    const attachmentId = attachment.attachment_id;

    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].filename;
    }

    return attachment.filename || this.extractFilenameFromPath(attachment.path) || 'Unknown file';
  }

  /**
   * ได้รับข้อมูลไฟล์สำหรับ existing attachment
   */
  getExistingAttachmentFileInfo(attachmentId: number): {
    type: string;
    extension: string;
    filename: string;
    isLoading: boolean;
    icon: string;
  } {
    const fileInfo = this.attachmentTypes[attachmentId];

    if (fileInfo) {
      return {
        type: fileInfo.type,
        extension: fileInfo.extension,
        filename: fileInfo.filename,
        isLoading: fileInfo.isLoading || false,
        icon: this.getExistingAttachmentIcon({ attachment_id: attachmentId })
      };
    }

    return {
      type: 'unknown',
      extension: '',
      filename: 'Unknown file',
      isLoading: false,
      icon: 'bi-file-earmark-fill'
    };
  }

  /**
   * Format file size สำหรับ existing attachments
   */
  formatExistingAttachmentSize(attachment: any): string {
    if (attachment && attachment.file_size) {
      return this.formatFileSize(attachment.file_size);
    }
    return '';
  }

  /**
   * จัดการข้อผิดพลาดการโหลดรูปภาพ
   */
  onExistingAttachmentImageError(attachmentId: number): void {
    console.log(`❌ Image failed to load for existing attachment ${attachmentId}`);

    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
      this.attachmentTypes[attachmentId].isAnalyzed = true;
      console.log(`📄 Changed attachment ${attachmentId} from image to file type`);
    }
  }

  /**
   * จัดการการโหลดรูปภาพสำเร็จ
   */
  onExistingAttachmentImageLoad(attachmentId: number): void {
    console.log(`✅ Image loaded successfully for existing attachment ${attachmentId}`);

    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
      this.attachmentTypes[attachmentId].isAnalyzed = true;
      console.log(`✅ Confirmed attachment ${attachmentId} as image type`);
    }
  }

  /**
   * ได้รับสีตามประเภทไฟล์
   */
  getFileTypeColor(fileType: string): string {
    switch (fileType) {
      case 'image': return '#6f42c1'; // Purple
      case 'pdf': return '#dc3545';   // Red
      case 'excel': return '#198754'; // Green
      case 'word': return '#0d6efd';  // Blue
      case 'text': return '#6c757d';  // Gray
      case 'archive': return '#ffc107'; // Yellow
      case 'video': return '#e83e8c'; // Pink
      case 'audio': return '#fd7e14'; // Orange
      default: return '#6c757d';      // Gray
    }
  }

  /**
   * สร้าง preview URL สำหรับไฟล์ใหม่
   */
  getFilePreview(file: File): string {
    if (!this.filePreviewUrls[file.name]) {
      if (this.ticketService.isImageFile(file)) {
        this.filePreviewUrls[file.name] = URL.createObjectURL(file);
      }
    }
    return this.filePreviewUrls[file.name] || '';
  }

  /**
   * ได้รับ file type จาก extension
   */
  getFileTypeFromExtension(filename: string): string {
    const extension = this.getFileExtensionHelper(filename).toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      return 'image';
    }
    if (extension === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(extension)) return 'excel';
    if (['doc', 'docx', 'rtf'].includes(extension)) return 'word';
    if (['txt', 'log', 'md', 'json'].includes(extension)) return 'text';
    if (['zip', 'rar', '7z'].includes(extension)) return 'archive';

    return 'file';
  }

  // ✅ trackBy function
  trackByAttachment(index: number, attachment: ExistingAttachment): number {
    return attachment.attachment_id;
  }

  trackByFile(index: number, file: File): string {
    return file.name + file.size + file.lastModified;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * ตรวจสอบไฟล์ก่อนอัปโหลด
   */
  private validateFixIssueFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'image/webp', 'image/bmp', 'image/tiff',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'application/json',
      'application/zip', 'application/x-rar-compressed'
    ];

    files.forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: ประเภทไฟล์ไม่รองรับ`);
      }
      if (file.size > maxSize) {
        errors.push(`${file.name}: ขนาดเกิน 10MB`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  // ===== Existing Methods Continue Below ===== 

  private setupAutoCalculation(): void {
    this.supporterForm.get('close_estimate')?.valueChanges.subscribe(() => {
      this.calculateEstimateTimeFromForm();
    });

    this.supporterForm.get('due_date')?.valueChanges.subscribe(() => {
      this.calculateLeadTimeFromForm();
    });
  }

  private calculateEstimateTimeFromForm(): void {
    const closeEstimate = this.supporterForm.get('close_estimate')?.value;

    if (!closeEstimate) {
      this.estimateTime = 0;
      return;
    }

    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) {
      console.warn('Cannot calculate estimate time: No open ticket date found');
      this.estimateTime = 0;
      return;
    }

    try {
      const closeEstimateDate = new Date(closeEstimate);
      this.estimateTime = this.businessHoursCalculator.calculateEstimateTime(
        openTicketDate,
        closeEstimateDate
      );

      console.log('Estimate Time calculated:', {
        from: openTicketDate,
        to: closeEstimateDate,
        hours: this.estimateTime
      });

      this.supporterForm.patchValue({
        estimate_time: Math.round(this.estimateTime)
      }, { emitEvent: false });

    } catch (error) {
      console.error('Error calculating estimate time:', error);
      this.estimateTime = 0;
    }
  }

  private calculateLeadTimeFromForm(): void {
    const dueDate = this.supporterForm.get('due_date')?.value;

    if (!dueDate) {
      this.leadTime = 0;
      return;
    }

    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) {
      console.warn('Cannot calculate lead time: No open ticket date found');
      this.leadTime = 0;
      return;
    }

    try {
      const dueDateObj = new Date(dueDate);
      this.leadTime = this.businessHoursCalculator.calculateLeadTime(
        openTicketDate,
        dueDateObj
      );

      console.log('Lead Time calculated:', {
        from: openTicketDate,
        to: dueDateObj,
        hours: this.leadTime
      });

      this.supporterForm.patchValue({
        lead_time: Math.round(this.leadTime)
      }, { emitEvent: false });

    } catch (error) {
      console.error('Error calculating lead time:', error);
      this.leadTime = 0;
    }
  }

  private getOpenTicketDate(): Date | null {
    if (!this.ticketData?.status_history) {
      return null;
    }

    const openTicketHistory = this.ticketData.status_history.find(
      history => history.status_id === 2
    );

    if (!openTicketHistory?.create_date) {
      console.warn('Open ticket date not found in status history');
      return null;
    }

    try {
      return new Date(openTicketHistory.create_date);
    } catch (error) {
      console.error('Error parsing open ticket date:', error);
      return null;
    }
  }

  private setupFormPersistence(): void {
    let saveTimeout: any = null;

    this.formChangeSubscription = this.supporterForm.valueChanges.subscribe((formValue) => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(() => {
        this.persistFormData();
      }, 1000);
    });
  }

  private persistFormData(): void {
    if (!this.hasFormData()) {
      localStorage.removeItem(this.formPersistenceKey);
      return;
    }

    try {
      const dataToSave = {
        formValue: { ...this.supporterForm.value },
        selectedAssigneeId: this.selectedAssigneeId,
        selectedFiles: this.selectedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        })),
        timestamp: Date.now(),
        ticketNo: this.ticket_no
      };

      localStorage.setItem(this.formPersistenceKey, JSON.stringify(dataToSave));
      this.lastFormSnapshot = dataToSave;

      console.log('Form data persisted to localStorage:', {
        hasData: this.hasFormData(),
        ticketNo: this.ticket_no,
        timestamp: new Date(dataToSave.timestamp).toLocaleTimeString()
      });
    } catch (error) {
      console.warn('Failed to persist form data:', error);
    }
  }

  private restorePersistedFormData(): void {
    try {
      const savedData = localStorage.getItem(this.formPersistenceKey);
      if (!savedData) {
        console.log('No persisted form data found');
        return;
      }

      const parsedData = JSON.parse(savedData);

      const age = Date.now() - parsedData.timestamp;
      const maxAge = 60 * 60 * 1000;

      if (age > maxAge) {
        console.log('Persisted data too old, removing');
        localStorage.removeItem(this.formPersistenceKey);
        return;
      }

      if (parsedData.ticketNo && this.ticket_no && parsedData.ticketNo !== this.ticket_no) {
        console.log('Persisted data for different ticket, ignoring');
        return;
      }

      if (parsedData.formValue) {
        console.log('Restoring persisted form data:', parsedData.formValue);
        this.supporterForm.patchValue(parsedData.formValue);
      }

      if (parsedData.selectedAssigneeId) {
        this.selectedAssigneeId = parsedData.selectedAssigneeId;
      }

      if (parsedData.selectedFiles && parsedData.selectedFiles.length > 0) {
        console.log('Previous files were selected (need to re-select):',
          parsedData.selectedFiles.map((f: any) => f.name));
      }

      console.log('Form data restored successfully');
    } catch (error) {
      console.warn('Failed to restore persisted form data:', error);
      localStorage.removeItem(this.formPersistenceKey);
    }
  }

  private takeFormSnapshot(): void {
    if (this.supporterForm && this.hasFormData()) {
      this.formStateSnapshot = {
        formValue: { ...this.supporterForm.value },
        selectedAssigneeId: this.selectedAssigneeId,
        selectedFiles: [...this.selectedFiles],
        fileUploadProgress: [...this.fileUploadProgress],
        timestamp: Date.now()
      };

      console.log('Form snapshot taken:', {
        hasData: this.hasFormData(),
        formValue: this.formStateSnapshot.formValue,
        fileCount: this.formStateSnapshot.selectedFiles.length
      });
    }
  }

  private restoreFormSnapshot(): boolean {
    if (!this.formStateSnapshot) {
      console.log('No form snapshot to restore');
      return false;
    }

    const age = Date.now() - this.formStateSnapshot.timestamp;
    const maxAge = 30000;

    if (age > maxAge) {
      console.log('Form snapshot too old, discarding');
      this.formStateSnapshot = null;
      return false;
    }

    console.log('Restoring form snapshot:', this.formStateSnapshot.formValue);

    this.supporterForm.patchValue(this.formStateSnapshot.formValue);
    this.selectedAssigneeId = this.formStateSnapshot.selectedAssigneeId;

    if (this.formStateSnapshot.selectedFiles.length > 0) {
      this.selectedFiles = [...this.formStateSnapshot.selectedFiles];
      this.fileUploadProgress = [...this.formStateSnapshot.fileUploadProgress];
    }

    this.formStateSnapshot = null;
    return true;
  }

  private onTicketDataChanged(): void {
    console.log('🔍 onTicketDataChanged called');
    console.log('=== OnTicketDataChanged Debug ===');
    console.log('State:', {
      hasTicket: !!this.ticketData?.ticket,
      justSaved: this.justSaved,
      hasPersistedData: !!localStorage.getItem(this.formPersistenceKey),
      currentFormData: this.hasFormData()
    });

    this.supporterFormState.error = null;
    if (!this.justSaved) {
      this.supporterFormState.successMessage = null;
    }

    this.loadExistingFixAttachments();

    if (this.ticketData?.ticket && this.statusList.length > 0) {
      this.buildActionDropdownOptions();
    }

    this.calculateRealtime();

    if (this.ticketData?.ticket) {
      if (this.justSaved) {
        this.updateFormAfterSave();
      } else if (this.formStateSnapshot && !this.hasFormData()) {
        console.log('Restoring from snapshot');
        this.restoreFormSnapshot();
      } else if (!this.hasFormData()) {
        this.restorePersistedFormData();
        if (!this.hasFormData()) {
          console.log('Loading from ticket data');
          this.updateFormWithTicketData();
        }
      } else {
        console.log('Keeping current form data');
      }
    }

    if (this.justSaved) {
      setTimeout(() => {
        this.justSaved = false;
        this.formDataBeforeRefresh = null;
      }, 150);
    }
  }

  private updateFormAfterSave(): void {
    if (!this.ticketData?.ticket || !this.formDataBeforeRefresh) {
      this.updateFormWithTicketData();
      return;
    }

    const ticket = this.ticketData.ticket;
    const savedFormData = this.formDataBeforeRefresh;

    console.log('Updating form after save with preserved user data:', savedFormData);

    this.supporterForm.patchValue({
      action: '',
      estimate_time: savedFormData.estimate_time || this.parseNumberField(ticket.estimate_time),
      due_date: savedFormData.due_date || this.formatDateTimeForInput(ticket.due_date),
      lead_time: savedFormData.lead_time || this.parseNumberField(ticket.lead_time),
      close_estimate: savedFormData.close_estimate || this.formatDateTimeForInput(ticket.close_estimate),
      fix_issue_description: savedFormData.fix_issue_description || ticket.fix_issue_description || '',
      related_ticket_id: savedFormData.related_ticket_id || ticket.related_ticket_id || ''
    });

    this.validateSupporterForm();
    this.calculateRealtime();
  }

  private updateFormWithTicketData(): void {
    if (!this.ticketData?.ticket) return;

    const ticket = this.ticketData.ticket;
    const currentFormValue = this.supporterForm.value;

    console.log('Updating form with ticket data:', {
      ticket: {
        estimate_time: ticket.estimate_time,
        due_date: ticket.due_date,
        lead_time: ticket.lead_time,
        close_estimate: ticket.close_estimate,
        fix_issue_description: ticket.fix_issue_description,
        related_ticket_id: ticket.related_ticket_id
      },
      currentForm: currentFormValue,
      justSaved: this.justSaved
    });

    const newFormValue = {
      action: currentFormValue.action || '',
      estimate_time: this.parseNumberField(ticket.estimate_time),
      due_date: this.formatDateTimeForInput(ticket.due_date),
      lead_time: this.parseNumberField(ticket.lead_time),
      close_estimate: this.formatDateTimeForInput(ticket.close_estimate),
      fix_issue_description: ticket.fix_issue_description || '',
      related_ticket_id: ticket.related_ticket_id || ''
    };

    const patchData: any = {};
    Object.keys(newFormValue).forEach(key => {
      if (key === 'action') {
        return;
      }

      const currentValue = currentFormValue[key];
      const newValue = newFormValue[key as keyof typeof newFormValue];

      if (!currentValue || currentValue === '') {
        patchData[key] = newValue;
      }
    });

    if (Object.keys(patchData).length > 0) {
      this.supporterForm.patchValue(patchData);
      console.log('Patched form with:', patchData);
    }

    this.validateSupporterForm();
    this.calculateRealtime();
  }

  private parseNumberField(value: any): number | null {
    if (value === null || value === undefined || value === '' || value === 'null') {
      return null;
    }

    const parsed = typeof value === 'string' ? parseInt(value) : Number(value);
    return isNaN(parsed) ? null : parsed;
  }

  private formatDateTimeForInput(dateString: string | null | undefined): string {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return '';
    }

    try {
      let date: Date;

      if (typeof dateString === 'string') {
        const normalizedDateString = dateString.replace(' ', 'T');
        date = new Date(normalizedDateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '';
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.warn('Error formatting date for input:', dateString, error);
      return '';
    }
  }

  hasFormData(): boolean {
    if (!this.supporterForm) return false;

    const formValue = this.supporterForm.value;

    return !!(
      formValue.action ||
      (formValue.estimate_time !== null && formValue.estimate_time !== '') ||
      formValue.due_date ||
      (formValue.lead_time !== null && formValue.lead_time !== '') ||
      formValue.close_estimate ||
      (formValue.fix_issue_description && formValue.fix_issue_description.trim()) ||
      (formValue.related_ticket_id && formValue.related_ticket_id.trim()) ||
      this.selectedFiles.length > 0 ||
      this.selectedAssigneeId
    );
  }

  clearAllFormData(): void {
    console.log('Clearing all form data');

    localStorage.removeItem(this.formPersistenceKey);

    this.justSaved = false;
    this.formDataBeforeRefresh = null;
    this.formStateSnapshot = null;
    this.isRefreshing = false;
    this.lastFormSnapshot = null;

    this.supporterForm.reset();
    this.selectedFiles = [];
    this.fileUploadProgress = [];
    this.selectedAssigneeId = null;

    this.estimateTime = 0;
    this.leadTime = 0;

    this.supporterFormState.error = null;
    this.supporterFormState.successMessage = null;

    this.supporterFormValidation = {
      estimate_time: { isValid: true },
      due_date: { isValid: true },
      lead_time: { isValid: true },
      close_estimate: { isValid: true },
      fix_issue_description: { isValid: true },
      related_ticket_id: { isValid: true },
      attachments: { isValid: true }
    };

    console.log('Form cleared completely including persisted data');
  }

  refreshForm(): void {
    console.log('Manual form refresh requested');

    if (this.hasFormData()) {
      this.takeFormSnapshot();
    }

    this.refreshRequired.emit();
  }

  manualSaveFormData(): void {
    this.persistFormData();
    console.log('Manual form data save triggered');
  }

  getFormPersistenceStatus(): {
    hasPersistedData: boolean;
    lastSaved: Date | null;
    dataAge: number;
    isValidForCurrentTicket: boolean;
  } {
    try {
      const savedData = localStorage.getItem(this.formPersistenceKey);
      if (!savedData) {
        return {
          hasPersistedData: false,
          lastSaved: null,
          dataAge: 0,
          isValidForCurrentTicket: false
        };
      }

      const parsedData = JSON.parse(savedData);
      const age = Date.now() - parsedData.timestamp;
      const isValid = parsedData.ticketNo === this.ticket_no;

      return {
        hasPersistedData: true,
        lastSaved: new Date(parsedData.timestamp),
        dataAge: Math.floor(age / 1000),
        isValidForCurrentTicket: isValid
      };
    } catch {
      return {
        hasPersistedData: false,
        lastSaved: null,
        dataAge: 0,
        isValidForCurrentTicket: false
      };
    }
  }

  trackByActionOption(index: number, option: ActionDropdownOption): string | number {
    return option.statusId;
  }

  trackByUser(index: number, user: UserListItem): number {
    return user.id;
  }

  debugLog(message: string, data?: any): void {
    console.log(message, data);
  }

  get isJustSaved(): boolean {
    return this.justSaved;
  }

  get debugInfo() {
    return {
      isComponentInitialized: this.isComponentInitialized,
      hasTicketDataChanged: this.hasTicketDataChanged,
      ticketData: !!this.ticketData,
      hasTicket: !!this.ticketData?.ticket,
      ticketId: this.ticketData?.ticket?.id,
      ticketNo: this.ticketData?.ticket?.ticket_no,
      isLoadingTicketData: this.isLoadingTicketData,
      canShowForm: this.canShowSupporterForm(),
      canSave: this.canSaveAll(),
      hasPermission: this.canUserSaveSupporter
    };
  }

  private initializeSupporterForm(): void {
    this.supporterForm = this.fb.group({
      action: ['', [Validators.required]],
      estimate_time: [null, [Validators.min(0), Validators.max(1000)]],
      due_date: [''],
      lead_time: [null, [Validators.min(0), Validators.max(10000)]],
      close_estimate: [''],
      fix_issue_description: ['', [Validators.maxLength(5000)]],
      related_ticket_id: ['']
    });

    this.supporterForm.valueChanges.subscribe(() => {
      this.validateSupporterForm();
    });
  }

  private checkUserPermissions(): void {
    const userPermissions = this.authService.getEffectivePermissions();

    this.canUserSaveSupporter = userPermissions.includes(8) ||
      userPermissions.includes(19) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();

    console.log('User permissions checked:', {
      permissions: userPermissions,
      canSaveSupporter: this.canUserSaveSupporter,
      isAdmin: this.authService.isAdmin(),
      isSupporter: this.authService.isSupporter()
    });
  }

  canEditSupportInformation(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    return userPermissions.includes(8) ||
      userPermissions.includes(19) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();
  }

  canShowSupporterForm(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    const hasRequiredPermission = userPermissions.includes(5) ||
      userPermissions.includes(8) ||
      userPermissions.includes(19);

    const shouldShow = hasRequiredPermission && !this.isLoadingTicketData;

    console.log('canShowSupporterForm debug:', {
      userPermissions,
      hasRequiredPermission,
      isLoadingTicketData: this.isLoadingTicketData,
      shouldShow,
      ticketData: !!this.ticketData,
      hasTicket: !!this.ticketData?.ticket
    });

    return shouldShow;
  }

  canAssignTicket(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    return userPermissions.includes(19) ||
      userPermissions.includes(8) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();
  }

  isFormReady(): boolean {
    return this.isComponentInitialized &&
      !this.isLoadingTicketData &&
      !!this.ticketData?.ticket;
  }

  getFormStatusMessage(): string {
    if (this.isLoadingTicketData) {
      return 'กำลังโหลดข้อมูล ticket...';
    }

    if (!this.ticketData?.ticket) {
      return 'รอข้อมูล ticket';
    }

    if (!this.isComponentInitialized) {
      return 'กำลังเตรียมฟอร์ม...';
    }

    return 'พร้อมใช้งาน';
  }

  private async loadActionDropdownOptions(): Promise<void> {
    console.log('Loading action dropdown options...');
    this.isLoadingActions = true;
    this.actionError = '';

    try {
      const response = await new Promise<StatusDDLResponse>((resolve, reject) => {
        this.apiService.getStatusDDL('th').subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      if (response && response.code === 1 && response.data) {
        this.statusList = response.data;
        this.buildActionDropdownOptions();
        console.log('Action dropdown options loaded:', this.actionDropdownOptions.length, 'options');
      } else {
        console.warn('Invalid response from getStatusDDL:', response);
        this.actionError = response?.message || 'ไม่สามารถโหลดข้อมูล Status ได้';
        this.buildDefaultActionOptions();
      }
    } catch (error) {
      console.error('Error loading action dropdown:', error);
      this.actionError = 'เกิดข้อผิดพลาดในการโหลดข้อมูล Status';
      this.buildDefaultActionOptions();
    } finally {
      this.isLoadingActions = false;
    }
  }

  private buildActionDropdownOptions(): void {
    if (!this.statusList || this.statusList.length === 0) {
      this.buildDefaultActionOptions();
      return;
    }

    const currentStatusId = this.getCurrentStatusId();
    console.log('Building action options for current status:', currentStatusId);

    this.actionDropdownOptions = this.statusList
      .filter(status => {
        const canChange = canChangeStatus(currentStatusId, status.id);
        const isNotCurrent = status.id !== currentStatusId;
        return canChange && isNotCurrent;
      })
      .map(status => ({
        value: status.id.toString(),
        label: status.name,
        statusId: status.id,
        disabled: false
      }));

    this.sortActionOptions();
  }

  private buildDefaultActionOptions(): void {
    console.log('Using default action options');
    this.actionDropdownOptions = [
      { value: '5', label: 'Complete', statusId: 5 },
      { value: '1', label: 'Pending', statusId: 1 },
      { value: '2', label: 'Open Ticket', statusId: 2 },
      { value: '3', label: 'In Progress', statusId: 3 },
      { value: '4', label: 'Resolved', statusId: 4 },
      { value: '6', label: 'Cancel', statusId: 6 }
    ];
  }

  private sortActionOptions(): void {
    const order = [2, 3, 4, 5, 1, 6];
    this.actionDropdownOptions.sort((a, b) => {
      const aIndex = order.indexOf(a.statusId);
      const bIndex = order.indexOf(b.statusId);
      return aIndex - bIndex;
    });
  }

  refreshActionDropdown(): void {
    if (this.statusList && this.statusList.length > 0) {
      this.buildActionDropdownOptions();
    } else {
      this.loadActionDropdownOptions();
    }
  }

  calculateRealtime(): void {
    if (!this.ticketData?.ticket) {
      this.estimateTime = 0;
      this.leadTime = 0;
      return;
    }

    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) {
      console.warn('Cannot calculate real-time: No open ticket date found');
      this.estimateTime = 0;
      this.leadTime = 0;
      return;
    }

    try {
      if (this.ticketData.ticket.close_estimate) {
        const closeEstimateDate = new Date(this.ticketData.ticket.close_estimate);
        this.estimateTime = this.businessHoursCalculator.calculateEstimateTime(
          openTicketDate,
          closeEstimateDate
        );
      } else {
        this.estimateTime = 0;
      }

      if (this.ticketData.ticket.due_date) {
        const dueDateObj = new Date(this.ticketData.ticket.due_date);
        this.leadTime = this.businessHoursCalculator.calculateLeadTime(
          openTicketDate,
          dueDateObj
        );
      } else {
        this.leadTime = 0;
      }

      console.log('Real-time calculations updated:', {
        openTicketDate,
        estimateTime: this.estimateTime,
        leadTime: this.leadTime
      });
    } catch (error) {
      console.error('Error in calculateRealtime:', error);
      this.estimateTime = 0;
      this.leadTime = 0;
    }
  }

  private initializeAssigneeList(): void {
    if (this.canAssignTicket()) {
      this.refreshAssigneeList();
    }
  }

  refreshAssigneeList(): void {
    console.log('Refreshing assignee list...');

    this.isLoadingAssignees = true;
    this.assigneeError = '';
    this.assigneeList = [];
    this.selectedAssigneeId = null;

    this.apiService.getRole9Users().subscribe({
      next: (response: Role9UsersResponse) => {
        if (response && response.users && Array.isArray(response.users)) {
          this.assigneeList = response.users.map(user => ({
            id: user.id,
            username: user.username || user.name || `user_${user.id}`,
            firstname: user.firstname || '',
            lastname: user.lastname || '',
            email: user.email || '',
            isenabled: true,
            full_name: user.name || getUserFullName(user)
          }));

          if (this.assigneeList.length === 0) {
            this.assigneeError = 'ไม่พบรายชื่อผู้รับมอบหมาย';
          }
        } else {
          this.assigneeError = 'รูปแบบข้อมูลจาก API ไม่ถูกต้อง';
        }
      },
      error: (error) => {
        console.error('Error loading assignees:', error);
        this.assigneeError = 'เกิดข้อผิดพลาดในการโหลดรายชื่อผู้รับมอบหมาย';
      },
      complete: () => {
        this.isLoadingAssignees = false;
      }
    });
  }

  isAssigneeDropdownReady(): boolean {
    return !this.isLoadingAssignees &&
      !this.assigneeError &&
      this.assigneeList.length > 0;
  }

  getUserDisplayName(user: UserListItem): string {
    return `${getUserFullName(user)} (${user.id})`;
  }

  getSelectedAssigneeName(): string {
    if (!this.selectedAssigneeId) return '';
    const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
    return selectedUser ? getUserFullName(selectedUser) : '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const validation = this.ticketService.validateFiles(files, this.maxFiles);

    if (!validation.isValid) {
      this.supporterFormState.error = validation.errors.join(', ');
      input.value = '';
      return;
    }

    // ตรวจสอบจำนวนไฟล์รวม
    if (this.selectedFiles.length + validation.validFiles.length > this.maxFiles) {
      this.supporterFormState.error = `สามารถแนบไฟล์ได้สูงสุด ${this.maxFiles} ไฟล์`;
      input.value = '';
      return;
    }

    // Clear previous states for these files
    validation.validFiles.forEach(file => {
      if (this.filePreviewUrls[file.name] && this.filePreviewUrls[file.name].startsWith('blob:')) {
        URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      }
    });

    // สร้าง preview สำหรับไฟล์รูปภาพ
    const imagePromises = validation.validFiles
      .filter(file => this.ticketService.isImageFile(file))
      .map(file =>
        new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              this.filePreviewUrls[file.name] = e.target.result as string;
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(file);
        })
      );

    Promise.all(imagePromises).then(() => {
      this.selectedFiles = [...this.selectedFiles, ...validation.validFiles];
      this.supporterFormState.error = null;

      this.fileUploadProgress = this.selectedFiles.map(file => ({
        filename: file.name,
        progress: 0,
        status: 'pending'
      }));

      console.log('Files selected with previews:', this.selectedFiles.length);
    }).catch(error => {
      console.error('Error processing file selection:', error);
      this.supporterFormState.error = 'เกิดข้อผิดพลาดในการเลือกไฟล์';
    });

    input.value = '';
  }

  removeSelectedFile(index: number): void {
    const file = this.selectedFiles[index];

    // Revoke blob URL if exists
    if (this.filePreviewUrls[file.name] && this.filePreviewUrls[file.name].startsWith('blob:')) {
      URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      delete this.filePreviewUrls[file.name];
    }

    this.selectedFiles.splice(index, 1);
    this.fileUploadProgress.splice(index, 1);

    if (this.selectedFiles.length === 0) {
      this.supporterFormState.error = null;
    }

    console.log('File removed. Remaining files:', this.selectedFiles.length);
  }

  private validateSupporterForm(): void {
    const formValue = this.supporterForm.value;

    this.supporterFormValidation = {
      estimate_time: { isValid: true },
      due_date: { isValid: true },
      lead_time: { isValid: true },
      close_estimate: { isValid: true },
      fix_issue_description: { isValid: true },
      related_ticket_id: { isValid: true },
      attachments: { isValid: true }
    };

    if (formValue.estimate_time !== null && formValue.estimate_time !== '') {
      const estimateTime = parseInt(formValue.estimate_time);
      if (isNaN(estimateTime) || estimateTime < 0 || estimateTime > 1000) {
        this.supporterFormValidation.estimate_time = {
          isValid: false,
          error: 'เวลาประมาณการต้องอยู่ระหว่าง 0-1000 ชั่วโมง'
        };
      }
    }

    if (formValue.lead_time !== null && formValue.lead_time !== '') {
      const leadTime = parseInt(formValue.lead_time);
      if (isNaN(leadTime) || leadTime < 0 || leadTime > 10000) {
        this.supporterFormValidation.lead_time = {
          isValid: false,
          error: 'เวลาที่ใช้จริงต้องอยู่ระหว่าง 0-10000 ชั่วโมง'
        };
      }
    }

    if (formValue.due_date) {
      const dueDate = new Date(formValue.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        this.supporterFormValidation.due_date = {
          isValid: false,
          error: 'วันครบกำหนดต้องไม่เป็นวันที่ผ่านมาแล้ว'
        };
      }
    }

    if (formValue.close_estimate) {
      const closeDate = new Date(formValue.close_estimate);
      const now = new Date();

      if (closeDate < now) {
        this.supporterFormValidation.close_estimate = {
          isValid: false,
          error: 'เวลาประมาณการปิดต้องไม่เป็นเวลาที่ผ่านมาแล้ว'
        };
      }
    }

    if (formValue.fix_issue_description && formValue.fix_issue_description.length > 5000) {
      this.supporterFormValidation.fix_issue_description = {
        isValid: false,
        error: 'รายละเอียดการแก้ไขต้องไม่เกิน 5000 ตัวอักษร'
      };
    }

    if (this.selectedFiles.length > this.maxFiles) {
      this.supporterFormValidation.attachments = {
        isValid: false,
        error: `สามารถแนบไฟล์ได้สูงสุด ${this.maxFiles} ไฟล์`
      };
    }
  }

  hasFieldError(fieldName: keyof SupporterFormValidation): boolean {
    return !this.supporterFormValidation[fieldName].isValid;
  }

  getFieldError(fieldName: keyof SupporterFormValidation): string {
    return this.supporterFormValidation[fieldName].error || '';
  }

  onSaveAll(): void {
    console.log('Unified save started');

    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      this.supporterFormState.error = 'คุณไม่มีสิทธิ์ในการบันทึกข้อมูล';
      return;
    }

    if (!this.ticketData?.ticket) {
      this.supporterFormState.error = 'ไม่พบข้อมูล ticket';
      return;
    }

    const hasSupporterChanges = this.hasSupporterFormChanges();
    const hasAssigneeSelected = this.selectedAssigneeId !== null;

    if (!hasSupporterChanges && !hasAssigneeSelected) {
      this.supporterFormState.error = 'ไม่มีการเปลี่ยนแปลงข้อมูล';
      return;
    }

    this.supporterFormState.isSaving = true;
    this.supporterFormState.error = null;

    this.executeSaveSequence(hasSupporterChanges, hasAssigneeSelected);
  }

  private async executeSaveSequence(hasSupporterChanges: boolean, hasAssigneeSelected: boolean): Promise<void> {
    try {
      let supporterSuccess = false;
      let assignSuccess = false;

      if (hasSupporterChanges && this.canUserSaveSupporter) {
        console.log('Saving supporter data...');
        supporterSuccess = await this.saveSupporterData();
        if (!supporterSuccess) {
          this.supporterFormState.isSaving = false;
          return;
        }
      } else {
        supporterSuccess = true;
      }

      if (hasAssigneeSelected && this.canAssignTicket()) {
        console.log('Assigning ticket...');
        assignSuccess = await this.assignTicketData();
      } else {
        assignSuccess = true;
      }

      this.handleUnifiedSaveResult(supporterSuccess, assignSuccess, hasSupporterChanges, hasAssigneeSelected);

    } catch (error) {
      console.error('Error in save sequence:', error);
      this.supporterFormState.error = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
    } finally {
      this.supporterFormState.isSaving = false;
    }
  }

  private saveSupporterData(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.supporterForm.valid) {
        this.markFormGroupTouched();
        this.supporterFormState.error = 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง';
        resolve(false);
        return;
      }

      const formData = this.createSupporterFormData();

      if (!formData.status_id) {
        this.supporterFormState.error = 'กรุณาเลือก Action ที่ต้องการดำเนินการ';
        resolve(false);
        return;
      }

      // Validate files ก่อน
      if (this.selectedFiles.length > 0) {
        const fileValidation = this.validateFixIssueFiles(this.selectedFiles);
        if (!fileValidation.valid) {
          this.supporterFormState.error = fileValidation.errors.join(', ');
          resolve(false);
          return;
        }
      }

      const validation = this.ticketService.validateSupporterData(formData, this.selectedFiles);
      if (!validation.isValid) {
        this.supporterFormState.error = validation.errors.join(', ');
        resolve(false);
        return;
      }

      // ส่งไฟล์เป็น [] เพราะจะอัปโหลดแยก
      this.ticketService.saveSupporter(this.ticket_no, formData, [])
        .subscribe({
          next: async (response: SaveSupporterResponse) => {
            if (response.success) {
              console.log('✅ Supporter data saved');

              // อัปโหลดไฟล์แนบหลังจากบันทึกสำเร็จ
              let filesUploaded = true;
              if (this.selectedFiles.length > 0 && this.ticketData?.ticket?.id) {
                filesUploaded = await this.uploadFixIssueAttachments(
                  this.ticketData.ticket.id,
                  this.selectedFiles
                );

                if (!filesUploaded) {
                  console.warn('⚠️ Some files failed to upload');
                  this.supporterFormState.successMessage =
                    'บันทึกข้อมูลสำเร็จ แต่มีไฟล์บางไฟล์อัปโหลดไม่สำเร็จ';
                }
              }

              // Emit event พร้อมข้อมูลไฟล์
              this.supporterDataSaved.emit({
                ...response,
              });

              resolve(true);
            } else {
              this.supporterFormState.error = response.message || 'ไม่สามารถบันทึกข้อมูล Supporter ได้';
              resolve(false);
            }
          },
          error: (error) => {
            console.error('Error saving supporter data:', error);
            this.supporterFormState.error = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล Supporter';
            resolve(false);
          }
        });
    });
  }

  private assignTicketData(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.selectedAssigneeId) {
        resolve(false);
        return;
      }

      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      if (!selectedUser) {
        this.assigneeError = 'ผู้รับมอบหมายที่เลือกไม่ถูกต้อง';
        resolve(false);
        return;
      }

      const payload: AssignTicketPayload = {
        ticketNo: this.ticketData!.ticket!.ticket_no,
        assignTo: selectedUser.id
      };

      this.apiService.assignTicket(payload).subscribe({
        next: (response: AssignTicketResponse) => {
          if (response && response.ticket_no && response.assigned_to) {
            this.ticketAssigned.emit(response);
            resolve(true);
          } else {
            this.assigneeError = (response as any)?.message || 'ไม่สามารถมอบหมาย ticket ได้';
            resolve(false);
          }
        },
        error: (error) => {
          console.error('Error assigning ticket:', error);
          this.assigneeError = 'เกิดข้อผิดพลาดในการมอบหมาย ticket';
          resolve(false);
        }
      });
    });
  }

  private handleUnifiedSaveResult(
    supporterSuccess: boolean,
    assignSuccess: boolean,
    hadSupporterChanges: boolean,
    hadAssigneeSelected: boolean
  ): void {
    const allSuccess = (!hadSupporterChanges || supporterSuccess) && (!hadAssigneeSelected || assignSuccess);

    if (allSuccess) {
      console.log('Save successful - preserving form data');

      localStorage.removeItem(this.formPersistenceKey);
      this.lastFormSnapshot = null;

      this.formDataBeforeRefresh = { ...this.supporterForm.value };
      this.justSaved = true;

      this.selectedAssigneeId = null;
      this.selectedFiles = [];
      this.fileUploadProgress = [];

      this.supporterForm.patchValue({ action: '' });

      this.refreshRequired.emit();

      this.supporterFormState.successMessage = 'บันทึกข้อมูลสำเร็จแล้ว';
      setTimeout(() => {
        this.supporterFormState.successMessage = null;
      }, 3000);
    }

    console.log('Unified save completed:', { supporterSuccess, assignSuccess, allSuccess });
  }

  private createSupporterFormData(): SaveSupporterFormData {
    const formValue = this.supporterForm.value;
    const formData: SaveSupporterFormData = {};

    if (formValue.action !== null && formValue.action !== '' && formValue.action !== undefined) {
      const statusId = parseInt(formValue.action.toString());
      if (!isNaN(statusId) && statusId > 0) {
        formData.status_id = statusId;
      }
    }

    if (this.estimateTime > 0) {
      formData.estimate_time = Math.round(this.estimateTime);
    }

    if (formValue.due_date) {
      formData.due_date = formValue.due_date;
    }

    if (this.leadTime > 0) {
      formData.lead_time = Math.round(this.leadTime);
    }

    if (formValue.close_estimate) {
      formData.close_estimate = formValue.close_estimate;
    }

    if (formValue.fix_issue_description) {
      formData.fix_issue_description = formValue.fix_issue_description.trim();
    }

    if (formValue.related_ticket_id) {
      formData.related_ticket_id = formValue.related_ticket_id.trim();
    }

    return formData;
  }

  hasSupporterFormChanges(): boolean {
    if (!this.supporterForm) return false;

    const formValue = this.supporterForm.value;

    if (formValue.action && formValue.action !== '') {
      return true;
    }

    const hasOptionalChanges =
      (formValue.estimate_time && formValue.estimate_time !== '') ||
      (formValue.due_date && formValue.due_date !== '') ||
      (formValue.lead_time && formValue.lead_time !== '') ||
      (formValue.close_estimate && formValue.close_estimate !== '') ||
      (formValue.fix_issue_description && formValue.fix_issue_description.trim() !== '') ||
      (formValue.related_ticket_id && formValue.related_ticket_id.trim() !== '') ||
      (this.selectedFiles && this.selectedFiles.length > 0);

    return hasOptionalChanges;
  }

  canSaveAll(): boolean {
    const hasPermission = this.canUserSaveSupporter || this.canAssignTicket();
    const hasChanges = this.hasSupporterFormChanges() || (this.selectedAssigneeId !== null);
    const notLoading = !this.supporterFormState.isSaving;
    const hasTicket = !!this.ticketData?.ticket;
    const formReady = this.isFormReady();

    return hasPermission && hasChanges && notLoading && hasTicket && formReady;
  }

  getSaveAllButtonText(): string {
    if (this.supporterFormState.isSaving) {
      return 'กำลังบันทึก...';
    }

    if (!this.isFormReady()) {
      return 'รอข้อมูล';
    }

    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      return 'ไม่มีสิทธิ์';
    }

    const hasSupporterChanges = this.hasSupporterFormChanges();
    const hasAssigneeSelected = this.selectedAssigneeId !== null;

    if (hasSupporterChanges && hasAssigneeSelected) {
      return 'Save & Assign';
    } else if (hasSupporterChanges) {
      return 'Save';
    } else if (hasAssigneeSelected) {
      return 'Assign';
    }

    return 'Save';
  }

  getSaveAllButtonClass(): string {
    const baseClass = 'save-btn';

    if (!this.canSaveAll()) {
      return `${baseClass} disabled`;
    }

    if (this.supporterFormState.isSaving) {
      return `${baseClass} loading`;
    }

    return baseClass;
  }

  getSaveAllButtonTooltip(): string {
    if (this.supporterFormState.isSaving) {
      return 'กำลังดำเนินการ...';
    }

    if (!this.isFormReady()) {
      return this.getFormStatusMessage();
    }

    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      return 'คุณไม่มีสิทธิ์ในการบันทึกหรือมอบหมาย';
    }

    if (!this.hasSupporterFormChanges() && this.selectedAssigneeId === null) {
      return 'ไม่มีการเปลี่ยนแปลงข้อมูล';
    }

    const actions = [];
    if (this.hasSupporterFormChanges()) {
      actions.push('บันทึกข้อมูล Supporter');
    }
    if (this.selectedAssigneeId !== null) {
      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      const userName = selectedUser ? getUserFullName(selectedUser) : 'ผู้ใช้ที่เลือก';
      actions.push(`มอบหมายให้กับ ${userName}`);
    }

    return actions.join(' และ ');
  }

  private resetSupporterForm(): void {
    this.supporterForm.patchValue({
      action: ''
    });

    this.selectedFiles = [];
    this.fileUploadProgress = [];

    this.supporterFormValidation = {
      estimate_time: { isValid: true },
      due_date: { isValid: true },
      lead_time: { isValid: true },
      close_estimate: { isValid: true },
      fix_issue_description: { isValid: true },
      related_ticket_id: { isValid: true },
      attachments: { isValid: true }
    };
  }

  private markFormGroupTouched(): void {
    Object.keys(this.supporterForm.controls).forEach(key => {
      this.supporterForm.get(key)?.markAsTouched();
    });
  }

  private getCurrentStatusId(): number {
    return this.ticketData?.ticket?.status_id || 1;
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.hasFormData()) {
      this.persistFormData();

      if (!this.justSaved) {
        $event.returnValue = 'คุณมีข้อมูลที่ยังไม่ได้บันทึก ระบบจะเก็บข้อมูลไว้ให้คุณเมื่อกลับมา';
      }
    }
  }

  getFormDebugInfo() {
    const persistenceStatus = this.getFormPersistenceStatus();

    return {
      hasFormData: this.hasFormData(),
      justSaved: this.justSaved,
      hasSnapshot: !!this.formStateSnapshot,
      hasBeforeRefreshData: !!this.formDataBeforeRefresh,
      isRefreshing: this.isRefreshing,
      formValue: this.supporterForm?.value,
      persistence: persistenceStatus,
      ticketNo: this.ticket_no,
      estimateTime: this.estimateTime,
      leadTime: this.leadTime,
      openTicketDate: this.getOpenTicketDate()
    };
  }
}