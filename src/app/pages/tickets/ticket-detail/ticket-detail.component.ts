import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';

// ✅ Import API Services with satisfaction
import { 
  ApiService, 
  TicketHistoryResponse, 
  TicketStatusHistory,
  GetTicketDataRequest,
  satisfactionResponse
} from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';

// ===== INTERFACES ===== ✅

interface HistoryDisplayItem {
  status_id: number;
  status_name: string;
  create_date: string;
  is_active: boolean;
  is_completed: boolean;
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
  };
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
}

// ===== COMPONENT ===== ✅

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css']
})
export class TicketDetailComponent implements OnInit {
  
  // ===== DEPENDENCY INJECTION ===== ✅
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  // ===== CORE PROPERTIES ===== ✅
  ticketData: TicketData | null = null;
  isLoading = false;
  error = '';
  ticket_no: string = '';

  // ===== SATISFACTION PROPERTIES ===== ✅
  currentRating = 0;
  hoverRating = 0;
  isSavingRating = false;
  hasExistingSatisfaction = false;
  satisfactionMessage = '';
  canEvaluate = false;
  
  // ✅ Modal Properties
  showSuccessModal = false;
  modalTitle = '';
  modalMessage = '';
  modalTicketNo = '';

  // ===== ACTION PROPERTIES ===== ✅
  isUpdating = false;
  isDeleting = false;
  isEditing = false;

  // ===== HISTORY PROPERTIES ===== ✅
  ticketHistory: TicketStatusHistory[] = [];
  displayHistory: HistoryDisplayItem[] = [];
  isLoadingHistory = false;

  // ===== STATUS PROPERTIES ===== ✅
  currentStatusInfo: {
    status_id: number;
    status_name: string;
    language_id: string;
  } | null = null;
  isLoadingStatus = false;
  statusError = '';
  statusCacheLoaded = false;
  isLoadingStatuses = false;
  statusCacheError = '';

  // ===== ATTACHMENT PROPERTIES ===== ✅
  attachmentTypes: { [key: number]: {
    type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
    extension: string;
    filename: string;
    isLoading?: boolean;
  } } = {};

  // ===== CONSTANTS ===== ✅
  private readonly STATUS_WORKFLOW = [
    { id: 1, name: 'Created', icon: 'bi-plus-circle' },
    { id: 2, name: 'Open Ticket', icon: 'bi-clock' },
    { id: 3, name: 'In Progress', icon: 'bi-play-circle' },
    { id: 4, name: 'Resolved', icon: 'bi-clipboard-check' },
    { id: 5, name: 'Completed', icon: 'bi-check-circle' },
    { id: 6, name: 'Cancel', icon: 'bi-x-circle' }
  ];

  // ===== LIFECYCLE ===== ✅

  ngOnInit(): void {
    this.ticket_no = this.route.snapshot.params['ticket_no'];
    
    if (this.ticket_no) {
      this.loadStatusCache();
      this.loadTicketDetail();
    } else {
      this.router.navigate(['/tickets']);
    }
  }

  // ===== INITIALIZATION METHODS ===== ✅

  private loadStatusCache(): void {
    console.log('=== Loading Status Cache ===');
    
    if (this.apiService.isStatusCacheLoaded()) {
      this.statusCacheLoaded = true;
      console.log('✅ Status cache already loaded');
      return;
    }

    this.isLoadingStatuses = true;
    this.statusCacheError = '';

    this.apiService.loadAndCacheStatuses().subscribe({
      next: (success) => {
        if (success) {
          this.statusCacheLoaded = true;
          console.log('✅ Status cache loaded successfully');
          
          if (this.ticketData?.ticket) {
            this.updateStatusFromCache();
          }
        } else {
          console.warn('Status cache loading failed, using defaults');
          this.statusCacheError = 'ไม่สามารถโหลดข้อมูลสถานะได้';
        }
        this.isLoadingStatuses = false;
      },
      error: (error) => {
        console.error('❌ Error loading status cache:', error);
        this.statusCacheError = 'เกิดข้อผิดพลาดในการโหลดสถานะ';
        this.isLoadingStatuses = false;
      }
    });
  }

  private updateStatusFromCache(): void {
    if (!this.ticketData?.ticket || !this.statusCacheLoaded) return;

    const statusId = this.ticketData.ticket.status_id;
    const statusName = this.apiService.getCachedStatusName(statusId);
    
    this.currentStatusInfo = {
      status_id: statusId,
      status_name: statusName,
      language_id: 'th'
    };
    
    this.ticketData.ticket.status_name = statusName;
    this.buildDisplayHistory();
    this.updateEvaluationStatus();
    
    console.log('✅ Status updated from cache:', {
      statusId,
      statusName,
      canEvaluate: this.canEvaluate,
      currentStatusInfo: this.currentStatusInfo
    });
  }

