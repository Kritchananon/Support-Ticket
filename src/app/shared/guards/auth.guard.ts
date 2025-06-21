import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Auth Guard checking authentication...');
  console.log('Token exists:', !!authService.getToken());
  console.log('Token valid:', authService.hasValidToken());

  if (authService.hasValidToken()) {
    console.log('Authentication successful, allowing access');
    return true;
  }

  // ถ้า token หมดอายุแต่มี refresh token ให้ลอง refresh
  const refreshToken = authService.getRefreshToken();
  if (refreshToken) {
    console.log('Token expired but refresh token available, allowing access');
    return true; // ให้ interceptor จัดการ refresh
  }

  console.log('No valid token, redirecting to login');
  authService.clearTokensAndRedirect();
  return false;
};