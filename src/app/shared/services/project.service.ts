import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { ProjectDDL, ProjectDDLRequest, ProjectDDLResponse } from '../models/project.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Helper method สำหรับสร้าง headers พร้อม token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // API ใหม่จาก NestJS
  getProjectDDL(request: ProjectDDLRequest = { status: 'active' }): Observable<ProjectDDLResponse> {
    return this.http.post<ProjectDDLResponse>(`${this.apiUrl}/getProjectDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(2), // ลองใหม่ 2 ครั้งถ้าล้มเหลว
      catchError(this.handleError)
    );
  }

  // Method สำหรับดึงข้อมูลโปรเจคทั้งหมด
  getAllProjects(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'all' });
  }

  // Method สำหรับดึงข้อมูลโปรเจคที่ active เท่านั้น
  getActiveProjects(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'active' });
  }

  // Method สำหรับดึงข้อมูลโปรเจคที่ inactive เท่านั้น
  getInactiveProjects(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'inactive' });
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 401:
          errorMessage = 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่';
          // อาจจะต้อง redirect ไป login
          break;
        case 403:
          errorMessage = 'ไม่มีสิทธิ์ในการดำเนินการนี้';
          break;
        case 404:
          errorMessage = 'ไม่พบข้อมูลที่ต้องการ';
          break;
        case 500:
          errorMessage = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์';
          break;
        default:
          errorMessage = `Server Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('ProjectService Error:', errorMessage);
    return throwError(() => errorMessage);
  }
}