  private async loadTicketDetail(): Promise<void> {
    console.log('=== loadTicketDetail START ===');
    
    this.isLoading = true;
    this.error = '';

    try {
      await this.getTicketByTicketNo(this.ticket_no);
      
      if (!this.ticketData?.ticket) {
        this.error = 'ไม่สามารถโหลดข้อมูล ticket ได้';
        return;
      }

      this.useTicketDataStatus();
      await this.loadTicketHistory();
      
      // ✅ โหลดข้อมูลการประเมินเดิม (ถ้ามี)
      this.loadExistingSatisfaction();
      
      console.log('✅ loadTicketDetail completed successfully');
      
    } catch (error) {
      console.error('❌ Error in loadTicketDetail:', error);
      this.error = 'เกิดข้อผิดพลาดในการโหลดข้อมูล ticket';
    } finally {
      this.isLoading = false;
    }
  }

  private useTicketDataStatus(): void {
    if (!this.ticketData?.ticket) return;

    const statusId = this.ticketData.ticket.status_id || 5;
    
    const statusName = this.statusCacheLoaded 
      ? this.apiService.getCachedStatusName(statusId)
      : (this.ticketData.ticket.status_name || this.getDefaultStatusName(statusId));
    
    this.currentStatusInfo = {
      status_id: statusId,
      status_name: statusName,
      language_id: 'th'
    };
    
    this.ticketData.ticket.status_id = statusId;
    this.ticketData.ticket.status_name = statusName;
    this.updateEvaluationStatus();
    
    console.log('✅ Using status:', {
      statusId,
      statusName,
      canEvaluate: this.canEvaluate,
      fromCache: this.statusCacheLoaded,
      currentStatusInfo: this.currentStatusInfo
    });
  }

  // ===== SATISFACTION METHODS ===== ✅

  /**
   * ✅ อัพเดทสถานะการประเมิน
   */
  private updateEvaluationStatus(): void {
    const statusId = this.getCurrentStatusId();
    
    this.canEvaluate = this.apiService.canEvaluateTicket(statusId);
    this.satisfactionMessage = this.apiService.getEvaluationStatusMessage(statusId);
    
    console.log('✅ Evaluation status updated:', {
      statusId,
      canEvaluate: this.canEvaluate,
      message: this.satisfactionMessage
    });
  }

  /**
   * ✅ ตั้งค่าคะแนนความพึงพอใจและบันทึก
   */
  setRating(rating: number): void {
    if (!this.canEvaluate) {
      console.log('Cannot evaluate this ticket:', this.satisfactionMessage);
      return;
    }

    if (this.hasExistingSatisfaction) {
      console.log('Ticket already has satisfaction rating');
      return;
    }

    // ✅ ตั้งค่า rating ทันทีเพื่อให้ดาวเปลี่ยนสี
    this.currentRating = rating;
    this.satisfaction(rating);
    console.log('Rating set to:', rating);
  }

  /**
   * ✅ บันทึกคะแนนความพึงพอใจ - แสดง Modal แทน Alert + จัดการ body class
   */
  private satisfaction(rating: number): void {
    if (!this.ticket_no || this.isSavingRating) {
      return;
    }

    this.isSavingRating = true;
    
    this.apiService.satisfaction(this.ticket_no, rating).subscribe({
      next: (response: satisfactionResponse) => {
        if (response.success) {
          console.log('✅ Satisfaction saved successfully:', response.data);
          
          // ✅ เก็บสถานะการให้คะแนนอย่างถาวร
          this.hasExistingSatisfaction = true;
          this.satisfactionMessage = 'บันทึกคะแนนความพึงพอใจสำเร็จ';
          
          // ✅ ให้แน่ใจว่า currentRating ยังคงมีค่าที่ถูกต้อง
          this.currentRating = rating;
          
          // ✅ บันทึกลง localStorage เป็น backup
          this.saveSatisfactionToStorage(rating);
          
          // ✅ แสดง Success Modal แทน Alert + จัดการ body class
          this.showSuccessModal = true;
          this.modalTitle = 'Assessment Success';
          this.modalMessage = 'ขอบคุณสำหรับการประเมินความพึงพอใจ';
          this.modalTicketNo = this.ticket_no;
          
          // ✅ เพิ่ม body class เพื่อป้องกัน scroll
          document.body.classList.add('modal-open');
          
        } else {
          console.error('❌ Failed to save satisfaction:', response.error);
          
          // ✅ ถ้าล้มเหลว ให้ reset rating
          this.currentRating = 0;
          this.hasExistingSatisfaction = false;
          alert(response.error || 'ไม่สามารถบันทึกการประเมินได้');
        }
        this.isSavingRating = false;
      },
      error: (error) => {
        console.error('❌ Error saving satisfaction:', error);
        
        // ✅ ถ้า error ให้ reset rating
        this.currentRating = 0;
        this.hasExistingSatisfaction = false;
        this.isSavingRating = false;
        alert('เกิดข้อผิดพลาดในการบันทึกคะแนนความพึงพอใจ');
      }
    });
  }

