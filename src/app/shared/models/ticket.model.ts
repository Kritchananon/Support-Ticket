export interface Ticket {
  id: number;
  ticket_no: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id: number;
  hour_estimate: number;
  estimate_time: string;
  due_date: string;
  lead_time: number;
  related_ticket_id?: number;
  change_request: boolean;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
  
  // ✅ เพิ่มฟิลด์ใหม่สำหรับ saveSupporter API
  close_estimate?: string;
  fix_issue_description?: string;
  status_name?: string; // ✅ เพิ่มสำหรับแสดงชื่อ status
}

export interface TicketStatus {
  id: number;
  create_date: string;
  create_by: number;
  isenabled: boolean;
}

export interface TicketCategory {
  id: number;
  create_date: string;
  create_by: number;
  isenabled: boolean;
}

// ✅ เพิ่ม Interface สำหรับ Attachment
export interface TicketAttachment {
  id: number;
  ticket_id: number;
  type: 'reporter' | 'supporter';
  extension: string;
  filename: string;
  create_by: number;
  update_by: number;
  deleted_at: string | null;
  create_date: string;
  isenabled: boolean;
}

// ✅ เพิ่ม Interface สำหรับ Time Calculations
export interface TimeCalculations {
  original: {
    estimate_time: string;
    lead_time: string;
    due_date: string;
    close_estimate: string;
  };
  updated: {
    estimate_time: string;
    lead_time: string;
    due_date: string;
    close_estimate: string;
  };
  calculations: {
    time_variance: number;
    sla_status: string | null;
    utilization_rate: number | null;
    priority_adjustment: string | null;
  };
}

// ✅ เพิ่ม Interface สำหรับ saveSupporter Response
export interface SaveSupporterResponse {
  success: boolean;
  message: string;
  data: {
    ticket: Ticket;
    timeCalculations: TimeCalculations;
    attachments: TicketAttachment[];
  };
}

// ✅ เพิ่ม Interface สำหรับ saveSupporter Request Data
export interface SaveSupporterFormData {
  estimate_time?: number;
  lead_time?: number;
  due_date?: string;
  close_estimate?: string;
  fix_issue_description?: string;
  related_ticket_id?: number;
  status_id?: number; // ✅ เพิ่ม status_id สำคัญมาก!
}

// ✅ เพิ่ม Interface สำหรับ Supporter Role Checking
export interface SupporterPermissions {
  canSaveSupporter: boolean;
  canEditTimeFields: boolean;
  canUploadAttachments: boolean;
  canChangeStatus: boolean;
}

// ✅ เพิ่ม Enum สำหรับ Action Types
export enum SupporterActionType {
  COMPLETE = 'COMPLETE',
  PENDING = 'PENDING', 
  OPEN_TICKET = 'OPEN_TICKET',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CANCEL = 'CANCEL'
}

// ✅ เพิ่ม Interface สำหรับ Action Dropdown Option
export interface ActionDropdownOption {
  value: SupporterActionType;
  label: string;
  statusId: number;
  disabled?: boolean;
  description?: string;
}

// ✅ ENHANCED: Status Mapping และ Utilities

/**
 * ✅ Status ID Constants - ตรงกับ Backend Database
 */
export const TICKET_STATUS_IDS = {
  CREATED: 1,
  OPEN_TICKET: 2,
  IN_PROGRESS: 3,
  RESOLVED: 4,
  COMPLETED: 5,
  CANCEL: 6
} as const;

/**
 * ✅ Status Name Mapping - ภาษาไทย
 */
export const TICKET_STATUS_NAMES_TH = {
  [TICKET_STATUS_IDS.CREATED]: 'เปิดคำร้อง',
  [TICKET_STATUS_IDS.OPEN_TICKET]: 'Open Ticket',
  [TICKET_STATUS_IDS.IN_PROGRESS]: 'กำลังดำเนินการ',
  [TICKET_STATUS_IDS.RESOLVED]: 'แก้ไขแล้ว',
  [TICKET_STATUS_IDS.COMPLETED]: 'ดำเนินการเสร็จสิ้น',
  [TICKET_STATUS_IDS.CANCEL]: 'ยกเลิก'
} as const;

/**
 * ✅ Status Name Mapping - ภาษาอังกฤษ
 */
