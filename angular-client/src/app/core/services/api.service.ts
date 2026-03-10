import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T = any>(url: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<T>(url, { params: httpParams, withCredentials: true });
  }

  post<T = any>(url: string, body?: any): Observable<T> {
    return this.http.post<T>(url, body || {}, { withCredentials: true });
  }

  put<T = any>(url: string, body?: any): Observable<T> {
    return this.http.put<T>(url, body || {}, { withCredentials: true });
  }

  delete<T = any>(url: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.delete<T>(url, { params: httpParams, withCredentials: true });
  }
}
