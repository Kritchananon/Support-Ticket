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

// ===== Fix Issue Attachment Interfaces ===== ✅
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
  private ticketService = inject(TicketService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  // API URL
  private apiUrl = environment.apiUrl;

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
  maxFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB

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

  // ===== Fix Issue Attachment Properties ===== ✅
  isUploadingFixAttachment = false;
  fixAttachmentUploadError = '';

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
  }

  // ===== Fix Issue Attachment Methods ===== ✅

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

  trackByFile(index: number, file: File): string {
    return file.name + file.size + file.lastModified;
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
      return;
    }

    this.selectedFiles = validation.validFiles;
    this.supporterFormState.error = null;

    this.fileUploadProgress = this.selectedFiles.map(file => ({
      filename: file.name,
      progress: 0,
      status: 'pending'
    }));
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.fileUploadProgress.splice(index, 1);

    if (this.selectedFiles.length === 0) {
      this.supporterFormState.error = null;
    }
  }

  getFileDisplayInfo(file: File): { name: string; size: string; type: string; icon: string; } {
    return {
      name: file.name,
      size: this.ticketService.formatFileSize(file.size),
      type: file.type.split('/')[1]?.toUpperCase() || 'FILE',
      icon: this.ticketService.getFileIcon(file.name)
    };
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

      // ✅ Validate files ก่อน
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

      // ✅ ส่งไฟล์เป็น [] เพราะจะอัปโหลดแยก
      this.ticketService.saveSupporter(this.ticket_no, formData, [])
        .subscribe({
          next: async (response: SaveSupporterResponse) => {
            if (response.success) {
              console.log('✅ Supporter data saved');
              
              // ✅ อัปโหลดไฟล์แนบหลังจากบันทึกสำเร็จ
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
              
              // ✅ Emit event พร้อมข้อมูลไฟล์
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