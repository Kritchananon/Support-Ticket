import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  loginData = {
    username: '',
    password: '',
    rememberMe: false
  };

  isLoading = false;
  errorMessage = '';
  showPassword = false;
  currentLanguage = 'th';

  ngOnInit(): void {
    // ถ้า login แล้วให้ redirect ไปหน้าหลัก
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onLogin() {
    if (!this.loginData.username || !this.loginData.password) {
      this.errorMessage = this.currentLanguage === 'th' 
        ? 'กรุณากรอกข้อมูลให้ครบถ้วน' 
        : 'Please fill in all required fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const response = await this.authService.login(
        this.loginData.username,
        this.loginData.password,
        this.currentLanguage
      );

      console.log('Full login response:', response);

      // ตรวจสอบ response แบบละเอียด
      const isSuccess = response.code === '2' || 
                       response.code === 2 || 
                       response.status === true || 
                       response.status === 1 ||
                       (response.message && response.message.toLowerCase().includes('success'));

      if (isSuccess) {
        // Save remember me preference
        if (this.loginData.rememberMe) {
          localStorage.setItem('remember_me', 'true');
        }

        console.log('Login successful, navigating to dashboard...');
        
        // Navigate to dashboard
        const navigationResult = await this.router.navigate(['/dashboard']);
        console.log('Navigation result:', navigationResult);
        
        if (!navigationResult) {
          console.error('Navigation failed!');
        }
      } else {
        this.errorMessage = response.message || 
          (this.currentLanguage === 'th' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMessage = error.message || 
        (this.currentLanguage === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' : 'An error occurred. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  switchLanguage(lang: string) {
    this.currentLanguage = lang;
    // You can add language service here to handle global language switching
  }

  getLanguageText(thText: string, enText: string): string {
    return this.currentLanguage === 'th' ? thText : enText;
  }
}