  /**
   * ✅ ตรวจสอบว่าสามารถคลิกดาวได้หรือไม่
   */
  canClickStar(): boolean {
    return this.canEvaluate && !this.hasExistingSatisfaction && !this.isSavingRating;
  }

  /**
   * ✅ ได้รับคลาส CSS สำหรับดาว - แก้ไขเพื่อแสดงสีเหลืองหลังให้คะแนนแล้ว
   */
  getStarClass(starIndex: number): string {
    const baseClass = 'star';
    
    // ✅ ถ้าให้คะแนนแล้ว ให้แสดงดาวเป็นสีเหลือง (filled) ตามจำนวนที่ให้
    if (this.hasExistingSatisfaction && this.currentRating > 0) {
      return baseClass + (starIndex <= this.currentRating ? ' filled permanent-rating' : ' disabled');
    }
    
    // ✅ ถ้าไม่สามารถคลิกได้
    if (!this.canClickStar()) {
      return baseClass + ' disabled';
    }
    
    // ✅ ถ้ากำลังบันทึก และเป็นดาวที่ให้คะแนน
    if (this.isSavingRating && starIndex === this.currentRating) {
      return baseClass + ' saving';
    }
    
    // ✅ ถ้ากำลัง hover
    if (this.hoverRating > 0) {
      return baseClass + (starIndex <= this.hoverRating ? ' hover' : '');
    }
    
    // ✅ แสดงตามคะแนนปัจจุบัน (ระหว่างการให้คะแนน)
    return baseClass + (starIndex <= this.currentRating ? ' filled' : '');
  }

  /**
   * ✅ ตรวจสอบว่าดาวควรจะเต็ม (สีเหลือง) หรือไม่
   */
  isStarFilled(starIndex: number): boolean {
    // ✅ ถ้าให้คะแนนแล้ว ให้แสดงตามคะแนนที่ให้
    if (this.hasExistingSatisfaction && this.currentRating > 0) {
      return starIndex <= this.currentRating;
    }
    
    // ✅ ถ้ากำลัง hover
    if (this.hoverRating > 0 && this.canClickStar()) {
      return starIndex <= this.hoverRating;
    }
    
    // ✅ ถ้ากำลังเลือกคะแนน (ก่อนบันทึก)
    if (this.currentRating > 0 && !this.hasExistingSatisfaction) {
      return starIndex <= this.currentRating;
    }
    
    return false;
  }

  /**
   * ✅ จัดการ mouse events บนดาว - ป้องกันการ hover หลังให้คะแนนแล้ว
   */
  onStarMouseEnter(rating: number): void {
    if (this.canClickStar() && !this.hasExistingSatisfaction) {
      this.hoverRating = rating;
    }
  }

  onStarMouseLeave(): void {
    if (this.canClickStar() && !this.hasExistingSatisfaction) {
      this.hoverRating = 0;
    }
  }

  /**
   * ✅ ได้รับ tooltip สำหรับดาว
   */
  getStarTooltip(starIndex: number): string {
    if (this.hasExistingSatisfaction) {
      if (starIndex <= this.currentRating) {
        return `คุณให้คะแนน ${this.currentRating} ดาวแล้ว`;
      } else {
        return `คุณให้คะแนน ${this.currentRating} ดาวแล้ว`;
      }
    }
    
    if (!this.canEvaluate) {
      return this.satisfactionMessage;
    }
    
    if (this.canClickStar()) {
      return `ให้คะแนน ${starIndex} ดาว`;
    }
    
    return this.getEvaluationMessage();
  }

  /**
   * ✅ ได้รับข้อความสำหรับแสดงสถานะการประเมิน
   */
  getEvaluationMessage(): string {
    if (this.hasExistingSatisfaction && this.currentRating > 0) {
      return ''; // ✅ ไม่แสดงข้อความเมื่อประเมินแล้ว
    }
    
    if (this.hasExistingSatisfaction) {
      return ''; // ✅ ไม่แสดงข้อความเมื่อประเมินแล้ว
    }
    
    if (!this.canEvaluate) {
      return this.satisfactionMessage;
    }
    
    return 'กรุณาประเมินความพึงพอใจ';
  }

  /**
   * ✅ ปิด Success Modal + จัดการ body class + รีเซ็ตสถานะ
   */
  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
    this.modalTicketNo = '';
    
    // ✅ ลบ body class เพื่ออนุญาต scroll
    document.body.classList.remove('modal-open');
    
