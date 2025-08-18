import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

// ✅ Import interfaces จาก user.model.ts ที่อัปเดตแล้ว
import { 
  LoginRequest, 
  LoginResponse, 
  TokenData, 
  User, 
  AuthState,
  UserWithPermissions,
  createEmptyAuthState,
  isLoginSuccessResponse,
  extractTokenData,
  extractUserData,
  createAuthStateFromLoginResponse,
  userHasRole,
  userHasPermission,
  userHasAnyRole,
  userHasAnyPermission,
  AuthStateHelper,
  LOGIN_SUCCESS_CODE 
} from '../models/user.model';

// ✅ Import permission-related types
import { 
  permissionEnum, 
  UserRole, 
  ROLES, 
  ROLE_PERMISSIONS,
  getRolePermissions,
  getPermissionsFromRoles,
  checkUserPermission,
  checkUserRole,
  checkAccess,
  AccessControl
} from '../models/permission.model';

// ✅ Re-export TokenData สำหรับ api.service.ts
export type { TokenData } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  
  // ✅ State Management with proper types
  private authStateSubject = new BehaviorSubject<AuthState>(createEmptyAuthState());
  public authState$ = this.authStateSubject.asObservable();
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // ✅ Token management
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private warningSubject = new BehaviorSubject<boolean>(false);
  private refreshInProgress = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    console.log('🔧 AuthService initialized');
    this.loadUserFromStorage();
    this.initTokenCheck();
  }

  // ===== CORE LOGIN METHOD ===== ✅
  
  /**
   * ✅ เข้าสู่ระบบผ่าน Backend API
   */
  async login(username: string, password: string, language: string = 'th'): Promise<LoginResponse> {
    console.log('🔄 Starting login process for:', username);
    
    try {
      // ✅ Set loading state
      this.updateAuthState({ isLoading: true });

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'language': language
      });

      const body: LoginRequest = {
        username: username.trim(),
        password: password
      };

      console.log('📤 Sending login request to:', `${this.apiUrl}/login`);

      // ✅ เรียก Backend API ตาม endpoint ที่ถูกต้อง
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, body, { headers })
          .pipe(
            tap(res => console.log('📥 Raw backend response:', res)),
            catchError((error: HttpErrorResponse) => this.handleLoginError(error))
          )
      );

      console.log('📋 Processing login response...');
      
      // ✅ Debug login response
      this.debugLoginResponse(response);

      // ✅ ตรวจสอบความสำเร็จของ response
      if (isLoginSuccessResponse(response)) {
        console.log('✅ Login successful, processing tokens and user data');
        console.log('🔍 Backend response data:', {
          hasPermissions: !!response.permission,
          permissionCount: response.permission?.length || 0,
          permissions: response.permission,
          hasRoles: !!response.roles,
          roles: response.roles
        });
        
        // ✅ แยกข้อมูล token และ user
        const tokenData = extractTokenData(response);
        const userData = extractUserData(response);

        if (tokenData && userData) {
          // ✅ บันทึก tokens
          this.setTokens(tokenData);
          
          // ✅ บันทึก user data พร้อม permissions และ roles
          this.setCurrentUser(userData);
          
          // ✅ บันทึก permissions และ roles แยก (สำคัญมาก!)
          if (response.permission && Array.isArray(response.permission)) {
            this.setUserPermissions(response.permission);
            console.log('🔐 Permissions set:', response.permission);
          } else {
            console.warn('⚠️ No permissions received from backend!');
            // ✅ ถ้าไม่ได้รับ permissions ให้ใช้ default ตาม role
            this.setDefaultPermissionsByRole(userData.roles || []);
          }

          if (response.roles && Array.isArray(response.roles)) {
            this.setUserRoles(response.roles);
            console.log('👥 Roles set:', response.roles);
          } else if (userData.roles && Array.isArray(userData.roles)) {
            this.setUserRoles(userData.roles);
            console.log('👥 Roles set from user data:', userData.roles);
          } else {
            console.warn('⚠️ No roles received from backend!');
            // ✅ ถ้าไม่ได้รับ roles ให้ใช้ default
            this.setUserRoles([ROLES.USER]); // Default fallback
          }

          // ✅ อัปเดต auth state ด้วย helper function
          const newAuthState = createAuthStateFromLoginResponse(response, userData, tokenData.access_token);
          this.authStateSubject.next(newAuthState);

          console.log('🎉 Login process completed successfully');
        } else {
          throw new Error('Invalid token or user data in response');
        }
      } else {
        console.log('❌ Login failed:', response.message);
        this.updateAuthState({ isLoading: false });
      }

      return response;

    } catch (error: any) {
      console.error('❌ Login error:', error);
      this.updateAuthState({ isLoading: false });
      
      // ✅ ส่งต่อ error โดยไม่แปลง format
      throw error;
    }
  }

  // ===== TOKEN MANAGEMENT ===== ✅

  /**
   * ✅ บันทึก tokens ลง localStorage
   */
  setTokens(tokenData: TokenData): void {
    try {
      localStorage.setItem('access_token', tokenData.access_token);
      
      if (tokenData.refresh_token) {
        localStorage.setItem('refresh_token', tokenData.refresh_token);
      }
      
      if (tokenData.expires_at) {
        localStorage.setItem('token_expires_at', tokenData.expires_at);
      }
      
      if (tokenData.token_expires_timestamp) {
        localStorage.setItem('token_expires_timestamp', tokenData.token_expires_timestamp.toString());
      }

      this.tokenSubject.next(tokenData.access_token);
      console.log('💾 Tokens saved to localStorage');
      
    } catch (error) {
      console.error('❌ Error saving tokens:', error);
    }
  }

  /**
   * ✅ ดึง access token
   */
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * ✅ ดึง refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  /**
   * ✅ ตรวจสอบว่า token หมดอายุแล้วหรือยัง
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      // ✅ ลอง decode JWT token
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < currentTime;
      
      if (isExpired) {
        console.log('⏰ Token is expired');
      }
      
      return isExpired;
    } catch (error) {
      console.error('❌ Error checking token expiry:', error);
      return true;
    }
  }

  /**
   * ✅ ตรวจสอบว่า token ใกล้หมดอายุหรือยัง (5 นาที)
   */
  isTokenExpiring(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = payload.exp - currentTime;
      return timeLeft <= 300; // 5 minutes
    } catch (error) {
      return false;
    }
  }

  /**
   * ✅ ตรวจสอบว่ามี token ที่ใช้งานได้หรือไม่
   */
  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired();
  }

  // ===== USER MANAGEMENT ===== ✅

  /**
   * ✅ บันทึก user data
   */
  setCurrentUser(user: User | UserWithPermissions): void {
    try {
      localStorage.setItem('user_data', JSON.stringify(user));
      this.currentUserSubject.next(user);
      console.log('👤 User data saved:', user.username);
    } catch (error) {
      console.error('❌ Error saving user data:', error);
    }
  }

  /**
   * ✅ ดึง user data
   */
  getCurrentUser(): User | null {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      return currentUser;
    }

    // ลองดึงจาก localStorage
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        const userData = JSON.parse(userStr);
        this.currentUserSubject.next(userData);
        return userData;
      }
    } catch (error) {
      console.error('❌ Error loading user from storage:', error);
      localStorage.removeItem('user_data');
    }

    return null;
  }

  /**
   * ✅ ดึง user data พร้อม permissions และ roles
   */
  getCurrentUserWithPermissions(): UserWithPermissions | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();

    return {
      ...user,
      permissions,
      roles,
      effective_permissions: permissions
    };
  }

  // ===== PERMISSION MANAGEMENT ===== ✅

  /**
   * ✅ บันทึก permissions (รับ number[] โดยตรง)
   */
  setUserPermissions(permissions: number[]): void {
    try {
      localStorage.setItem('user_permissions', JSON.stringify(permissions));
      console.log('🔐 Permissions saved:', permissions);
    } catch (error) {
      console.error('❌ Error saving permissions:', error);
    }
  }

  /**
   * ✅ ดึง permissions (return number[] โดยตรง)
   */
  getUserPermissions(): number[] {
    try {
      const permStr = localStorage.getItem('user_permissions');
      return permStr ? JSON.parse(permStr) : [];
    } catch (error) {
      console.error('❌ Error loading permissions:', error);
      return [];
    }
  }

  /**
   * ✅ ตรวจสอบสิทธิ์เดี่ยว (รับ number)
   */
  hasPermission(permission: number): boolean {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission);
  }

  /**
   * ✅ ตรวจสอบสิทธิ์หลายตัว (ต้องมีทั้งหมด)
   */
  hasAllPermissions(permissions: number[]): boolean {
    const userPermissions = this.getUserPermissions();
    return permissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * ✅ ตรวจสอบสิทธิ์หลายตัว (มีอย่างน้อย 1 ตัว)
   */
  hasAnyPermission(permissions: number[]): boolean {
    const userPermissions = this.getUserPermissions();
    return permissions.some(permission => userPermissions.includes(permission));
  }

  // ===== ROLE MANAGEMENT ===== ✅

  /**
   * ✅ บันทึก roles
   */
  setUserRoles(roles: UserRole[]): void {
    try {
      localStorage.setItem('user_roles', JSON.stringify(roles));
      console.log('👥 Roles saved:', roles);
    } catch (error) {
      console.error('❌ Error saving roles:', error);
    }
  }

  /**
   * ✅ ดึง roles
   */
  getUserRoles(): UserRole[] {
    try {
      const rolesStr = localStorage.getItem('user_roles');
      return rolesStr ? JSON.parse(rolesStr) : [];
    } catch (error) {
      console.error('❌ Error loading roles:', error);
      return [];
    }
  }

  /**
   * ✅ ตรวจสอบ role เดี่ยว
   */
  hasRole(role: UserRole): boolean {
    const roles = this.getUserRoles();
    return roles.includes(role);
  }

  /**
   * ✅ ตรวจสอบ roles หลายตัว (ต้องมีทั้งหมด)
   */
  hasAllRoles(roles: UserRole[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.every(role => userRoles.includes(role));
  }

  /**
   * ✅ ตรวจสอบ roles หลายตัว (มีอย่างน้อย 1 ตัว)
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * ✅ ตรวจสอบว่าเป็น Admin หรือไม่
   */
  isAdmin(): boolean {
    return this.hasRole(ROLES.ADMIN);
  }

  /**
   * ✅ ตรวจสอบว่าเป็น Supporter หรือไม่
   */
  isSupporter(): boolean {
    return this.hasRole(ROLES.SUPPORTER);
  }

  /**
   * ✅ ตรวจสอบว่าเป็น User หรือไม่
   */
  isUser(): boolean {
    return this.hasRole(ROLES.USER);
  }

  /**
   * ✅ ดึง primary role (role ที่สำคัญที่สุด)
   */
  getPrimaryRole(): UserRole | null {
    if (this.isAdmin()) return ROLES.ADMIN;
    if (this.isSupporter()) return ROLES.SUPPORTER;
    if (this.isUser()) return ROLES.USER;
    return null;
  }

  /**
   * ✅ ดึง permissions ที่ได้จาก roles
   */
  getEffectivePermissions(): number[] {
    const userRoles = this.getUserRoles();
    const directPermissions = this.getUserPermissions();
    const rolePermissions = getPermissionsFromRoles(userRoles);
    
    // รวม permissions จาก roles และ direct permissions
    const allPermissions = [...new Set([...directPermissions, ...rolePermissions])];
    return allPermissions;
  }

  // ===== ACCESS CONTROL ===== ✅

  /**
   * ✅ ตรวจสอบการเข้าถึงแบบรวม (permissions + roles)
   */
  checkAccess(
    requiredPermissions?: number[],
    requiredRoles?: UserRole[]
  ): AccessControl {
    const userPermissions = this.getEffectivePermissions();
    const userRoles = this.getUserRoles();
    
    return checkAccess(userPermissions, userRoles, requiredPermissions, requiredRoles);
  }

  /**
   * ✅ ตรวจสอบว่าสามารถจัดการ tickets ได้หรือไม่
   */
  canManageTickets(): boolean {
    return this.hasAnyPermission([
      13, // VIEW_ALL_TICKETS
      5,  // CHANGE_STATUS
      9   // ASSIGNEE
    ]);
  }

  /**
   * ✅ ตรวจสอบว่าสามารถจัดการ users ได้หรือไม่
   */
  canManageUsers(): boolean {
    return this.hasAnyPermission([
      15, // ADD_USER
      16  // DEL_USER
    ]);
  }

  /**
   * ✅ ตรวจสอบว่าสามารถสร้าง ticket ได้หรือไม่
   */
  canCreateTickets(): boolean {
    return this.hasPermission(1); // CREATE_TICKET
  }

  /**
   * ✅ ตรวจสอบว่าสามารถดู tickets ทั้งหมดได้หรือไม่
   */
  canViewAllTickets(): boolean {
    return this.hasPermission(13); // VIEW_ALL_TICKETS
  }

  /**
   * ✅ ตรวจสอบว่าสามารถดูแค่ tickets ของตัวเองได้หรือไม่
   */
  canViewOwnTicketsOnly(): boolean {
    return this.hasPermission(12) && // VIEW_OWN_TICKETS
           !this.hasPermission(13);  // และไม่มี VIEW_ALL_TICKETS
  }

  // ===== AUTHENTICATION STATUS ===== ✅

  /**
   * ✅ ตรวจสอบการ authentication
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    
    const isAuth = !!(token && user && !this.isTokenExpired());
    
    console.log('🔍 Authentication check:', {
      hasToken: !!token,
      hasUser: !!user,
      tokenExpired: token ? this.isTokenExpired() : 'No token',
      isAuthenticated: isAuth
    });
    
    return isAuth;
  }

  /**
   * ✅ Alias สำหรับ isAuthenticated
   */
  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  // ===== LOGOUT ===== ✅

  /**
   * ✅ ออกจากระบบ
   */
  logout(): void {
    console.log('🚪 Starting logout process');
    
    const refreshToken = this.getRefreshToken();
    
    // ✅ เรียก logout API ถ้ามี refresh token
    if (refreshToken) {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      });

      this.http.post(`${this.apiUrl}/logout`, 
        { refresh_token: refreshToken }, 
        { headers }
      ).subscribe({
        next: () => console.log('✅ Logout API successful'),
        error: (error) => console.error('❌ Logout API failed:', error),
        complete: () => this.clearAuthData()
      });
    } else {
      this.clearAuthData();
    }
  }

  /**
   * ✅ ล้างข้อมูล authentication และ redirect
   */
  clearAuthData(): void {
    console.log('🧹 Clearing authentication data');
    
    // ✅ ล้าง localStorage
    const keysToRemove = [
      'access_token',
      'refresh_token', 
      'token_expires_at',
      'token_expires_timestamp',
      'user_data',
      'user_permissions',
      'user_roles',           // ✅ เพิ่มการล้าง roles
      'remember_me'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // ✅ รีเซ็ต subjects
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    this.warningSubject.next(false);
    this.authStateSubject.next(createEmptyAuthState());
    this.refreshInProgress = false;
    
    console.log('🏠 Redirecting to login page');
    this.router.navigate(['/login']);
  }

  /**
   * ✅ Alias สำหรับ clearAuthData (ใช้ใน api.service.ts)
   */
  clearTokensAndRedirect(): void {
    this.clearAuthData();
  }

  // ===== TOKEN REFRESH (ถ้า Backend รองรับ) ===== ✅

  /**
   * ✅ รีเฟรช access token
   */
  refreshAccessToken(): Observable<TokenData> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => 'No refresh token available');
    }

    if (this.refreshInProgress) {
      // ถ้ากำลัง refresh อยู่ ให้รอ
      return new Observable(observer => {
        const checkInterval = setInterval(() => {
          if (!this.refreshInProgress) {
            clearInterval(checkInterval);
            const newToken = this.getToken();
            if (newToken) {
              observer.next({
                access_token: newToken,
                refresh_token: this.getRefreshToken()!
              });
              observer.complete();
            } else {
              observer.error('Token refresh failed');
            }
          }
        }, 100);
      });
    }

    this.refreshInProgress = true;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = { refresh_token: refreshToken };

    return this.http.post<any>(`${this.apiUrl}/refresh`, body, { headers })
      .pipe(
        tap((response: any) => {
          if (response.access_token) {
            const tokenData: TokenData = {
              access_token: response.access_token,
              refresh_token: response.refresh_token || refreshToken,
              expires_at: response.expires_at
            };
            
            this.setTokens(tokenData);
            this.warningSubject.next(false);
            console.log('✅ Token refreshed successfully');
          } else {
            throw new Error('Invalid refresh response');
          }
          
          this.refreshInProgress = false;
        }),
        catchError((error) => {
          console.error('❌ Token refresh failed:', error);
          this.refreshInProgress = false;
          this.clearAuthData();
          return throwError(() => 'Token refresh failed');
        })
      );
  }

  /**
   * ✅ ตั้งค่า default permissions ตาม roles (fallback)
   */
  private setDefaultPermissionsByRole(roles: UserRole[]): void {
    console.log('🔄 Setting default permissions for roles:', roles);
    
    const defaultPermissions = getPermissionsFromRoles(roles);
    this.setUserPermissions(defaultPermissions);
    
    console.log('✅ Default permissions set:', defaultPermissions);
  }

  /**
   * ✅ Debug method - แสดงข้อมูล login response
   */
  debugLoginResponse(response: LoginResponse): void {
    console.group('🔍 Login Response Debug');
    console.log('Response structure:', {
      code: response.code,
      status: response.status,
      message: response.message,
      hasUser: !!response.user,
      hasToken: !!response.access_token,
      hasPermissions: !!response.permission,
      permissionCount: response.permission?.length || 0,
      permissions: response.permission,
      hasRoles: !!response.roles,
      roles: response.roles
    });
    
    if (response.user) {
      console.log('User data:', response.user);
    }
    
    console.groupEnd();
  }

  /**
   * ✅ โหลด user data จาก localStorage เมื่อเริ่มต้น
   */
  private loadUserFromStorage(): void {
    console.log('📂 Loading user data from storage');
    
    const token = this.getToken();
    const user = this.getCurrentUser();
    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();
    
    if (token && user && !this.isTokenExpired()) {
      console.log('✅ Valid session found, restoring auth state');
      
      this.tokenSubject.next(token);
      this.currentUserSubject.next(user);
      
      this.updateAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: user,
        token: token,
        permissions: permissions,
        roles: roles,                    // ✅ เพิ่ม roles
        last_activity: new Date(),
        effective_permissions: this.getEffectivePermissions() // ✅ เพิ่ม effective permissions
      });
      
    } else {
      console.log('❌ No valid session found');
      this.clearAuthData();
    }
  }

  /**
   * ✅ อัปเดต auth state
   */
  private updateAuthState(updates: Partial<AuthState>): void {
    const currentState = this.authStateSubject.value;
    const newState = { ...currentState, ...updates };
    this.authStateSubject.next(newState);
  }

  /**
   * ✅ จัดการ login errors
   */
  private handleLoginError(error: HttpErrorResponse): Observable<never> {
    console.error('❌ Login API error:', error);
    
    let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
    
    if (error.status === 0) {
      errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบ:\n' +
                    '1. Backend server ทำงานอยู่หรือไม่\n' +
                    '2. IP address ถูกต้องหรือไม่\n' +
                    '3. Port 3000 เปิดอยู่หรือไม่';
    } else if (error.status === 404) {
      errorMessage = 'ไม่พบ API endpoint กรุณาตรวจสอบ:\n' +
                    '1. Backend API path ถูกต้องหรือไม่\n' +
                    '2. Route /api/login มีอยู่หรือไม่';
    } else if (error.status === 401) {
      errorMessage = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    } else if (error.status === 403) {
      errorMessage = 'บัญชีของคุณถูกระงับการใช้งาน';
    } else if (error.status === 429) {
      errorMessage = 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    // ✅ เพิ่มข้อมูล debug ใน console
    console.error('🔍 Debug info:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: error.message,
      error: error.error
    });
    
    return throwError(() => new Error(errorMessage));
  }

  /**
   * ✅ ตั้งค่า token check timer
   */
  private initTokenCheck(): void {
    setInterval(() => {
      const token = this.getToken();
      
      if (!token) return;

      if (this.isTokenExpired()) {
        console.log('⏰ Token expired, attempting refresh...');
        this.refreshAccessToken().subscribe({
          next: () => console.log('✅ Auto refresh successful'),
          error: (error) => {
            console.error('❌ Auto refresh failed:', error);
            // AuthService จะ auto logout ใน refreshAccessToken method
          }
        });
      } else if (this.isTokenExpiring() && !this.warningSubject.value) {
        console.log('⚠️ Token expiring soon, showing warning');
        this.warningSubject.next(true);
        
        // Auto refresh เมื่อใกล้หมดอายุ
        this.refreshAccessToken().subscribe({
          next: () => console.log('✅ Proactive refresh successful'),
          error: (error) => console.error('❌ Proactive refresh failed:', error)
        });
      }
    }, 30000); // ตรวจสอบทุก 30 วินาที
  }

  // ===== OBSERVABLE GETTERS ===== ✅

  /**
   * ✅ ดู warning status (token ใกล้หมดอายุ)
   */
  getWarningStatus(): Observable<boolean> {
    return this.warningSubject.asObservable();
  }

  /**
   * ✅ ดู token changes
   */
  getTokenChanges(): Observable<string | null> {
    return this.tokenSubject.asObservable();
  }

  /**
   * ✅ Manual refresh สำหรับ UI
   */
  manualRefresh(): Observable<TokenData> {
    return this.refreshAccessToken();
  }

  // ===== ADVANCED PERMISSION METHODS ===== ✅

  /**
   * ✅ ตรวจสอบ permission พร้อม fallback logic
   */
  hasPermissionWithFallback(permission: permissionEnum, fallbackRoles?: UserRole[]): boolean {
    // ตรวจสอบ direct permission ก่อน
    if (this.hasPermission(permission)) {
      return true;
    }
    
    // ถ้าไม่มี ลองตรวจสอบผ่าน roles
    if (fallbackRoles && this.hasAnyRole(fallbackRoles)) {
      return true;
    }
    
    // ตรวจสอบผ่าน role permissions mapping
    const userRoles = this.getUserRoles();
    return userRoles.some(role => {
      const rolePermissions = getRolePermissions(role);
      return rolePermissions.includes(permission);
    });
  }

  /**
   * ✅ ดึงรายการ permissions ที่ขาดหายไป
   */
  getMissingPermissions(requiredPermissions: number[]): number[] {
    const userPermissions = this.getEffectivePermissions();
    return requiredPermissions.filter(permission => !userPermissions.includes(permission));
  }

  /**
   * ✅ ดึงรายการ roles ที่ขาดหายไป
   */
  getMissingRoles(requiredRoles: UserRole[]): UserRole[] {
    const userRoles = this.getUserRoles();
    return requiredRoles.filter(role => !userRoles.includes(role));
  }

  // ===== DEBUG METHODS ===== ✅

  /**
   * ✅ Debug authentication status
   */
  debugAuthStatus(): void {
    console.group('🔍 Authentication Debug Info');
    
    const token = this.getToken();
    const user = this.getCurrentUser();
    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();
    const effectivePermissions = this.getEffectivePermissions();
    
    console.log('📋 Basic Info:', {
      hasToken: !!token,
      hasUser: !!user,
      permissionCount: permissions.length,
      roleCount: roles.length,
      effectivePermissionCount: effectivePermissions.length
    });
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('🔑 Token Info:', {
          userId: payload.sub || payload.user_id,
          username: payload.username,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          isExpired: this.isTokenExpired(),
          isExpiring: this.isTokenExpiring()
        });
      } catch (error) {
        console.error('❌ Cannot decode token:', error);
      }
    }
    
    if (user) {
      console.log('👤 User Info:', {
        id: user.id,
        username: user.username,
        fullName: `${user.firstname} ${user.lastname}`
      });
    }
    
    console.log('🔐 Auth Methods:', {
      isAuthenticated: this.isAuthenticated(),
      hasValidToken: this.hasValidToken(),
      isLoggedIn: this.isLoggedIn(),
      isAdmin: this.isAdmin(),
      isSupporter: this.isSupporter(),
      isUser: this.isUser(),
      primaryRole: this.getPrimaryRole()
    });
    
    console.log('🔐 Permissions:', permissions);
    console.log('👥 Roles:', roles);
    console.log('⚡ Effective Permissions:', effectivePermissions);
    
    console.log('🎯 Access Control:', {
      canManageTickets: this.canManageTickets(),
      canManageUsers: this.canManageUsers(),
      canCreateTickets: this.canCreateTickets(),
      canViewAllTickets: this.canViewAllTickets(),
      canViewOwnTicketsOnly: this.canViewOwnTicketsOnly()
    });
    
    console.groupEnd();
  }

  /**
   * ✅ ดู token info
   */
  getTokenInfo(): any {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = payload.exp - currentTime;
      
      return {
        user_id: payload.sub || payload.user_id,
        username: payload.username,
        expires_at: new Date(payload.exp * 1000).toISOString(),
        time_left_seconds: timeLeft,
        time_left_minutes: Math.floor(timeLeft / 60),
        is_expired: timeLeft <= 0,
        is_expiring: timeLeft <= 300
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * ✅ ตรวจสอบสถานะ permission ปัจจุบัน
   */
  checkCurrentPermissionStatus(): void {
    console.group('🔍 Current Permission Status');
    
    const user = this.getCurrentUser();
    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();
    const effectivePermissions = this.getEffectivePermissions();
    
    console.log('Current Status:', {
      isAuthenticated: this.isAuthenticated(),
      hasUser: !!user,
      username: user?.username,
      rolesCount: roles.length,
      roles: roles,
      directPermissions: permissions.length,
      directPermissionsList: permissions,
      effectivePermissions: effectivePermissions.length,
      effectivePermissionsList: effectivePermissions,
      isAdmin: this.isAdmin(),
      isSupporter: this.isSupporter(),
      isUser: this.isUser(),
      canManageTickets: this.canManageTickets(),
      canViewAllTickets: this.canViewAllTickets()
    });
    
    // ✅ ตรวจสอบข้อมูลใน localStorage
    console.log('LocalStorage Data:', {
      hasUserData: !!localStorage.getItem('user_data'),
      hasPermissions: !!localStorage.getItem('user_permissions'),
      hasRoles: !!localStorage.getItem('user_roles'),
      hasToken: !!localStorage.getItem('access_token')
    });
    
    console.groupEnd();
  }

  /**
   * ✅ Debug permissions ใน localStorage
   */
  debugPermissionsInStorage(): void {
    console.group('🔍 Permissions Storage Debug');
    
    const permStr = localStorage.getItem('user_permissions');
    const rolesStr = localStorage.getItem('user_roles');
    
    console.log('Raw localStorage data:', {
      permissions: permStr,
      roles: rolesStr
    });
    
    if (permStr) {
      try {
        const parsedPermissions = JSON.parse(permStr);
        console.log('Parsed permissions:', {
          type: typeof parsedPermissions,
          isArray: Array.isArray(parsedPermissions),
          length: parsedPermissions?.length,
          values: parsedPermissions,
          mapped: parsedPermissions?.map((p: any) => ({
            original: p,
            type: typeof p,
            asNumber: parseInt(p, 10),
            isValid: !isNaN(parseInt(p, 10))
          }))
        });
      } catch (error) {
        console.error('Error parsing permissions:', error);
      }
    }
    
    console.log('Current getUserPermissions():', this.getUserPermissions());
    console.log('Current getUserRoles():', this.getUserRoles());
    
    console.groupEnd();
  }

  /**
   * ✅ ดึงข้อมูล auth state สำหรับ debug
   */
  getAuthState(): AuthState {
    return this.authStateSubject.value;
  }

  /**
   * ✅ ดึงสถิติการใช้งาน
   */
  getUsageStats(): {
    loginTime: Date | null;
    lastActivity: Date | null;
    sessionDuration: number;
    tokenRefreshCount: number;
  } {
    const authState = this.getAuthState();
    const loginTime = authState.last_activity;
    const now = new Date();
    
    return {
      loginTime: loginTime,
      lastActivity: authState.last_activity,
      sessionDuration: loginTime ? now.getTime() - loginTime.getTime() : 0,
      tokenRefreshCount: 0 // TODO: implement refresh counter if needed
    };
  }
}