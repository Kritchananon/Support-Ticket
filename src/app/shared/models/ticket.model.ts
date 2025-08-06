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
  status_id?: number;
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
  COMPLETE = 'Complete',
  PENDING = 'Pending', 
  OPEN_TICKET = 'open ticket',
  IN_PROGRESS = 'In progress',
  RESOLVED = 'Resolved',
  CANCEL = 'Cancel'
}

// ✅ เพิ่ม Interface สำหรับ Action Dropdown Option
export interface ActionDropdownOption {
  value: SupporterActionType;
  label: string;
  statusId: number;
  disabled?: boolean;
  description?: string;
}