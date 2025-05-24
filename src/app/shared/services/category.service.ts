import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { CategoryDDL, CategoryDDLRequest, CategoryDDLResponse } from '../models/category.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
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
  getCategoriesDDL(request: CategoryDDLRequest = { status: 'active' }): Observable<CategoryDDLResponse> {
    return this.http.post<CategoryDDLResponse>(`${this.apiUrl}/getCategoriesDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(2), // ลองใหม่ 2 ครั้งถ้าล้มเหลว
      catchError(this.handleError)
    );
  }

  // Method สำหรับดึงข้อมูลหมวดหมู่ทั้งหมด
  getAllCategories(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'all' });
  }

  // Method สำหรับดึงข้อมูลหมวดหมู่ที่ active เท่านั้น
  getActiveCategories(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'active' });
  }

  // Method สำหรับดึงข้อมูลหมวดหมู่ที่ inactive เท่านั้น
  getInactiveCategories(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'inactive' });
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
    
    console.error('CategoryService Error:', errorMessage);
    return throwError(() => errorMessage);
  }
}
