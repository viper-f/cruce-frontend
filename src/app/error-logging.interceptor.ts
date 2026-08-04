import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MonitorService } from './services/monitor.service';

export const errorLoggingInterceptor: HttpInterceptorFn = (req, next) => {
  const monitor = inject(MonitorService);

  return next(req).pipe(
    catchError(error => {
      monitor.track('api_error', {
        method: req.method,
        endpoint: req.urlWithParams,
        status: error.status,
        error: error.error?.error || error.error?.message || error.message || 'Unknown error',
      });
      return throwError(() => error);
    })
  );
};
