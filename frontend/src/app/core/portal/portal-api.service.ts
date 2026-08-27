import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { catchError, firstValueFrom, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { PortalSessionService } from "./portal-session.service";

/**
 * Client HTTP dédié au portail public: ajoute X-Portal-Token (pas le Bearer
 * Firebase de l'intercepteur global, ces requêtes n'ont pas de compte).
 */
@Injectable({
  providedIn: "root"
})
export class PortalApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(PortalSessionService);

  get<T>(url: string): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${environment.apiUrl}/portal/${url}`, { headers: this.headers() }).pipe(
        catchError(this.handleError)
      )
    );
  }

  post<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${environment.apiUrl}/portal/${url}`, body, { headers: this.headers() }).pipe(
        catchError(this.handleError)
      )
    );
  }

  put<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(
      this.http.put<T>(`${environment.apiUrl}/portal/${url}`, body, { headers: this.headers() }).pipe(
        catchError(this.handleError)
      )
    );
  }

  delete<T>(url: string): Promise<T> {
    return firstValueFrom(
      this.http.delete<T>(`${environment.apiUrl}/portal/${url}`, { headers: this.headers() }).pipe(
        catchError(this.handleError)
      )
    );
  }

  private headers(): HttpHeaders {
    const token = this.session.token();
    return token ? new HttpHeaders({ "X-Portal-Token": token }) : new HttpHeaders();
  }

  private handleError = (error: HttpErrorResponse) => {
    if (error.status === 401) {
      this.session.clear();
    }
    const message = error.error?.error?.message || `Erreur: ${error.status}`;
    return throwError(() => new Error(message));
  };
}
