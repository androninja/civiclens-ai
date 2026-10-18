import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CivicCase, ServiceTeam, CaseActivityLog, DuplicateRelation, UserNotification, DashboardMetrics } from '../models/case.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = '/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Cases API
  getCases(filters?: {
    category?: string;
    priority?: string;
    status?: string;
    assignedTeamId?: string;
    search?: string;
  }): Observable<CivicCase[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.category) params = params.set('category', filters.category);
      if (filters.priority) params = params.set('priority', filters.priority);
      if (filters.status) params = params.set('status', filters.status);
      if (filters.assignedTeamId) params = params.set('assignedTeamId', filters.assignedTeamId);
      if (filters.search) params = params.set('search', filters.search);
    }
    return this.http.get<CivicCase[]>(`${this.baseUrl}/cases`, {
      headers: this.getHeaders(),
      params
    });
  }

  getCaseById(id: string): Observable<CivicCase> {
    return this.http.get<CivicCase>(`${this.baseUrl}/cases/${id}`, {
      headers: this.getHeaders()
    });
  }

  createCase(data: {
    description: string;
    category?: string;
    language?: string;
    audioUrl?: string;
    originalTranscript?: string;
    editedTranscript?: string;
    photoUrl?: string;
    locationAddress?: string;
    latitude?: number;
    longitude?: number;
  }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases`, data, {
      headers: this.getHeaders()
    });
  }

  updateCaseLocation(id: string, data: { latitude: number; longitude: number; address?: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/location`, data, {
      headers: this.getHeaders()
    });
  }

  updateCase(id: string, data: {
    title?: string;
    description?: string;
    category?: string;
    locationAddress?: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
  }): Observable<CivicCase> {
    return this.http.put<CivicCase>(`${this.baseUrl}/cases/${id}`, data, {
      headers: this.getHeaders()
    });
  }

  deleteCase(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cases/${id}`, {
      headers: this.getHeaders()
    });
  }

  assignTeam(id: string, data: { teamId: string; targetResponseHours?: number; notes?: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/assign`, data, {
      headers: this.getHeaders()
    });
  }

  updateStatus(id: string, data: { status: string; notes?: string; rejectionReason?: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/status`, data, {
      headers: this.getHeaders()
    });
  }

  overridePriority(id: string, data: { priority: string; rationale: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/priority-override`, data, {
      headers: this.getHeaders()
    });
  }

  submitResolution(id: string, data: { resolutionPhotoUrl: string; resolutionDescription: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/resolution`, data, {
      headers: this.getHeaders()
    });
  }

  verifyResolution(id: string, data: { approved: boolean; rejectionReason?: string; notes?: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/verify-resolution`, data, {
      headers: this.getHeaders()
    });
  }

  requestCitizenReview(id: string, data: { reason: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/dispute`, data, {
      headers: this.getHeaders()
    });
  }

  reopenCase(id: string, data: { reason: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/reopen`, data, {
      headers: this.getHeaders()
    });
  }

  reviewDuplicate(id: string, data: { action: 'confirm' | 'reject'; primaryCaseId?: string }): Observable<CivicCase> {
    return this.http.post<CivicCase>(`${this.baseUrl}/cases/${id}/review-duplicate`, data, {
      headers: this.getHeaders()
    });
  }

  getActivityLogs(id: string): Observable<CaseActivityLog[]> {
    return this.http.get<CaseActivityLog[]>(`${this.baseUrl}/cases/${id}/activity`, {
      headers: this.getHeaders()
    });
  }

  getDuplicates(id: string): Observable<DuplicateRelation[]> {
    return this.http.get<DuplicateRelation[]>(`${this.baseUrl}/cases/${id}/duplicates`, {
      headers: this.getHeaders()
    });
  }

  getNotifications(): Observable<UserNotification[]> {
    return this.http.get<UserNotification[]>(`${this.baseUrl}/cases/notifications`, {
      headers: this.getHeaders()
    });
  }

  // Media API
  uploadPhoto(file: File): Observable<{ url: string; storageProvider: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; storageProvider: string; fileName: string }>(
      `${this.baseUrl}/media/upload-photo`,
      formData,
      { headers: this.getHeaders() }
    );
  }

  transcribeVoice(audioBlob: Blob, fileName: string, language: string = 'en', clientTranscript?: string): Observable<{
    transcript: string;
    detectedLanguage: string;
    confidence: number;
    provider: string;
    audioUrl: string;
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, fileName);
    formData.append('language', language);
    if (clientTranscript && clientTranscript.trim()) {
      formData.append('clientTranscript', clientTranscript.trim());
    }
    return this.http.post<{
      transcript: string;
      detectedLanguage: string;
      confidence: number;
      provider: string;
      audioUrl: string;
    }>(`${this.baseUrl}/media/transcribe-voice`, formData, { headers: this.getHeaders() });
  }

  // Teams & Admin
  getTeams(): Observable<ServiceTeam[]> {
    return this.http.get<ServiceTeam[]>(`${this.baseUrl}/teams`, {
      headers: this.getHeaders()
    });
  }

  getMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.baseUrl}/admin/metrics`, {
      headers: this.getHeaders()
    });
  }

  getSystemStatus(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/status`);
  }

  setApiKey(apiKey: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/admin/set-api-key`, { apiKey }, {
      headers: this.getHeaders()
    });
  }

  resetDemoData(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/admin/reset-demo`, {}, {
      headers: this.getHeaders()
    });
  }
}
