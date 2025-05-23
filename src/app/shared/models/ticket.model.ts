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
