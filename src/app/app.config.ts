import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { AuthInterceptor } from './shared/services/api.service'; // ✅ Import AuthInterceptor

export const appConfig: ApplicationConfig = {
  providers: [
    // ✅ Zone.js configuration for performance
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // ✅ Router configuration
    provideRouter(routes),
    
    // ✅ HTTP Client configuration
    provideHttpClient(
      withInterceptors([]) // ✅ Modern interceptor approach
    ),
    
    // ✅ Legacy HTTP Interceptor for backward compatibility
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    
    // ✅ Import FormsModule for template-driven forms
    importProvidersFrom(FormsModule)
    
    // ✅ หมายเหตุ: Service Worker จะถูกจัดการใน main.ts แทน
    // เพื่อหลีกเลี่ยงปัญหา import ใน development mode
  ]
};