import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, firstValueFrom, throwError } from "rxjs";
import { environment } from "../../environments/environment";

export interface RequestOptions {
  params?: HttpParams | Record<string, string | number | boolean>;
}

@Injectable({
  providedIn: "root"
})
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, options?: RequestOptions): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${environment.apiUrl}/${url}`, options).pipe(catchError(this.handleError))
    );
  }

  post<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${environment.apiUrl}/${url}`, body, options).pipe(catchError(this.handleError))
    );
  }

  put<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
    return firstValueFrom(
      this.http.put<T>(`${environment.apiUrl}/${url}`, body, options).pipe(catchError(this.handleError))
    );
  }

  delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return firstValueFrom(
      this.http.delete<T>(`${environment.apiUrl}/${url}`, options).pipe(catchError(this.handleError))
    );
  }

  private handleError(error: HttpErrorResponse) {
    const message = error.error?.error?.message || `Erreur API: ${error.status} - ${error.message}`;
    return throwError(() => new Error(message));
  }
}
