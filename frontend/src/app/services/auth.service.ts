import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthUser } from '../models/case.model';

const DEMO_CITIZEN: AuthUser = {
  userId: 'usr-citizen-01',
  username: 'citizen',
  fullName: 'Ananya Sharma (Citizen)',
  role: 'Citizen',
  email: 'citizen@civiclens.local',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItY2l0aXplbi0wMSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoidXNyLWNpdGl6ZW4tMDEiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiY2l0aXplbiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6ImNpdGl6ZW5AY2l2aWNsZW5zLmxvY2FsIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQ2l0aXplbiIsIkZ1bGxOYW1lIjoiQW5hbnlhIFNoYXJtYSAoQ2l0aXplbikiLCJleHAiOjE3OTI2MDUzMTksImlzcyI6IkNpdmljTGVuc0FwaSIsImF1ZCI6IkNpdmljTGVuc0NsaWVudCJ9.ftL9RdpPv5nkURwd-z8PROZq5BdX_wVcnwMa0y8NLMc'
};

const DEMO_REVIEWER: AuthUser = {
  userId: 'usr-reviewer-01',
  username: 'reviewer',
  fullName: 'Vikram Patel (Municipal Reviewer)',
  role: 'Reviewer',
  email: 'reviewer@civiclens.local',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItcmV2aWV3ZXItMDEiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6InVzci1yZXZpZXdlci0wMSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiJyZXZpZXdlciIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6InJldmlld2VyQGNpdmljbGVucy5sb2NhbCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IlJldmlld2VyIiwiRnVsbE5hbWUiOiJWaWtyYW0gUGF0ZWwgKE11bmljaXBhbCBSZXZpZXdlcikiLCJleHAiOjE3OTI2MDU2ODQsImlzcyI6IkNpdmljTGVuc0FwaSIsImF1ZCI6IkNpdmljTGVuc0NsaWVudCJ9.qs0l219p76f7-nhRc7WhZy2KDz4YDZlrJgyh5FFSXqg'
};

const DEMO_ADMIN: AuthUser = {
  userId: 'usr-admin-01',
  username: 'admin',
  fullName: 'Civic Operations Admin',
  role: 'Administrator',
  email: 'admin@civiclens.local',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItYWRtaW4tMDEiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6InVzci1hZG1pbi0wMSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiJhZG1pbiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6ImFkbWluQGNpdmljbGVucy5sb2NhbCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFkbWluaXN0cmF0b3IiLCJGdWxsTmFtZSI6IkNpdmljIE9wZXJhdGlvbnMgQWRtaW4iLCJleHAiOjE3OTI2MDUzMTksImlzcyI6IkNpdmljTGVuc0FwaSIsImF1ZCI6IkNpdmljTGVuc0NsaWVudCJ9.4P_m162q0J3gT0vT13d81zELeQO3lR_qO0P-s-sRkZg'
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';
  // Initialize immediately with DEMO_CITIZEN so token is never null on initial render
  currentUser = signal<AuthUser>(DEMO_CITIZEN);

  constructor(private http: HttpClient) {
    this.loadStoredUser();
  }

  private loadStoredUser() {
    const raw = localStorage.getItem('civiclens_user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        if (user && user.token) {
          this.currentUser.set(user);
          return;
        }
      } catch {
        localStorage.removeItem('civiclens_user');
      }
    }
    // Set default citizen and persist
    this.currentUser.set(DEMO_CITIZEN);
    localStorage.setItem('civiclens_user', JSON.stringify(DEMO_CITIZEN));
  }

  login(usernameOrEmail: string, password: string): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.apiUrl}/login`, { usernameOrEmail, password }).pipe(
      tap(user => {
        this.currentUser.set(user);
        localStorage.setItem('civiclens_user', JSON.stringify(user));
      })
    );
  }

  register(fullName: string, email: string, username: string, password: string, role: string = 'Citizen'): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.apiUrl}/register`, { fullName, email, username, password, role }).pipe(
      tap(user => {
        this.currentUser.set(user);
        localStorage.setItem('civiclens_user', JSON.stringify(user));
      })
    );
  }

  loginWithDemoRole(role: 'Citizen' | 'Reviewer' | 'Administrator'): Observable<AuthUser> {
    const preset = role === 'Reviewer' ? DEMO_REVIEWER : (role === 'Administrator' ? DEMO_ADMIN : DEMO_CITIZEN);
    // Instantly set synchronously
    this.currentUser.set(preset);
    localStorage.setItem('civiclens_user', JSON.stringify(preset));

    const credentials = {
      'Citizen': { usernameOrEmail: 'citizen@civiclens.local', password: 'Citizen123!' },
      'Reviewer': { usernameOrEmail: 'reviewer@civiclens.local', password: 'Reviewer123!' },
      'Administrator': { usernameOrEmail: 'admin@civiclens.local', password: 'Admin123!' }
    }[role];

    return this.login(credentials.usernameOrEmail, credentials.password);
  }

  logout() {
    localStorage.removeItem('civiclens_user');
    this.currentUser.set(DEMO_CITIZEN);
  }

  getToken(): string | null {
    return this.currentUser().token;
  }

  isCitizen(): boolean {
    return this.currentUser().role === 'Citizen';
  }

  isReviewer(): boolean {
    const role = this.currentUser().role;
    return role === 'Reviewer' || role === 'Administrator';
  }

  isAdmin(): boolean {
    return this.currentUser().role === 'Administrator';
  }
}