export const TICKET_STATUS_NAMES_EN = {
  [TICKET_STATUS_IDS.CREATED]: 'Created',
  [TICKET_STATUS_IDS.OPEN_TICKET]: 'Open Ticket',
  [TICKET_STATUS_IDS.IN_PROGRESS]: 'In Progress',
  [TICKET_STATUS_IDS.RESOLVED]: 'Resolved',
  [TICKET_STATUS_IDS.COMPLETED]: 'Completed',
  [TICKET_STATUS_IDS.CANCEL]: 'Cancel'
} as const;

/**
 * ✅ Action Type to Status ID Mapping
 */
export const ACTION_TO_STATUS_MAPPING = {
  [SupporterActionType.PENDING]: TICKET_STATUS_IDS.CREATED,
  [SupporterActionType.OPEN_TICKET]: TICKET_STATUS_IDS.OPEN_TICKET,
  [SupporterActionType.IN_PROGRESS]: TICKET_STATUS_IDS.IN_PROGRESS,
  [SupporterActionType.RESOLVED]: TICKET_STATUS_IDS.RESOLVED,
  [SupporterActionType.COMPLETE]: TICKET_STATUS_IDS.COMPLETED,
  [SupporterActionType.CANCEL]: TICKET_STATUS_IDS.CANCEL
} as const;

/**
 * ✅ Status ID to Action Type Mapping
 */
export const STATUS_TO_ACTION_MAPPING = {
  [TICKET_STATUS_IDS.CREATED]: SupporterActionType.PENDING,
  [TICKET_STATUS_IDS.OPEN_TICKET]: SupporterActionType.OPEN_TICKET,
  [TICKET_STATUS_IDS.IN_PROGRESS]: SupporterActionType.IN_PROGRESS,
  [TICKET_STATUS_IDS.RESOLVED]: SupporterActionType.RESOLVED,
  [TICKET_STATUS_IDS.COMPLETED]: SupporterActionType.COMPLETE,
  [TICKET_STATUS_IDS.CANCEL]: SupporterActionType.CANCEL
} as const;

// ✅ ENHANCED: Utility Functions

/**
 * แปลง Action Type เป็น Status ID
 */
export function actionTypeToStatusId(actionType: SupporterActionType): number {
  return ACTION_TO_STATUS_MAPPING[actionType] || TICKET_STATUS_IDS.CREATED;
}

/**
 * แปลง Status ID เป็น Action Type
 */
export function statusIdToActionType(statusId: number): SupporterActionType {
  return STATUS_TO_ACTION_MAPPING[statusId as keyof typeof STATUS_TO_ACTION_MAPPING] || SupporterActionType.PENDING;
}

/**
 * ได้รับชื่อ Status ตาม Language
 */
export function getStatusName(statusId: number, language: 'th' | 'en' = 'th'): string {
  const nameMapping = language === 'th' ? TICKET_STATUS_NAMES_TH : TICKET_STATUS_NAMES_EN;
  return nameMapping[statusId as keyof typeof nameMapping] || `Status ${statusId}`;
}

/**
 * ตรวจสอบว่า Status ID ถูกต้องหรือไม่
 */
export function isValidStatusId(statusId: number): boolean {
  return Object.values(TICKET_STATUS_IDS).includes(statusId as any);
}

/**
 * ได้รับ CSS class สำหรับ Status Badge
 */
export function getStatusBadgeClass(statusId: number): string {
  switch (statusId) {
    case TICKET_STATUS_IDS.CREATED:
      return 'badge-pending';
    case TICKET_STATUS_IDS.OPEN_TICKET:
      return 'badge-in-progress';
    case TICKET_STATUS_IDS.IN_PROGRESS:
      return 'badge-hold';
    case TICKET_STATUS_IDS.RESOLVED:
      return 'badge-resolved';
    case TICKET_STATUS_IDS.COMPLETED:
      return 'badge-complete';
    case TICKET_STATUS_IDS.CANCEL:
      return 'badge-cancel';
    default:
      return 'badge-pending';
  }
}

/**
 * ได้รับ Icon สำหรับ Status
 */
export function getStatusIcon(statusId: number): string {
  switch (statusId) {
    case TICKET_STATUS_IDS.CREATED:
      return 'bi-plus-circle';
    case TICKET_STATUS_IDS.OPEN_TICKET:
      return 'bi-clock';
    case TICKET_STATUS_IDS.IN_PROGRESS:
      return 'bi-play-circle';
    case TICKET_STATUS_IDS.RESOLVED:
      return 'bi-clipboard-check';
    case TICKET_STATUS_IDS.COMPLETED:
      return 'bi-check-circle';
    case TICKET_STATUS_IDS.CANCEL:
      return 'bi-x-circle';
    default:
      return 'bi-clock';
  }
}

