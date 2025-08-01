import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthInterceptor } from './shared/services/api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(),
    
    // ✅ เพิ่ม HTTP Interceptor สำหรับ Auto Token Management
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
    
    // ✅ หมายเหตุ: Service Worker จะถูกจัดการใน main.ts แทน
    // เพื่อหลีกเลี่ยงปัญหา import ใน development mode
  ]
};