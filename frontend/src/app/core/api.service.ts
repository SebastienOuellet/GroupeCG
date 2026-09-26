import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, firstValueFrom, Observable, throwError } from "rxjs";
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

  /** Fichier binaire (ex. PDF). En erreur, le corps JSON arrive lui aussi en Blob : on le décode. */
  getBlob(url: string, options?: RequestOptions): Promise<Blob> {
    return this.blobRequest(this.http.get(`${environment.apiUrl}/${url}`, { ...options, responseType: "blob" }));
  }

  /** POST qui renvoie un fichier binaire (ex. aperçu PDF calculé à partir du corps). */
  postBlob(url: string, body: unknown, options?: RequestOptions): Promise<Blob> {
    return this.blobRequest(this.http.post(`${environment.apiUrl}/${url}`, body, { ...options, responseType: "blob" }));
  }

  private async blobRequest(request: Observable<Blob>): Promise<Blob> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      let message = `Erreur API: ${httpError.status} - ${httpError.message}`;
      if (httpError.error instanceof Blob) {
        try {
          message = JSON.parse(await httpError.error.text())?.error?.message || message;
        } catch {
          /* corps non JSON : message générique */
        }
      }
      throw new Error(message);
    }
  }

  private handleError(error: HttpErrorResponse) {
    const message = error.error?.error?.message || `Erreur API: ${error.status} - ${error.message}`;
    return throwError(() => new Error(message));
  }
}
