import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    const token = this.authService.authToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  get<T>(endpoint: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, {
      headers: this.getHeaders(),
      params
    });
  }

  getText(endpoint: string): Observable<string> {
    return this.http.get(`${this.apiUrl}/${endpoint}`, {
      headers: this.getHeaders(),
      responseType: 'text'
    });
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body, {
      headers: this.getHeaders()
    });
  }

  postForm<T>(endpoint: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, formData, {
      headers: this.getHeaders()
    });
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${endpoint}`, body, {
      headers: this.getHeaders()
    });
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}/${endpoint}`, {
      headers: this.getHeaders()
    });
  }
}
