import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DashboardMetrics, ServiceTeam } from '../../models/case.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page container">
      <div class="admin-header">
        <div>
          <div class="badge badge-status-submitted">Platform Operations</div>
          <h1>System Administration & Analytics</h1>
          <p>Configured routing rules, target response times, AI model health, and demo data lifecycle management.</p>
        </div>

        <button class="btn btn-danger btn-sm" (click)="resetDemoData()">
          <span class="material-icons-round">delete_sweep</span>
          <span>Clear All Cases</span>
        </button>
      </div>

      <!-- Live AI Model Health & System Status -->
      <div class="civic-card health-card">
        <div class="card-title-row">
          <div class="title-with-icon">
            <span class="material-icons-round text-teal">monitor_heart</span>
            <h3>Google Gemini AI Engine Status</h3>
          </div>
          <span class="badge" [class.badge-status-resolved]="systemStatus()?.ai?.isGeminiConfigured"
                              [class.badge-status-needs-review]="!systemStatus()?.ai?.isGeminiConfigured">
            {{ systemStatus()?.ai?.isGeminiConfigured ? 'Live Gemini Model Online' : 'Demo Fallback Active' }}
          </span>
        </div>

        <div class="health-meta-grid">
          <div class="meta-item">
            <span class="lbl">Active AI Provider:</span>
            <span class="val">{{ systemStatus()?.ai?.activeProvider || 'Loading...' }}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">Structured Output Mode:</span>
            <span class="val">Enforced JSON Schema (response_mime_type: application/json)</span>
          </div>
          <div class="meta-item">
            <span class="lbl">Audio Transcription Engine:</span>
            <span class="val">Gemini 1.5/2.0 Multimodal Audio / Google Cloud Speech</span>
          </div>
          <div class="meta-item">
            <span class="lbl">Verification Assessment:</span>
            <span class="val">Advisory Gemini Vision Inspection</span>
          </div>
        </div>

        <div class="api-key-config-row">
          <div class="api-key-input-wrap">
            <span class="material-icons-round text-teal">key</span>
            <input
              type="password"
              [(ngModel)]="newApiKey"
              placeholder="Paste Google AI Studio Gemini API Key (e.g. AIzaSy...)"
              class="api-key-input" />
          </div>
          <button class="btn btn-primary btn-sm" [disabled]="isSavingKey() || !newApiKey.trim()" (click)="saveApiKey()">
            <span class="material-icons-round">save</span>
            <span>{{ isSavingKey() ? 'Configuring...' : 'Activate Gemini Key' }}</span>
          </button>
        </div>
        @if (apiKeyMessage()) {
          <div class="key-status-msg" [class.success]="isKeySuccess()" [class.error]="!isKeySuccess()">
            {{ apiKeyMessage() }}
          </div>
        }
      </div>

      <!-- Configured Municipal Service Teams & SLA Targets -->
      <div class="civic-card teams-card">
        <h3>Configured Municipal Service Teams & SLA Targets</h3>
        <p class="sub-text">Transparent routing rules based on civic category and severity criteria.</p>

        <div class="teams-table-wrap">
          <table class="teams-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Code</th>
                <th>Category Specialty</th>
                <th>P1 SLA (Urgent)</th>
                <th>P2 SLA (High)</th>
                <th>P3 SLA (Normal)</th>
                <th>P4 SLA (Low)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (team of serviceTeams(); track team.id) {
                <tr>
                  <td class="font-bold">{{ team.name }}</td>
                  <td><code>{{ team.code }}</code></td>
                  <td>{{ team.categorySpecialty }}</td>
                  <td><span class="badge badge-p1">{{ team.targetHoursP1 }}h</span></td>
                  <td><span class="badge badge-p2">{{ team.targetHoursP2 }}h</span></td>
                  <td><span class="badge badge-p3">{{ team.targetHoursP3 }}h</span></td>
                  <td><span class="badge badge-p4">{{ team.targetHoursP4 }}h</span></td>
                  <td><span class="badge badge-status-resolved">Active</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Aggregated Analytics -->
      <div class="analytics-grid">
        <div class="civic-card chart-card">
          <h3>Incident Breakdown by Category</h3>
          <div class="breakdown-list">
            @for (cat of getCategoryEntries(); track cat.key) {
              <div class="breakdown-row">
                <div class="breakdown-info">
                  <span class="cat-name">{{ cat.key }}</span>
                  <span class="cat-count">{{ cat.value }} cases</span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" [style.width.%]="(cat.value / (metrics()?.totalCases || 1)) * 100"></div>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="civic-card chart-card">
          <h3>Incident Breakdown by Workflow Status</h3>
          <div class="breakdown-list">
            @for (st of getStatusEntries(); track st.key) {
              <div class="breakdown-row">
                <div class="breakdown-info">
                  <span class="cat-name">{{ st.key }}</span>
                  <span class="cat-count">{{ st.value }} cases</span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill teal" [style.width.%]="(st.value / (metrics()?.totalCases || 1)) * 100"></div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page {
      padding: 32px 20px 64px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
      h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin: 6px 0 2px; }
      p { font-size: 0.9375rem; color: #64748b; }
    }
    .health-card {
      margin-bottom: 24px;
      border-left: 4px solid #0d9488;
      h3 { font-size: 1rem; font-weight: 700; color: #0f172a; }
      .text-teal { color: #0d9488; }
    }
    .health-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-top: 14px;
    }
    .meta-item {
      .lbl { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 2px; }
      .val { font-size: 0.8125rem; font-weight: 600; color: #0f172a; }
    }
    .teams-card {
      margin-bottom: 24px;
      h3 { font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
      .sub-text { font-size: 0.75rem; color: #64748b; margin-bottom: 16px; }
    }
    .teams-table-wrap {
      overflow-x: auto;
    }
    .teams-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
      th {
        background: #f8fafc;
        padding: 10px 14px;
        text-align: left;
        font-weight: 700;
        color: #475569;
        border-bottom: 1px solid var(--border);
      }
      td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
      }
      code {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.75rem;
      }
    }
    .analytics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) {
      .analytics-grid { grid-template-columns: 1fr; }
    }
    .chart-card {
      h3 { font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    }
    .breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .breakdown-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.8125rem;
      margin-bottom: 4px;
      .cat-name { font-weight: 600; color: #334155; }
      .cat-count { font-weight: 700; color: #0f172a; }
    }
    .progress-bar-bg {
      height: 8px;
      background: #e2e8f0;
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: #0d9488;
      border-radius: 9999px;
      &.teal { background: #0284c7; }
    }
    .api-key-config-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }
    .api-key-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 12px;
      flex: 1;
      min-width: 260px;
    }
    .api-key-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 0.8125rem;
      font-family: monospace;
      color: #0f172a;
    }
    .key-status-msg {
      margin-top: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 6px;
      &.success {
        background: #f0fdf4;
        color: #166534;
        border: 1px solid #bbf7d0;
      }
      &.error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
    }
  `]
})
export class AdminComponent implements OnInit {
  serviceTeams = signal<ServiceTeam[]>([]);
  metrics = signal<DashboardMetrics | null>(null);
  systemStatus = signal<any>(null);

  newApiKey = '';
  isSavingKey = signal(false);
  apiKeyMessage = signal<string | null>(null);
  isKeySuccess = signal(true);

  constructor(private api: ApiService) {}

  saveApiKey() {
    if (!this.newApiKey.trim()) return;
    this.isSavingKey.set(true);
    this.apiKeyMessage.set(null);
    this.api.setApiKey(this.newApiKey.trim()).subscribe({
      next: (res) => {
        this.isSavingKey.set(false);
        this.isKeySuccess.set(true);
        this.apiKeyMessage.set('Gemini API key configured and activated successfully!');
        this.newApiKey = '';
        this.loadData();
      },
      error: (err) => {
        this.isSavingKey.set(false);
        this.isKeySuccess.set(false);
        this.apiKeyMessage.set(err.error?.message || 'Failed to activate Gemini API key.');
      }
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getTeams().subscribe({
      next: (teams) => this.serviceTeams.set(teams),
      error: () => {}
    });

    this.api.getMetrics().subscribe({
      next: (m) => this.metrics.set(m),
      error: () => {}
    });

    this.api.getSystemStatus().subscribe({
      next: (st) => this.systemStatus.set(st),
      error: () => {}
    });
  }

  getCategoryEntries(): { key: string; value: number }[] {
    const map = this.metrics()?.casesByCategory;
    if (!map) return [];
    return Object.entries(map).map(([key, value]) => ({ key, value }));
  }

  getStatusEntries(): { key: string; value: number }[] {
    const map = this.metrics()?.casesByStatus;
    if (!map) return [];
    return Object.entries(map).map(([key, value]) => ({ key, value }));
  }

  resetDemoData() {
    if (!confirm('Are you sure you want to clear all civic cases and start fresh?')) return;
    this.api.resetDemoData().subscribe({
      next: () => {
        alert('All cases and activity history have been cleared.');
        this.loadData();
      },
      error: (err) => alert(err.error?.message || 'Failed to clear data.')
    });
  }
}
