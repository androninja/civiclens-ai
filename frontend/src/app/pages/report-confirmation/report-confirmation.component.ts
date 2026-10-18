import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { I18nService } from '../../services/i18n.service';
import { CivicCase, EmergencyHelpline } from '../../models/case.model';

@Component({
  selector: 'app-report-confirmation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="confirmation-page container">
      <!-- Automatic Location Popup Modal (Can be accepted or declined) -->
      @if (showLocationPopup()) {
        <div class="location-popup-overlay">
          <div class="location-popup-modal">
            <div class="popup-icon-wrap">
              <span class="material-icons-round popup-pin">my_location</span>
            </div>
            <h2>Share Your Exact Location?</h2>
            <p class="popup-desc">
              Help municipal response teams navigate directly to the reported problem site by sharing your device GPS coordinates.
            </p>

            @if (locationError()) {
              <div class="popup-alert">
                <span class="material-icons-round">info</span>
                <span>{{ locationError() }}</span>
              </div>
            }

            <div class="popup-btn-stack">
              <button type="button" class="btn btn-primary btn-lg btn-block" (click)="shareLocationNow()" [disabled]="isLocating()">
                @if (isLocating()) {
                  <span class="material-icons-round spin">sync</span>
                  <span>Detecting GPS Location...</span>
                } @else {
                  <span class="material-icons-round">near_me</span>
                  <span>Share Location (GPS)</span>
                }
              </button>
              <button type="button" class="btn btn-secondary btn-block" (click)="declineLocationPopup()">
                <span class="material-icons-round">close</span>
                <span>Decline & Continue Without Location</span>
              </button>
            </div>
          </div>
        </div>
      }

      <div class="civic-card confirmation-card">
        <div class="success-icon-wrap">
          <span class="material-icons-round success-icon">check_circle</span>
        </div>

        <h1>Report Successfully Registered</h1>
        <p class="subtitle">Your civic report has been received, analyzed by Gemini AI, and logged persistently in the municipal ledger.</p>

        @if (locationSharedSuccess()) {
          <div class="location-success-banner">
            <span class="material-icons-round">check_circle</span>
            <span>Exact location coordinates attached: {{ caseItem()?.latitude }}, {{ caseItem()?.longitude }}</span>
          </div>
        }

        @if (caseItem()) {
          <div class="case-id-badge">
            <span class="label">Reference Case ID:</span>
            <span class="case-id">{{ caseItem()?.id }}</span>
          </div>

          <!-- AI Intelligence Summary Box -->
          <div class="ai-summary-box">
            <div class="ai-box-header">
              <div class="ai-title">
                <span class="material-icons-round text-teal">psychology</span>
                <strong>Gemini AI Case Understanding</strong>
              </div>
              <span class="badge" [class.badge-p1]="caseItem()?.priority === 'P1'"
                                  [class.badge-p2]="caseItem()?.priority === 'P2'"
                                  [class.badge-p3]="caseItem()?.priority === 'P3'"
                                  [class.badge-p4]="caseItem()?.priority === 'P4'">
                {{ caseItem()?.priority }} Recommended
              </span>
            </div>

            <div class="ai-grid">
              <div class="ai-field">
                <span class="field-label">Assigned Category:</span>
                <span class="field-val">{{ caseItem()?.category }} ({{ caseItem()?.subcategory }})</span>
              </div>
              <div class="ai-field">
                <span class="field-label">Report Language:</span>
                <span class="field-val">{{ getLanguageLabel(caseItem()?.language || 'en') }}</span>
              </div>
              <div class="ai-field full">
                <span class="field-label">Concise Summary:</span>
                <span class="field-val">{{ caseItem()?.conciseSummary }}</span>
              </div>
              <div class="ai-field full">
                <span class="field-label">Priority Rationale:</span>
                <span class="field-val">{{ caseItem()?.priorityRationale }}</span>
              </div>

              @if (caseItem()?.latitude && caseItem()?.longitude) {
                <div class="ai-field full">
                  <span class="field-label">Incident Location:</span>
                  <span class="field-val">📍 {{ caseItem()?.locationAddress || (caseItem()?.latitude + ', ' + caseItem()?.longitude) }}</span>
                </div>
              }

              @if (caseItem()?.isDuplicate) {
                <div class="duplicate-alert-box full">
                  <span class="material-icons-round">content_copy</span>
                  <div class="dup-text">
                    <strong>Potential Duplicate Detected:</strong>
                    <span>Matches existing incident <strong>{{ caseItem()?.primaryCaseId }}</strong> ({{ (caseItem()?.duplicateConfidence || 0) * 100 | number:'1.0-0' }}% similarity). Both records are preserved for reviewer confirmation.</span>
                  </div>
                </div>
              }

              @if (caseItem()?.safetyConcerns) {
                <div class="safety-alert-box full">
                  <span class="material-icons-round">warning</span>
                  <div class="safety-text">
                    <strong>Safety Notice:</strong>
                    <span>{{ caseItem()?.safetyConcerns }}</span>
                  </div>
                </div>
              }

              <!-- Photo Quality Flag -->
              @if (caseItem()?.isPhotoUnclear) {
                <div class="quality-flag-box full photo-flag">
                  <span class="material-icons-round flag-icon">no_photography</span>
                  <div class="flag-content">
                    <strong>Photo Quality Notice: Photo Not Clear</strong>
                    <span>{{ caseItem()?.photoQualityIssue || 'The attached photograph appears blurry, dark, or has low visibility.' }}</span>
                  </div>
                </div>
              }

              <!-- Audio Quality Flag -->
              @if (caseItem()?.isAudioUnclear) {
                <div class="quality-flag-box full audio-flag">
                  <span class="material-icons-round flag-icon">volume_off</span>
                  <div class="flag-content">
                    <strong>Audio Quality Notice: Audio Not Clear</strong>
                    <span>{{ caseItem()?.audioQualityIssue || 'The voice recording has low clarity or was muffled.' }}</span>
                  </div>
                </div>
              }

              <!-- Non-Civic Matter / Outside Jurisdiction Flag -->
              @if (caseItem()?.isNonCivicIssue) {
                <div class="jurisdiction-flag-box full">
                  <span class="material-icons-round flag-icon">gavel</span>
                  <div class="flag-content">
                    <strong>Outside Municipal Jurisdiction / Non-Civic Matter</strong>
                    <span>{{ caseItem()?.nonCivicReason || 'This issue involves internal private household property or personal disputes outside the jurisdiction of municipal civic authorities.' }}</span>
                  </div>
                </div>
              }

              <!-- Emergency Crisis Helplines Alert -->
              @if (caseItem()?.hasEmergencySafetyTrigger) {
                <div class="emergency-crisis-box full">
                  <div class="crisis-header">
                    <span class="material-icons-round crisis-icon">crisis_alert</span>
                    <div>
                      <strong>Emergency & Crisis Support ({{ caseItem()?.emergencyType || 'Urgent Safety' }})</strong>
                      <p class="crisis-sub">Direct 24/7 National Emergency Helplines</p>
                    </div>
                  </div>
                  <div class="helpline-dial-list">
                    @for (helpline of getEmergencyHelplines(); track helpline.number) {
                      <div class="helpline-card">
                        <div class="helpline-meta">
                          <span class="h-name">{{ helpline.name }}</span>
                          <span class="h-desc">{{ helpline.description }}</span>
                        </div>
                        <a [href]="'tel:' + helpline.number" class="btn btn-emergency-dial-sm">
                          <span class="material-icons-round">phone</span>
                          <span>Call {{ helpline.number }}</span>
                        </a>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Actions -->
          <div class="confirmation-actions">
            <a [routerLink]="['/cases', caseItem()?.id]" class="btn btn-primary">
              <span class="material-icons-round">visibility</span>
              <span>Track Incident & Audit Timeline</span>
            </a>
            <a routerLink="/my-reports" class="btn btn-secondary">
              <span class="material-icons-round">list_alt</span>
              <span>View All My Reports</span>
            </a>
            <a routerLink="/report" class="btn btn-secondary">
              <span class="material-icons-round">add</span>
              <span>Submit Another Report</span>
            </a>
          </div>
        } @else {
          <div class="loading-state">
            <span class="material-icons-round spin">sync</span>
            <span>Loading case confirmation...</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .confirmation-page {
      padding: 32px 16px 64px;
      max-width: 800px;
      margin: 0 auto;
    }
    .confirmation-card {
      text-align: center;
      padding: 36px 24px;
      border-radius: 16px;
    }
    .success-icon-wrap {
      width: 68px;
      height: 68px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .success-icon {
      font-size: 44px;
      color: #15803d;
    }
    h1 { font-size: 1.625rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .subtitle { font-size: 0.9375rem; color: #64748b; margin-bottom: 24px; }
    .case-id-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #f1f5f9;
      border: 1px solid var(--border);
      padding: 8px 18px;
      border-radius: 10px;
      margin-bottom: 24px;
      .label { font-size: 0.8125rem; font-weight: 600; color: #64748b; }
      .case-id { font-size: 1.125rem; font-weight: 800; color: #0d9488; letter-spacing: 0.05em; }
    }
    .location-success-banner {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
      font-weight: 600;
      font-size: 0.875rem;
    }
    .ai-summary-box {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      text-align: left;
      margin-bottom: 32px;
    }
    .ai-box-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .ai-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9375rem;
      .text-teal { color: #0d9488; }
    }
    .ai-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    @media (max-width: 600px) {
      .ai-grid {
        grid-template-columns: 1fr;
      }
      .ai-field.full {
        grid-column: 1;
      }
    }
    .ai-field {
      &.full { grid-column: span 2; }
      .field-label { display: block; font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 2px; }
      .field-val { font-size: 0.875rem; color: #0f172a; font-weight: 500; }
    }
    .duplicate-alert-box {
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #92400e;
      font-size: 0.8125rem;
    }
    .safety-alert-box {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #991b1b;
      font-size: 0.8125rem;
    }
    .quality-flag-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #b45309;
      font-size: 0.8125rem;
      &.full { grid-column: span 2; }
      .flag-icon { font-size: 20px; color: #d97706; margin-top: 2px; }
      .flag-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }
    .jurisdiction-flag-box {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #5b21b6;
      font-size: 0.8125rem;
      &.full { grid-column: span 2; }
      .flag-icon { font-size: 20px; color: #7c3aed; margin-top: 2px; }
      .flag-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }
    .emergency-crisis-box {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 12px;
      padding: 16px;
      color: #991b1b;
      &.full { grid-column: span 2; }
    }
    .crisis-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      .crisis-icon { font-size: 28px; color: #dc2626; }
      strong { font-size: 0.9375rem; color: #b91c1c; }
      .crisis-sub { font-size: 0.75rem; color: #7f1d1d; margin: 2px 0 0 0; }
    }
    .helpline-dial-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 10px;
    }
    .helpline-card {
      background: #ffffff;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .helpline-meta {
      display: flex;
      flex-direction: column;
      .h-name { font-size: 0.8125rem; font-weight: 700; color: #1e293b; }
      .h-desc { font-size: 0.6875rem; color: #64748b; }
    }
    .btn-emergency-dial-sm {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #dc2626;
      color: #ffffff !important;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s;
      &:hover { background: #b91c1c; }
      span.material-icons-round { font-size: 16px; }
    }
    .confirmation-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    @media (max-width: 600px) {
      .confirmation-actions .btn {
        width: 100%;
      }
    }
    .loading-state {
      padding: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #64748b;
    }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Location Prompt Modal */
    .location-popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease-out;
    }
    .location-popup-modal {
      background: #ffffff;
      border-radius: 20px;
      max-width: 440px;
      width: 100%;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid #e2e8f0;
      animation: slideUp 0.25s ease-out;

      h2 {
        font-size: 1.375rem;
        font-weight: 800;
        color: #0f172a;
        margin: 12px 0 8px;
      }
      .popup-desc {
        color: #64748b;
        font-size: 0.9375rem;
        line-height: 1.5;
        margin-bottom: 24px;
      }
    }
    .popup-icon-wrap {
      width: 64px;
      height: 64px;
      background: #ccfbf1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    .popup-pin {
      font-size: 36px;
      color: #0d9488;
    }
    .popup-alert {
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #92400e;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.8125rem;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .popup-btn-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 52px;
        font-size: 1rem;
        font-weight: 700;
        border-radius: 12px;
      }
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class ReportConfirmationComponent implements OnInit {
  caseItem = signal<CivicCase | null>(null);
  showLocationPopup = signal(false);
  isLocating = signal(false);
  locationSharedSuccess = signal(false);
  locationError = signal<string | null>(null);
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    public i18n: I18nService
  ) {}

  getLanguageLabel(code: string): string {
    const item = this.i18n.getSupportedLanguages().find(l => l.code === code);
    return item ? `${item.name} (${item.nativeName})` : code;
  }

  getEmergencyHelplines(): EmergencyHelpline[] {
    const json = this.caseItem()?.emergencyHelplinesJson;
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      { name: 'National Emergency Support', number: '112', description: 'Immediate Police & Emergency Services' },
      { name: 'Tele-MANAS Mental Health', number: '14416', description: '24/7 National Mental Health Tele-Counseling' },
      { name: 'Women Helpline', number: '1091', description: '24/7 Dedicated Women Distress Helpline' },
      { name: 'Childline India', number: '1098', description: '24/7 Free Helpline for Children in Distress' }
    ];
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getCaseById(id).subscribe({
        next: (c) => {
          this.caseItem.set(c);
          // If no coordinates attached, prompt the user with the automatic location popup!
          if (!c.latitude || !c.longitude) {
            const declined = sessionStorage.getItem('civiclens_declined_loc_' + id);
            if (!declined) {
              this.showLocationPopup.set(true);
            }
          }
        },
        error: () => {}
      });
    }
  }

  shareLocationNow() {
    const c = this.caseItem();
    if (!c) return;

    if (!navigator.geolocation) {
      this.locationError.set('Geolocation is not supported by your browser.');
      return;
    }

    this.isLocating.set(true);
    this.locationError.set(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        const address = `GPS Location: ${lat}, ${lng}`;

        this.api.updateCaseLocation(c.id, { latitude: lat, longitude: lng, address }).subscribe({
          next: (updated) => {
            this.isLocating.set(false);
            this.caseItem.set(updated);
            this.showLocationPopup.set(false);
            this.locationSharedSuccess.set(true);
          },
          error: () => {
            this.isLocating.set(false);
            this.locationError.set('Could not save location on server.');
          }
        });
      },
      (err) => {
        this.isLocating.set(false);
        this.locationError.set(err.message || 'GPS location permission denied.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  declineLocationPopup() {
    const c = this.caseItem();
    if (c) {
      sessionStorage.setItem('civiclens_declined_loc_' + c.id, 'true');
    }
    this.showLocationPopup.set(false);
  }
}
