import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { catchError, filter, switchMap, take, throwError } from 'rxjs';
import { Observable } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authToken = authService.authToken();

  // Skip auth endpoints to avoid infinite loops
  if (req.url.includes('/refresh') || req.url.includes('/login')) {
    return next(req);
  }

  // Proactively refresh if token is expired before even sending the request
  if (authToken && authService.isAccessTokenExpired()) {
    return handle401Error(req, next, authService);
  }

  if (authToken) {
    req = addTokenHeader(req, authToken);
  }

  return next(req).pipe(
    catchError(error => {
      if (error.status === 401) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

const handle401Error = (request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService): Observable<HttpEvent<any>> => {
  if (!authService.isRefreshing) {
    authService.isRefreshing = true;
    authService.refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        authService.isRefreshing = false;
        authService.refreshTokenSubject.next(response.access_token);
        return next(addTokenHeader(request, response.access_token));
      }),
      catchError((err) => {
        authService.isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      })
    );
  } else {
    return authService.refreshTokenSubject.pipe(
      filter(token => token != null),
      take(1),
      switchMap(token => next(addTokenHeader(request, token as string)))
    );
  }
}

const addTokenHeader = (request: HttpRequest<any>, token: string) => {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