    // ✅ ให้แน่ใจว่าสถานะ rating ยังคงอยู่
    if (this.hasExistingSatisfaction && this.currentRating > 0) {
      console.log('Rating confirmed:', this.currentRating, 'stars');
    }
  }

  /**
   * ✅ รีเซ็ตสถานะการประเมิน (ใช้เมื่อต้องการล้างข้อมูล)
   */
  private resetSatisfactionState(): void {
    this.currentRating = 0;
    this.hoverRating = 0;
    this.hasExistingSatisfaction = false;
    this.isSavingRating = false;
    this.satisfactionMessage = '';
  }

  /**
   * ✅ โหลดสถานะการประเมินจากข้อมูล ticket (ถ้ามี)
   */
  private loadExistingSatisfaction(): void {
    // ✅ ตรวจสอบว่ามีข้อมูลการประเมินแล้วหรือไม่
    // ในการใช้งานจริง อาจจะดึงจาก API หรือ localStorage
    
    const savedRating = localStorage.getItem(`satisfaction_${this.ticket_no}`);
    if (savedRating) {
      const rating = parseInt(savedRating, 10);
      if (rating >= 1 && rating <= 5) {
        this.currentRating = rating;
        this.hasExistingSatisfaction = true;
        this.satisfactionMessage = `คุณได้ให้คะแนน ${rating} ดาวแล้ว`;
        console.log('Loaded existing satisfaction:', rating, 'stars');
      }
    }
  }

  /**
   * ✅ บันทึกสถานะการประเมินลง localStorage (เป็น backup)
   */
  private saveSatisfactionToStorage(rating: number): void {
    try {
      localStorage.setItem(`satisfaction_${this.ticket_no}`, rating.toString());
      localStorage.setItem(`satisfaction_${this.ticket_no}_timestamp`, new Date().toISOString());
      console.log('Satisfaction saved to localStorage:', rating);
    } catch (error) {
      console.warn('Could not save satisfaction to localStorage:', error);
    }
  }

  // ===== HISTORY METHODS ===== ✅

  private async loadTicketHistory(): Promise<void> {
    if (!this.ticketData?.ticket?.id) {
      this.buildHistoryFromExistingData();
      return;
    }

    this.isLoadingHistory = true;
    
    try {
      const historyResponse = await this.getMockTicketHistory(this.ticketData.ticket.id).toPromise();
      
      if (historyResponse?.success && historyResponse.data) {
        this.ticketHistory = historyResponse.data;
        this.buildDisplayHistory();
        console.log('✅ Ticket history loaded successfully');
      } else {
        this.buildHistoryFromExistingData();
      }
    } catch (error) {
      console.error('❌ Error loading ticket history:', error);
      this.buildHistoryFromExistingData();
    } finally {
      this.isLoadingHistory = false;
    }
  }

  private getMockTicketHistory(ticketId: number): Observable<TicketHistoryResponse> {
    const existingHistory = this.ticketData?.status_history || [];
    
    const historyFromDatabase: TicketStatusHistory[] = existingHistory
      .filter(h => h.create_date)
      .map((historyItem, index) => ({
        id: index + 1,
        ticket_id: ticketId,
        status_id: historyItem.status_id,
        create_date: historyItem.create_date,
        create_by: 1,
        status: { 
          id: historyItem.status_id, 
          name: historyItem.status_name 
        }
      }));

    const mockResponse: TicketHistoryResponse = {
      success: true,
      message: 'History from database',
      data: historyFromDatabase
    };

    console.log('✅ Using real database history:', historyFromDatabase);
    return new Observable<TicketHistoryResponse>((observer) => {
      setTimeout(() => {
        observer.next(mockResponse);
        observer.complete();
      }, 50);
    });
  }

  private buildDisplayHistory(): void {
    if (!this.ticketData?.ticket) return;

    const currentStatusId = this.getCurrentStatusId();
    console.log('Building display history for current status:', currentStatusId);
    
    this.displayHistory = this.STATUS_WORKFLOW.map((workflowStatus) => {
      const historyItem = this.ticketHistory.find(h => h.status_id === workflowStatus.id);
      
      const currentPosition = this.getStatusPosition(currentStatusId);
      const thisPosition = this.getStatusPosition(workflowStatus.id);
      
      const isActive = workflowStatus.id === currentStatusId;
      const isCompleted = thisPosition < currentPosition && thisPosition !== -1;
      
      const statusName = this.statusCacheLoaded 
        ? this.apiService.getCachedStatusName(workflowStatus.id)
        : workflowStatus.name;
      
      return {
        status_id: workflowStatus.id,
        status_name: statusName,
        create_date: historyItem?.create_date || '',
        is_active: isActive,
        is_completed: isCompleted
      };
    });

    console.log('Built display history with status from cache:', this.displayHistory);
  }

  private buildHistoryFromExistingData(): void {
    if (!this.ticketData?.ticket) return;

    const currentStatusId = this.getCurrentStatusId();
    const existingHistory = this.ticketData.status_history || [];
    
    this.displayHistory = this.STATUS_WORKFLOW.map((workflowStatus) => {
      const existingItem = existingHistory.find(h => h.status_id === workflowStatus.id);
      
      const currentPosition = this.getStatusPosition(currentStatusId);
      const thisPosition = this.getStatusPosition(workflowStatus.id);
      
      const isActive = workflowStatus.id === currentStatusId;
      const isCompleted = thisPosition < currentPosition && thisPosition !== -1;
      
      const statusName = this.statusCacheLoaded 
        ? this.apiService.getCachedStatusName(workflowStatus.id)
        : workflowStatus.name;
      
      return {
        status_id: workflowStatus.id,
        status_name: statusName,
        create_date: existingItem?.create_date || '',
        is_active: isActive,
        is_completed: isCompleted
      };
    });

    console.log('Built fallback history with status from cache:', this.displayHistory);
  }

  private getStatusPosition(statusId: number): number {
    const index = this.STATUS_WORKFLOW.findIndex(s => s.id === statusId);
    return index !== -1 ? index : 0;
  }

  getHistoryBadgeClass(historyItem: HistoryDisplayItem): string {
    if (historyItem.is_active) {
      return 'badge-current';
    }
    if (historyItem.is_completed) {
      return 'badge-completed';
    }
    return 'badge-pending';
  }

  getHistoryIcon(statusName: string): string {
    const workflowItem = this.STATUS_WORKFLOW.find(s => 
      s.name.toLowerCase() === statusName.toLowerCase()
    );
    return workflowItem?.icon || 'bi-clock';
  }

  hasHistoryDate(historyItem: HistoryDisplayItem): boolean {
    return !!historyItem.create_date && historyItem.create_date.trim() !== '';
  }

  formatHistoryDate(dateString: string): string {
    if (!dateString || dateString.trim() === '') {
      return '-';
    }
    
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  }

  // ===== STATUS METHODS ===== ✅

  getCurrentStatusName(): string {
    const statusId = this.getCurrentStatusId();
    
    if (this.statusCacheLoaded) {
      return this.apiService.getCachedStatusName(statusId);
    }
    
    return this.currentStatusInfo?.status_name || 
           this.ticketData?.ticket?.status_name || 
           this.getDefaultStatusName(statusId);
  }

  getCurrentStatusId(): number {
    return this.currentStatusInfo?.status_id || 
           this.ticketData?.ticket?.status_id || 
           1;
  }

  private getDefaultStatusName(statusId: number): string {
    switch (statusId) {
      case 1: return 'Created';
      case 2: return 'Open Ticket';
      case 3: return 'In Progress';
      case 4: return 'Resolved';
      case 5: return 'Completed';
      case 6: return 'Cancel';
      default: return `Status ${statusId}`;
    }
  }

  getStatusBadgeClass(statusId?: number): string {
    const currentStatusId = statusId || this.getCurrentStatusId();
    
    switch (currentStatusId) {
      case 1: return 'badge-pending';
      case 2: return 'badge-in-progress';
      case 3: return 'badge-hold';
      case 4: return 'badge-resolved';
      case 5: return 'badge-complete';
      case 6: return 'badge-cancel';
      default: return 'badge-pending';
    }
  }

  getStatusIcon(statusId?: number): string {
    const currentStatusId = statusId || this.getCurrentStatusId();
    
    switch (currentStatusId) {
      case 1: return 'bi-plus-circle';
      case 2: return 'bi-clock';
      case 3: return 'bi-play-circle';
      case 4: return 'bi-clipboard-check';
      case 5: return 'bi-check-circle';
      case 6: return 'bi-x-circle';
      default: return 'bi-clock';
    }
  }

  // ===== EDIT/DELETE METHODS ===== ✅

  onEditTicket(): void {
    if (!this.ticketData?.ticket?.ticket_no) {
      console.error('No ticket number available for edit');
      return;
    }

    const currentStatus = this.getCurrentStatusId();
    
    if (currentStatus === 5) {
      alert('Ticket นี้เสร็จสิ้นแล้ว ไม่สามารถแก้ไขได้');
      return;
    }
    
    if (currentStatus === 6) {
      alert('Ticket นี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไขได้');
      return;
    }

    this.saveTicketDataForEdit();
    this.router.navigate(['/tickets/edit', this.ticketData.ticket.ticket_no]);
  }

  onDeleteTicket(): void {
    if (!this.ticketData?.ticket?.ticket_no) {
      console.error('No ticket number available for deletion');
      return;
    }

    const ticketNo = this.ticketData.ticket.ticket_no;
    const confirmMessage = `คุณแน่ใจหรือไม่ที่ต้องการลบ ticket ${ticketNo}?\n\nการลบนี้ไม่สามารถยกเลิกได้`;
    
    if (confirm(confirmMessage)) {
      this.deleteTicket(ticketNo);
    }
  }

  canEdit(): boolean {
    if (!this.ticketData?.ticket) return false;
    
    const status = this.getCurrentStatusId();
    return [1, 2, 3, 4].includes(status);
  }

  canDelete(): boolean {
    if (!this.ticketData?.ticket) return false;
    
    const status = this.getCurrentStatusId();
    return ![5, 6].includes(status);
  }

  getEditButtonText(): string {
    if (!this.ticketData?.ticket) return 'Edit';
    
    const status = this.getCurrentStatusId();
    
    switch (status) {
      case 5: return 'Completed';
      case 6: return 'Cancelled';
      default: return 'Edit';
    }
  }

  getEditButtonClass(): string {
    return this.canEdit() ? 'btn-edit' : 'btn-edit disabled';
  }

  getDeleteButtonClass(): string {
    return this.canDelete() ? 'btn-delete' : 'btn-delete disabled';
  }

  // ===== ATTACHMENT METHODS ===== ✅

  private analyzeAllAttachments(): void {
    if (!this.ticketData) return;

    if (this.ticketData.issue_attachment?.length > 0) {
      this.ticketData.issue_attachment.forEach(attachment => {
        this.analyzeAttachment(attachment);
      });
    }

    if (this.ticketData.fix_attachment?.length > 0) {
      this.ticketData.fix_attachment.forEach(attachment => {
        this.analyzeAttachment(attachment);
      });
    }
  }

  private analyzeAttachment(attachment: any): void {
    const attachmentId = attachment.attachment_id;
    
    this.attachmentTypes[attachmentId] = {
      type: 'file',
      extension: '',
      filename: 'Loading...',
      isLoading: true
    };

    if (attachment.filename || attachment.file_type) {
      const filename = attachment.filename || this.extractFilenameFromPath(attachment.path);
      const fileType = attachment.file_type || this.getFileTypeFromFilename(filename);
      
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategory(fileType, filename),
        extension: this.getFileExtension(filename),
        filename: filename,
        isLoading: false
      };
      
      console.log(`File analyzed from API data:`, { id: attachmentId, filename, fileType, category: this.attachmentTypes[attachmentId].type });
      return;
    }

    const filename = this.extractFilenameFromPath(attachment.path);
    const extension = this.getFileExtension(filename);
    
    if (extension) {
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByExtension(extension),
        extension: extension,
        filename: filename,
        isLoading: false
      };
      
      console.log(`File analyzed from path:`, { id: attachmentId, filename, extension, category: this.attachmentTypes[attachmentId].type });
      return;
    }

    if (attachment.path.startsWith('data:')) {
      const mimeType = this.extractMimeTypeFromDataUrl(attachment.path);
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByMimeType(mimeType),
        extension: this.getExtensionFromMimeType(mimeType),
        filename: `attachment_${attachmentId}.${this.getExtensionFromMimeType(mimeType)}`,
        isLoading: false
      };
      
      console.log(`File analyzed from data URL:`, { id: attachmentId, mimeType, category: this.attachmentTypes[attachmentId].type });
      return;
    }

    this.checkFileTypeFromHeaders(attachment.path, attachmentId);
  }

  private extractFilenameFromPath(path: string): string {
    if (!path) return 'unknown';
    
    if (path.startsWith('data:')) {
      return 'data_file';
    }
    
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    
    return lastPart.split('?')[0] || 'unknown';
  }

  private getFileExtension(filename: string): string {
    if (!filename || filename === 'unknown') return '';
    
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private getFileTypeFromFilename(filename: string): string {
    const extension = this.getFileExtension(filename);
    return extension || 'unknown';
  }

  private determineFileCategory(fileType: string, filename: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = fileType.toLowerCase();
    const ext = this.getFileExtension(filename).toLowerCase();
    
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext)) {
      return 'image';
    }
    
    if (type.includes('pdf') || ext === 'pdf') {
      return 'pdf';
    }
    
    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'excel';
    }
    
    if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'rtf'].includes(ext)) {
      return 'word';
    }
    
    if (type.includes('text') || ['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }
    
    if (type.includes('archive') || type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }
    
    if (type.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }
    
    if (type.includes('audio') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    }
    
    return 'file';
  }

  private determineFileCategoryByExtension(extension: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const ext = extension.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext)) {
      return 'image';
    }
    
    if (ext === 'pdf') {
      return 'pdf';
    }
    
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'excel';
    }
    
    if (['doc', 'docx', 'rtf'].includes(ext)) {
      return 'word';
    }
    
    if (['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }
    
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }
    
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }
    
    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    }
    
    return 'file';
  }

  private extractMimeTypeFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+)/);
    return match ? match[1] : '';
  }

  private determineFileCategoryByMimeType(mimeType: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    
    return 'file';
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'application/json': 'json',
      'text/html': 'html',
      'application/zip': 'zip',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3'
    };
    
    return mimeToExt[mimeType] || 'bin';
  }

  private checkFileTypeFromHeaders(url: string, attachmentId: number): void {
    fetch(url, { 
      method: 'HEAD',
      mode: 'cors'
    })
    .then(response => {
      const contentType = response.headers.get('content-type');
      const contentDisposition = response.headers.get('content-disposition');
      
      let filename = `attachment_${attachmentId}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      if (contentType) {
        this.attachmentTypes[attachmentId] = {
          type: this.determineFileCategoryByMimeType(contentType),
          extension: this.getExtensionFromMimeType(contentType),
          filename: filename,
          isLoading: false
        };
        
        console.log(`File analyzed from HTTP headers:`, { id: attachmentId, contentType, filename, category: this.attachmentTypes[attachmentId].type });
      } else {
        this.attachmentTypes[attachmentId] = {
          type: 'file',
          extension: '',
          filename: filename,
          isLoading: false
        };
      }
    })
    .catch(error => {
      console.log(`Could not fetch headers for ${url}:`, error);
      this.tryImageLoad(url, attachmentId);
    });
  }

  private tryImageLoad(url: string, attachmentId: number): void {
    const img = new Image();
    
    img.onload = () => {
      this.attachmentTypes[attachmentId] = {
        type: 'image',
        extension: 'jpg',
        filename: this.extractFilenameFromPath(url) || `image_${attachmentId}.jpg`,
        isLoading: false
      };
      console.log(`File detected as image through loading test:`, attachmentId);
    };
    
    img.onerror = () => {
      this.attachmentTypes[attachmentId] = {
        type: 'file',
        extension: '',
        filename: this.extractFilenameFromPath(url) || `file_${attachmentId}`,
        isLoading: false
      };
      console.log(`File defaulted to generic file type:`, attachmentId);
    };
    
    img.crossOrigin = 'anonymous';
    img.src = url;
  }

  // ===== ATTACHMENT PUBLIC METHODS ===== ✅

  isImageFile(path: string, attachmentId?: number): boolean {
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].type === 'image';
    }
    
    if (path.startsWith('data:image/')) return true;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  getFileIcon(path: string, attachmentId?: number): string {
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
    
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'bi-file-earmark-pdf-fill';
      case 'doc':
      case 'docx': return 'bi-file-earmark-word-fill';
      case 'xls':
      case 'xlsx': 
      case 'csv': return 'bi-file-earmark-excel-fill';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg': return 'bi-image-fill';
      case 'txt':
      case 'log':
      case 'md':
      case 'json':
      case 'xml': return 'bi-file-earmark-text-fill';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz': return 'bi-file-earmark-zip-fill';
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
      case 'wmv': return 'bi-file-earmark-play-fill';
      case 'mp3':
      case 'wav':
      case 'aac':
      case 'flac': return 'bi-file-earmark-music-fill';
      default: return 'bi-file-earmark-fill';
    }
  }

  getDisplayFileName(path: string, attachmentId?: number): string {
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].filename;
    }
    
    return this.extractFilenameFromPath(path);
  }

  getFileInfo(attachmentId: number): { type: string; extension: string; filename: string; isLoading: boolean; icon: string; } {
    const fileInfo = this.attachmentTypes[attachmentId];
    
    if (fileInfo) {
      return {
        type: fileInfo.type,
        extension: fileInfo.extension,
        filename: fileInfo.filename,
        isLoading: fileInfo.isLoading || false,
        icon: this.getFileIcon('', attachmentId)
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

  getFileSize(attachment: any): string {
    if (attachment.file_size) {
      const size = attachment.file_size;
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return '';
  }

  onDownloadAttachment(attachmentId: number, path: string): void {
    const fileInfo = this.getFileInfo(attachmentId);
    
    if (path.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = path;
      link.download = fileInfo.filename || `attachment_${attachmentId}`;
      link.click();
    } else {
      window.open(path, '_blank');
    }
    
    console.log(`Downloading attachment:`, { id: attachmentId, filename: fileInfo.filename, type: fileInfo.type, path: path });
  }

  onImageError(attachmentId: number): void {
    console.log(`Image failed to load for attachment ${attachmentId}`);
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
    }
  }

  onImageLoad(attachmentId: number): void {
    console.log(`Image loaded successfully for attachment ${attachmentId}`);
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
    }
  }

  // ===== UTILITY METHODS ===== ✅

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }

  // ===== PRIVATE HELPER METHODS ===== ✅

  private saveTicketDataForEdit(): void {
    if (!this.ticketData?.ticket) return;

    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?.user_id;
    
    if (!currentUserId) {
      console.error('No current user ID found');
      return;
    }

    const editTicketData = {
      userId: currentUserId,
      ticketId: this.ticketData.ticket.id,
      ticket_no: this.ticketData.ticket.ticket_no,
      isEditMode: true,
      isTicketCreated: true,
      formData: {
        projectId: this.ticketData.ticket.project_id,
        categoryId: this.ticketData.ticket.categories_id,
        issueDescription: this.ticketData.ticket.issue_description
      },
      selectedProject: {
        id: this.ticketData.ticket.project_id,
        projectName: this.ticketData.ticket.project_name
      },
      selectedCategory: {
        id: this.ticketData.ticket.categories_id,
        categoryName: this.ticketData.ticket.categories_name
      },
      existingAttachments: this.ticketData.issue_attachment.map(attachment => ({
        attachment_id: attachment.attachment_id,
        path: attachment.path,
        filename: attachment.filename,
        file_type: attachment.file_type,
        file_size: attachment.file_size
      })),
      timestamp: new Date().getTime()
    };
    
    const storageKey = `editTicket_${currentUserId}_${this.ticketData.ticket.ticket_no}`;
    localStorage.setItem(storageKey, JSON.stringify(editTicketData));
  }

  private deleteTicket(ticket_no: string): void {
    this.isDeleting = true;
    
    this.apiService.deleteTicketByTicketNo(ticket_no).subscribe({
      next: (response: any) => {
        if (response.code === 1) {
          alert('ลบ ticket สำเร็จแล้ว');
          this.clearLocalStorageData();
          this.backToList();
        } else {
          alert(`ไม่สามารถลบ ticket ได้: ${response.message}`);
        }
        this.isDeleting = false;
      },
      error: (error: any) => {
        console.error('Delete ticket error:', error);
        alert(`เกิดข้อผิดพลาดในการลบ ticket: ${error}`);
        this.isDeleting = false;
      }
    });
  }

  private clearLocalStorageData(): void {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?.user_id;
    
    if (currentUserId) {
      const incompleteKey = `incompleteTicket_${currentUserId}`;
      const editKey = `editTicket_${currentUserId}_${this.ticket_no}`;
      
      localStorage.removeItem(incompleteKey);
      localStorage.removeItem(editKey);
    }
  }

  private getTicketByTicketNo(ticket_no: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ticket_no || ticket_no.trim() === '') {
        this.error = 'หมายเลขตั๋วไม่ถูกต้อง';
        reject(new Error('Invalid ticket number'));
        return;
      }

      const requestData: GetTicketDataRequest = { ticket_no: ticket_no };
      
      this.apiService.getTicketData(requestData).subscribe({
        next: (response: any) => {
          if (response && response.code === 1) {
            if (response.data && this.isValidTicketData(response.data)) {
              this.ticketData = response.data as TicketData;
              this.analyzeAllAttachments();
              resolve();
            } else {
              this.error = 'ข้อมูล ticket ไม่ถูกต้อง';
              this.loadMockData();
              resolve();
            }
          } else {
            this.error = response?.message || 'ไม่พบข้อมูล ticket ที่ต้องการ';
            this.loadMockData();
            resolve();
          }
        },
        error: (error: any) => {
          console.error('API Error:', error);
          this.error = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
          this.loadMockData();
          resolve();
        }
      });
    });
  }

  private isValidTicketData(data: any): boolean {
    const hasTicket = data.ticket && typeof data.ticket === 'object';
    const hasIssueAttachment = Array.isArray(data.issue_attachment);
    const hasFixAttachment = Array.isArray(data.fix_attachment);
    const hasStatusHistory = Array.isArray(data.status_history);

    return hasTicket && hasIssueAttachment && hasFixAttachment && hasStatusHistory;
  }

  private loadMockData(): void {
    this.ticketData = {
      ticket: {
        id: 1,
        ticket_no: this.ticket_no,
        categories_id: 1,
        categories_name: 'ระบบล่ม/ใช้งานไม่ได้',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        fix_issue_description: '',
        status_id: 5,
        status_name: 'Completed',
        close_estimate: '',
        estimate_time: '0 H',
        due_date: '',
        lead_time: '0 H',
        related_ticket_id: null,
        change_request: '0 Mandays',
        create_date: '2025-06-25T16:36:00.000Z',
        create_by: 'Wasan Rungsavang',
        update_date: '2025-06-25T16:36:00.000Z',
        update_by: 'Wasan Rungsavang',
        isenabled: true,
        priority: 'High'
      },
      issue_attachment: [
        {
          attachment_id: 1,
          path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          filename: 'screenshot.png',
          file_type: 'image/png'
        },
        {
          attachment_id: 2,
          path: '/api/attachments/download/72',
          filename: 'document.pdf',
          file_type: 'application/pdf'
        }
      ],
      fix_attachment: [],
      status_history: [
        {
          status_id: 1,
          status_name: 'Created',
          create_date: '2025-06-25T16:36:00.000Z'
        },
        {
          status_id: 2,
          status_name: 'Open Ticket',
          create_date: '2025-06-25T16:41:00.000Z'
        },
        {
          status_id: 3,
          status_name: 'In Progress',
          create_date: '2025-06-25T16:46:00.000Z'
        },
        {
          status_id: 4,
          status_name: 'Resolved',
          create_date: '2025-06-25T17:06:00.000Z'
        },
        {
          status_id: 5,
          status_name: 'Completed',
          create_date: '2025-06-25T17:11:00.000Z'
        },
        {
          status_id: 6,
          status_name: 'Cancel',
          create_date: ''
        }
      ]
    };
    this.isLoading = false;
  }

  // ===== NAVIGATION ===== ✅

  backToList(): void {
    this.router.navigate(['/tickets']);
  }
}