import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  code?: string;
  status?: number;
  message: string;
  data: T;
}

export interface TicketData {
  id?: number;
  ticket_no?: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id?: number;
  hour_estimate?: number;
  estimate_time?: string;
  due_date?: string;
  lead_time?: number;
  related_ticket_id?: number;
  change_request?: boolean;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

export interface ProjectData {
  id: number;
  name: string;
  create_by: number;
  isenabled: boolean;
}

export interface CustomerData {
  id: number;
  name: string;
  address: string;
  telephone: string;
  email: string;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
}

export interface UserData {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  start_date: string;
  end_date: string;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Helper method สำหรับสร้าง headers พร้อม token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Helper method สำหรับจัดการ errors
  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    return throwError(() => error);
  }

  // User APIs
  getUsers(): Observable<ApiResponse<UserData[]>> {
    return this.http.get<ApiResponse<UserData[]>>(`${this.apiUrl}/users`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getUserById(id: number): Observable<ApiResponse<UserData>> {
    return this.http.get<ApiResponse<UserData>>(`${this.apiUrl}/users/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Customer For Project APIs
  getCustomerForProject(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/customer-for-project`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCustomerForProjectById(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCustomerForProject(id: number, data: any): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCustomerForProject(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/customer-for-project`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCustomerForProject(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Project APIs
  getProjects(): Observable<ApiResponse<ProjectData[]>> {
    return this.http.get<ApiResponse<ProjectData[]>>(`${this.apiUrl}/project`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getProjectById(id: number): Observable<ApiResponse<ProjectData>> {
    return this.http.get<ApiResponse<ProjectData>>(`${this.apiUrl}/project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createProject(data: Partial<ProjectData>): Observable<ApiResponse<ProjectData>> {
    return this.http.post<ApiResponse<ProjectData>>(`${this.apiUrl}/project`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateProject(id: number, data: Partial<ProjectData>): Observable<ApiResponse<ProjectData>> {
    return this.http.patch<ApiResponse<ProjectData>>(`${this.apiUrl}/project/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteProject(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Customer APIs
  getCustomers(): Observable<ApiResponse<CustomerData[]>> {
    return this.http.get<ApiResponse<CustomerData[]>>(`${this.apiUrl}/customer`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCustomerById(id: number): Observable<ApiResponse<CustomerData>> {
    return this.http.get<ApiResponse<CustomerData>>(`${this.apiUrl}/customer/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCustomer(data: Partial<CustomerData>): Observable<ApiResponse<CustomerData>> {
    return this.http.post<ApiResponse<CustomerData>>(`${this.apiUrl}/customer`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCustomer(id: number, data: Partial<CustomerData>): Observable<ApiResponse<CustomerData>> {
    return this.http.patch<ApiResponse<CustomerData>>(`${this.apiUrl}/customer/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCustomer(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/customer/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Ticket APIs
  getTickets(): Observable<ApiResponse<TicketData[]>> {
    return this.http.get<ApiResponse<TicketData[]>>(`${this.apiUrl}/ticket`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getTicketById(id: number): Observable<ApiResponse<TicketData>> {
    return this.http.get<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createTicket(data: Partial<TicketData>): Observable<ApiResponse<TicketData>> {
    return this.http.post<ApiResponse<TicketData>>(`${this.apiUrl}/ticket`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateTicket(id: number, data: Partial<TicketData>): Observable<ApiResponse<TicketData>> {
    return this.http.patch<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteTicket(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/ticket/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Ticket Categories APIs
  getTicketCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/ticket-categories`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Ticket Status APIs
  getTicketStatuses(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/ticket-status`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Dashboard/Statistics APIs
  getDashboardStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/dashboard/stats`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // File Upload API (สำหรับ ticket attachments)
  uploadFile(file: File, ticketId?: number): Observable<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (ticketId) {
      formData.append('ticket_id', ticketId.toString());
    }

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
      // ไม่ใส่ Content-Type ให้ browser จัดการเอง สำหรับ multipart/form-data
    });

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/upload`, formData, {
      headers: headers
    }).pipe(catchError(this.handleError));
  }
}