/**
 * ตรวจสอบว่าสามารถเปลี่ยนจาก status หนึ่งไปยังอีก status ได้หรือไม่
 */
export function canChangeStatus(fromStatusId: number, toStatusId: number): boolean {
  // Cast array เป็น number[]
  const completedOrInProgress = [TICKET_STATUS_IDS.COMPLETED, TICKET_STATUS_IDS.IN_PROGRESS] as number[];
  switch (fromStatusId) {
    case TICKET_STATUS_IDS.COMPLETED:
    case TICKET_STATUS_IDS.CANCEL:
      return false; 
    case TICKET_STATUS_IDS.RESOLVED:
      return [TICKET_STATUS_IDS.COMPLETED, TICKET_STATUS_IDS.IN_PROGRESS].map(Number).includes(toStatusId);
    default:
      return toStatusId !== fromStatusId;
  }
}

/**
 * ได้รับรายการ Actions ที่สามารถทำได้สำหรับ Status ปัจจุบัน
 */
export function getAvailableActions(currentStatusId: number): ActionDropdownOption[] {
  const allActions: ActionDropdownOption[] = [
    {
      value: SupporterActionType.OPEN_TICKET,
      label: 'Open Ticket',
      statusId: TICKET_STATUS_IDS.OPEN_TICKET,
      description: 'เปิดให้ดำเนินการ'
    },
    {
      value: SupporterActionType.IN_PROGRESS,
      label: 'In Progress', 
      statusId: TICKET_STATUS_IDS.IN_PROGRESS,
      description: 'กำลังดำเนินการ'
    },
    {
      value: SupporterActionType.RESOLVED,
      label: 'Resolved',
      statusId: TICKET_STATUS_IDS.RESOLVED,
      description: 'แก้ไขเสร็จแล้ว'
    },
    {
      value: SupporterActionType.COMPLETE,
      label: 'Complete',
      statusId: TICKET_STATUS_IDS.COMPLETED,
      description: 'เสร็จสิ้นสมบูรณ์'
    },
    {
      value: SupporterActionType.CANCEL,
      label: 'Cancel',
      statusId: TICKET_STATUS_IDS.CANCEL,
      description: 'ยกเลิก'
    }
  ];

  // กรองเฉพาะ actions ที่สามารถทำได้
  return allActions.filter(action => 
    canChangeStatus(currentStatusId, action.statusId)
  );
}

/**
 * ✅ Interface สำหรับ Enhanced Ticket ที่มี computed properties
 */
export interface EnhancedTicket extends Ticket {
  // Computed properties
  statusName: string;
  statusBadgeClass: string;
  statusIcon: string;
  canEdit: boolean;
  canDelete: boolean;
  canEvaluate: boolean;
  availableActions: ActionDropdownOption[];
}

/**
 * แปลง Ticket ธรรมดาเป็น EnhancedTicket
 */
export function enhanceTicket(ticket: Ticket, language: 'th' | 'en' = 'th'): EnhancedTicket {
  const completedOrCancelled = [TICKET_STATUS_IDS.COMPLETED, TICKET_STATUS_IDS.CANCEL] as number[];
  return {
    ...ticket,
    statusName: getStatusName(ticket.status_id, language),
    statusBadgeClass: getStatusBadgeClass(ticket.status_id),
    statusIcon: getStatusIcon(ticket.status_id),
    canEdit: !completedOrCancelled.includes(ticket.status_id),
    canDelete: !completedOrCancelled.includes(ticket.status_id),
    canEvaluate: ticket.status_id === TICKET_STATUS_IDS.COMPLETED,
    availableActions: getAvailableActions(ticket.status_id)
  };
}

// ✅ Export Type สำหรับ Status ID
export type TicketStatusId = typeof TICKET_STATUS_IDS[keyof typeof TICKET_STATUS_IDS];

// ✅ Export ทั้งหมด
export {
  TICKET_STATUS_IDS as StatusIds,
  TICKET_STATUS_NAMES_TH as StatusNamesTh,
  TICKET_STATUS_NAMES_EN as StatusNamesEn
};