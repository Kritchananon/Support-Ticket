import { Component, OnInit, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';

// API Services
import {
  ApiService,
  StatusDDLItem,
  StatusDDLResponse
} from '../../../../shared/services/api.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { TicketService } from '../../../../shared/services/ticket.service';

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

  ngOnInit(): void {
    console.log('SupportInformationFormComponent initialized');
    console.log('Initial ticketData:', this.ticketData);
    console.log('Initial isLoadingTicketData:', this.isLoadingTicketData);

    this.initializeSupporterForm();
    this.checkUserPermissions();
    this.loadActionDropdownOptions();
    this.initializeAssigneeList();

    // โหลดข้อมูลที่เก็บไว้ก่อนหน้า (ถ้ามี)
    this.restorePersistedFormData();

    // ติดตามการเปลี่ยนแปลงฟอร์มและเก็บอัตโนมัติ
    this.setupFormPersistence();

    this.isComponentInitialized = true;
    console.log('Form component initialization complete');
  }

  ngOnDestroy(): void {
    // ทำความสะอาดเมื่อ component ถูกทำลาย
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

      // ป้องกัน multiple processing
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.hasTicketDataChanged = true;
        this.onTicketDataChanged();

        // รีเซ็ตสถานะหลัง delay เล็กน้อย
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

      // เมื่อเริ่มโหลด ให้เก็บสถานะฟอร์มไว้
      if (loadingChange.currentValue === true && !this.isRefreshing) {
        this.takeFormSnapshot();
      }
    }
  }

  // Enhanced Form Persistence System
  private setupFormPersistence(): void {
    // เก็บข้อมูลฟอร์มทุกครั้งที่มีการเปลี่ยนแปลง (แต่ไม่บ่อยเกินไป)
    let saveTimeout: any = null;

    this.formChangeSubscription = this.supporterForm.valueChanges.subscribe((formValue) => {
      // ใช้ debounce เพื่อไม่ให้เก็บข้อมูลบ่อยเกินไป
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(() => {
        this.persistFormData();
      }, 1000); // เก็บหลังจากหยุดพิมพ์ 1 วินาที
    });
  }

  private persistFormData(): void {
    if (!this.hasFormData()) {
      // ถ้าไม่มีข้อมูล ให้ลบข้อมูลที่เก็บไว้
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
        })), // เก็บ metadata ของไฟล์ (ไฟล์จริงเก็บไม่ได้)
        timestamp: Date.now(),
        ticketNo: this.ticket_no // เก็บ ticket_no เพื่อตรวจสอบ
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

      // ตรวจสอบอายุข้อมูล (ไม่เก็บเกิน 1 ชั่วโมง)
      const age = Date.now() - parsedData.timestamp;
      const maxAge = 60 * 60 * 1000; // 1 ชั่วโมง

      if (age > maxAge) {
        console.log('Persisted data too old, removing');
        localStorage.removeItem(this.formPersistenceKey);
        return;
      }

      // ตรวจสอบว่าเป็น ticket เดียวกันหรือไม่
      if (parsedData.ticketNo && this.ticket_no && parsedData.ticketNo !== this.ticket_no) {
        console.log('Persisted data for different ticket, ignoring');
        return;
      }

      // กู้คืนข้อมูล
      if (parsedData.formValue) {
        console.log('Restoring persisted form data:', parsedData.formValue);
        this.supporterForm.patchValue(parsedData.formValue);
      }

      if (parsedData.selectedAssigneeId) {
        this.selectedAssigneeId = parsedData.selectedAssigneeId;
      }

      // สำหรับไฟล์ - แสดงแค่ชื่อว่าเคยเลือกไว้ (แต่ต้องเลือกใหม่)
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
    const maxAge = 30000; // 30 วินาที

    if (age > maxAge) {
      console.log('Form snapshot too old, discarding');
      this.formStateSnapshot = null;
      return false;
    }

    console.log('Restoring form snapshot:', this.formStateSnapshot.formValue);

    // กู้คืนค่าในฟอร์ม
    this.supporterForm.patchValue(this.formStateSnapshot.formValue);

    // กู้คืน assignee
    this.selectedAssigneeId = this.formStateSnapshot.selectedAssigneeId;

    // กู้คืนไฟล์ (ถ้าเป็นไฟล์เดิม)
    if (this.formStateSnapshot.selectedFiles.length > 0) {
      this.selectedFiles = [...this.formStateSnapshot.selectedFiles];
      this.fileUploadProgress = [...this.formStateSnapshot.fileUploadProgress];
    }

    // ล้าง snapshot หลังใช้
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

    // รีเซ็ต form state เมื่อมีข้อมูล ticket ใหม่
    this.supporterFormState.error = null;
    if (!this.justSaved) {
      this.supporterFormState.successMessage = null;
    }

    // รีเฟรช action dropdown
    if (this.ticketData?.ticket && this.statusList.length > 0) {
      this.buildActionDropdownOptions();
    }

    // คำนวณเวลาใหม่
    this.calculateRealtime();

    // จัดการการอัปเดตฟอร์ม
    if (this.ticketData?.ticket) {
      if (this.justSaved) {
        // กรณีเพิ่งบันทึก - ใช้ข้อมูลที่เก็บไว้
        this.updateFormAfterSave();
      } else if (this.formStateSnapshot && !this.hasFormData()) {
        // กรณีมี snapshot และฟอร์มปัจจุบันว่าง - กู้คืน snapshot
        console.log('Restoring from snapshot');
        this.restoreFormSnapshot();
      } else if (!this.hasFormData()) {
        // กรณีฟอร์มว่างและไม่มี snapshot - ลองกู้คืนจาก localStorage หรือโหลดจาก ticket
        this.restorePersistedFormData();
        if (!this.hasFormData()) {
          console.log('Loading from ticket data');
          this.updateFormWithTicketData();
        }
      } else {
        // กรณีอื่นๆ - รักษาข้อมูลที่มีอยู่
        console.log('Keeping current form data');
      }
    }

    // รีเซ็ตสถานะ
    if (this.justSaved) {
      setTimeout(() => {
        this.justSaved = false;
        this.formDataBeforeRefresh = null;
      }, 150);
    }
  }

  private updateFormAfterSave(): void {
    if (!this.ticketData?.ticket || !this.formDataBeforeRefresh) {
      // ถ้าไม่มีข้อมูลที่เก็บไว้ ให้อัปเดตปกติ
      this.updateFormWithTicketData();
      return;
    }

    const ticket = this.ticketData.ticket;
    const savedFormData = this.formDataBeforeRefresh;

    console.log('Updating form after save with preserved user data:', savedFormData);

    // รักษาข้อมูลที่ผู้ใช้กรอกไว้ แต่อัปเดตข้อมูลที่มาจากฐานข้อมูล
    this.supporterForm.patchValue({
      action: '', // เคลียร์ action เสมอ
      // รักษาข้อมูลที่ผู้ใช้กรอก หรือใช้ข้อมูลจาก DB ถ้าไม่มี
      estimate_time: savedFormData.estimate_time || this.parseNumberField(ticket.estimate_time),
      due_date: savedFormData.due_date || this.formatDateTimeForInput(ticket.due_date),
      lead_time: savedFormData.lead_time || this.parseNumberField(ticket.lead_time),
      close_estimate: savedFormData.close_estimate || this.formatDateTimeForInput(ticket.close_estimate),
      fix_issue_description: savedFormData.fix_issue_description || ticket.fix_issue_description || '',
      related_ticket_id: savedFormData.related_ticket_id || ticket.related_ticket_id || ''
    });

    // อัปเดต validation
    this.validateSupporterForm();
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

    // อัปเดตฟอร์มด้วยข้อมูลจาก ticket (ไม่เขียนทับข้อมูลที่ผู้ใช้กรอกอยู่)
    const newFormValue = {
      action: currentFormValue.action || '', // รักษา action ที่เลือกไว้
      estimate_time: this.parseNumberField(ticket.estimate_time),
      due_date: this.formatDateTimeForInput(ticket.due_date),
      lead_time: this.parseNumberField(ticket.lead_time),
      close_estimate: this.formatDateTimeForInput(ticket.close_estimate),
      fix_issue_description: ticket.fix_issue_description || '',
      related_ticket_id: ticket.related_ticket_id || ''
    };

    // เฉพาะ fields ที่ว่างใน form ปัจจุบัน ถึงจะอัปเดต
    const patchData: any = {};
    Object.keys(newFormValue).forEach(key => {
      if (key === 'action') {
        // action ไม่อัปเดต ให้ผู้ใช้เลือกเอง
        return;
      }

      const currentValue = currentFormValue[key];
      const newValue = newFormValue[key as keyof typeof newFormValue];

      // อัปเดตถ้าค่าปัจจุบันว่าง หรือไม่มีค่า
      if (!currentValue || currentValue === '') {
        patchData[key] = newValue;
      }
    });

    if (Object.keys(patchData).length > 0) {
      this.supporterForm.patchValue(patchData);
      console.log('Patched form with:', patchData);
    }

    // อัปเดต validation
    this.validateSupporterForm();
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

      // ลองแปลงแบบต่างๆ
      if (typeof dateString === 'string') {
        // แทนที่ space ด้วย T ถ้าจำเป็น
        const normalizedDateString = dateString.replace(' ', 'T');
        date = new Date(normalizedDateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '';
      }

      // แปลงเป็นเวลาท้องถิ่น
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

    // ลบข้อมูลที่เก็บไว้
    localStorage.removeItem(this.formPersistenceKey);

    // รีเซ็ตทุกสถานะ
    this.justSaved = false;
    this.formDataBeforeRefresh = null;
    this.formStateSnapshot = null;
    this.isRefreshing = false;
    this.lastFormSnapshot = null;

    // รีเซ็ตฟอร์ม
    this.supporterForm.reset();
    this.selectedFiles = [];
    this.fileUploadProgress = [];
    this.selectedAssigneeId = null;

    // รีเซ็ต messages
    this.supporterFormState.error = null;
    this.supporterFormState.successMessage = null;

    // รีเซ็ต validation
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
        dataAge: Math.floor(age / 1000), // วินาที
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

  // TrackBy Functions for Performance
  trackByActionOption(index: number, option: ActionDropdownOption): string | number {
    return option.statusId;
  }

  trackByUser(index: number, user: UserListItem): number {
    return user.id;
  }

  trackByFile(index: number, file: File): string {
    return file.name + file.size + file.lastModified;
  }

  // Debug Helper
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
      ticketNo: this.ticket_no
    };
  }

  // Existing Methods (unchanged but maintaining for compatibility)
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

  // Initialize Methods
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

    // Listen to form changes for real-time validation
    this.supporterForm.valueChanges.subscribe(() => {
      this.validateSupporterForm();
    });
  }

  private checkUserPermissions(): void {
    const userPermissions = this.authService.getEffectivePermissions();

    this.canUserSaveSupporter = userPermissions.includes(8) || // CHANGE_STATUS
      userPermissions.includes(19) || // ASSIGNEE
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

    return userPermissions.includes(8) ||   // CHANGE_STATUS
      userPermissions.includes(19) ||  // ASSIGNEE
      this.authService.isAdmin() ||    // Admin
      this.authService.isSupporter();  // Supporter
  }

  canShowSupporterForm(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    const hasRequiredPermission = userPermissions.includes(5) ||  // VIEW_ALL_TICKETS
      userPermissions.includes(8) ||  // CHANGE_STATUS 
      userPermissions.includes(19);    // ASSIGNEE

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

  // Form State Methods
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

  // Action Dropdown Methods
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

  calculateRealtime() {
    if (this.ticketData?.ticket) {
      try {
        const closeEstimateDate = this.ticketData.ticket.close_estimate ?
          new Date(this.ticketData.ticket.close_estimate) : new Date();
        const dueDateDate = this.ticketData.ticket.due_date ?
          new Date(this.ticketData.ticket.due_date) : new Date();

        this.estimateTime = this.ticketService.calculateEstimateTime(closeEstimateDate);
        this.leadTime = this.ticketService.calculateLeadTime(dueDateDate);

        console.log('Real-time calculations updated:', {
          estimateTime: this.estimateTime,
          leadTime: this.leadTime
        });
      } catch (error) {
        console.error('Error in calculateRealtime:', error);
        this.estimateTime = 0;
        this.leadTime = 0;
      }
    }
  }

  // Assignee Methods
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

  // File Upload Methods
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

  // Form Validation Methods
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

    // Validate estimate_time
    if (formValue.estimate_time !== null && formValue.estimate_time !== '') {
      const estimateTime = parseInt(formValue.estimate_time);
      if (isNaN(estimateTime) || estimateTime < 0 || estimateTime > 1000) {
        this.supporterFormValidation.estimate_time = {
          isValid: false,
          error: 'เวลาประมาณการต้องอยู่ระหว่าง 0-1000 ชั่วโมง'
        };
      }
    }

    // Validate lead_time
    if (formValue.lead_time !== null && formValue.lead_time !== '') {
      const leadTime = parseInt(formValue.lead_time);
      if (isNaN(leadTime) || leadTime < 0 || leadTime > 10000) {
        this.supporterFormValidation.lead_time = {
          isValid: false,
          error: 'เวลาที่ใช้จริงต้องอยู่ระหว่าง 0-10000 ชั่วโมง'
        };
      }
    }

    // Validate due_date
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

    // Validate close_estimate
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

    // Validate fix_issue_description
    if (formValue.fix_issue_description && formValue.fix_issue_description.length > 5000) {
      this.supporterFormValidation.fix_issue_description = {
        isValid: false,
        error: 'รายละเอียดการแก้ไขต้องไม่เกิน 5000 ตัวอักษร'
      };
    }

    // Validate attachments
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

  // Save Methods
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

      // Step 1: Save Supporter Form
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

      // Step 2: Assign Ticket
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

      const validation = this.ticketService.validateSupporterData(formData, this.selectedFiles);
      if (!validation.isValid) {
        this.supporterFormState.error = validation.errors.join(', ');
        resolve(false);
        return;
      }

      this.ticketService.saveSupporter(this.ticket_no, formData, this.selectedFiles)
        .subscribe({
          next: (response: SaveSupporterResponse) => {
            if (response.success) {
              this.supporterDataSaved.emit(response);
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

      // ลบข้อมูลที่เก็บไว้หลังบันทึกสำเร็จ
      localStorage.removeItem(this.formPersistenceKey);
      this.lastFormSnapshot = null;

      // เก็บข้อมูลปัจจุบันสำหรับการแสดงผลหลัง refresh
      this.formDataBeforeRefresh = { ...this.supporterForm.value };
      this.justSaved = true;

      // รีเซ็ตเฉพาะสิ่งที่ต้องรีเซ็ต
      this.selectedAssigneeId = null;
      this.selectedFiles = [];
      this.fileUploadProgress = [];

      // เคลียร์ action เพื่อให้เลือกใหม่
      this.supporterForm.patchValue({ action: '' });

      // ให้ parent refresh
      this.refreshRequired.emit();

      this.supporterFormState.successMessage = 'บันทึกข้อมูลสำเร็จแล้ว';
      setTimeout(() => {
        this.supporterFormState.successMessage = null;
      }, 3000);
    }

    console.log('Unified save completed:', { supporterSuccess, assignSuccess, allSuccess });
  }

  // Helper Methods
  private createSupporterFormData(): SaveSupporterFormData {
    const formValue = this.supporterForm.value;
    const formData: SaveSupporterFormData = {};

    if (formValue.action !== null && formValue.action !== '' && formValue.action !== undefined) {
      const statusId = parseInt(formValue.action.toString());
      if (!isNaN(statusId) && statusId > 0) {
        formData.status_id = statusId;
      }
    }

    if (formValue.estimate_time !== null && formValue.estimate_time !== '') {
      const estimateTime = parseInt(formValue.estimate_time);
      if (!isNaN(estimateTime)) {
        formData.estimate_time = estimateTime;
      }
    }

    if (formValue.due_date) {
      formData.due_date = formValue.due_date;
    }

    if (formValue.lead_time !== null && formValue.lead_time !== '') {
      const leadTime = parseInt(formValue.lead_time);
      if (!isNaN(leadTime)) {
        formData.lead_time = leadTime;
      }
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

  // Browser unload protection
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    // เก็บข้อมูลก่อนปิดหน้า
    if (this.hasFormData()) {
      this.persistFormData();

      if (!this.justSaved) {
        $event.returnValue = 'คุณมีข้อมูลที่ยังไม่ได้บันทึก ระบบจะเก็บข้อมูลไว้ให้คุณเมื่อกลับมา';
      }
    }
  }

    // เพิ่มฟังก์ชันสำหรับ debug ที่สามารถเรียกจาก template ได้
  debugLog(message: string, data?: any): void {
    console.log(message, data);
  }

  // เพิ่ม getter สำหรับตรวจสอบสถานะการบันทึก
  get isJustSaved(): boolean {
    return this.justSaved;
  }
}