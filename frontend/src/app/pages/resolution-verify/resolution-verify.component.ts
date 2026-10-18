import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CivicCase } from '../../models/case.model';

@Component({
  selector: 'app-resolution-verify',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="resolution-page container" *ngIf="caseItem(); else loading">
      <div class="top-bar">
        <a [routerLink]="['/reviewer/cases', caseItem()?.id]" class="back-link">
          <span class="material-icons-round">arrow_back</span>
          <span>Back to Case Detail</span>
        </a>
        <div class="id-tag">Case: {{ caseItem()?.id }}</div>
      </div>

      <div class="header-section">
        <div class="badge badge-status-resolved">Feature Five: Closed-Loop Verification</div>
        <h1>Resolution Evidence & Verification Sign-Off</h1>
        <p>Inspect resolution evidence, review advisory Gemini multimodal assessment, and approve or reject incident closure.</p>
      </div>

      <div class="verify-layout">
        <!-- Left: Side-by-Side Photo Comparison -->
        <div class="comparison-column">
          <div class="civic-card comp-card">
            <h3>Visual Evidence Comparison</h3>
            <div class="photos-grid">
              <div class="photo-box">
                <span class="box-label">Original Reported Problem (Before)</span>
                <img
                  [src]="caseItem()?.photoUrl || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500'"
                  alt="Before Photo"
                  class="comp-img" />
                <div class="photo-caption">{{ caseItem()?.conciseSummary || caseItem()?.rawDescription }}</div>
              </div>

              <div class="photo-box">
                <span class="box-label">Field Team Resolution (After)</span>
                @if (resolutionPhotoUrl || caseItem()?.resolutionPhotoUrl) {
                  <img
                    [src]="resolutionPhotoUrl || caseItem()?.resolutionPhotoUrl"
                    alt="After Photo"
                    class="comp-img" />
                  <div class="photo-caption">{{ resolutionDesc || caseItem()?.resolutionDescription || 'Resolution evidence attached.' }}</div>
                } @else {
                  <div class="no-photo-placeholder">
                    <span class="material-icons-round">add_a_photo</span>
                    <span>No resolution photo attached yet. Use form on right to upload or select sample evidence.</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Advisory AI Assessment -->
          @if (parsedAssessment()) {
            <div class="civic-card ai-advisory-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <span class="material-icons-round text-teal">psychology</span>
                  <h3>Gemini Multimodal Advisory Verification</h3>
                </div>
                <span class="advisory-tag">Advisory Only — Human Sign-Off Required</span>
              </div>

              <div class="advisory-grid">
                <div class="advisory-item">
                  <span class="lbl">Visual Observations:</span>
                  <p>{{ parsedAssessment()?.visual_observations }}</p>
                </div>
                <div class="advisory-item">
                  <span class="lbl">Consistency with Original Issue:</span>
                  <span class="badge" [class.badge-status-resolved]="parsedAssessment()?.is_consistent_with_resolution">
                    {{ parsedAssessment()?.is_consistent_with_resolution ? 'Visually Consistent' : 'Inconsistent' }}
                  </span>
                </div>
                <div class="advisory-item">
                  <span class="lbl">AI Recommendation:</span>
                  <p class="rec-text">{{ parsedAssessment()?.advisory_recommendation }}</p>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Right: Actions & Sign-Off Form -->
        <div class="action-column">
          <!-- Step 1: Submit Resolution Evidence if not yet submitted -->
          @if (!caseItem()?.resolutionPhotoUrl && caseItem()?.status !== 'Resolution Submitted' && caseItem()?.status !== 'Resolved') {
            <div class="civic-card action-card">
              <h3>1. Upload Resolution Evidence</h3>
              <p class="sub-text">Field crew or supervisor submits after-work evidence.</p>

              <div class="form-group">
                <label>Resolution After-Photo URL / Sample:</label>
                <input type="text" [(ngModel)]="resolutionPhotoUrl" placeholder="https://..." />
                <div class="quick-samples">
                  <span>Quick samples:</span>
                  <button type="button" class="btn-link" (click)="setSamplePhoto('pothole')">Pothole Repaved</button>
                  <button type="button" class="btn-link" (click)="setSamplePhoto('garbage')">Garbage Cleared</button>
                  <button type="button" class="btn-link" (click)="setSamplePhoto('lights')">Lights Functional</button>
                </div>
              </div>

              <div class="form-group">
                <label>Work Performed Description *:</label>
                <textarea
                  [(ngModel)]="resolutionDesc"
                  rows="3"
                  placeholder="Detail work performed (e.g. patched with 2 tons hot-mix asphalt and compacted)..."></textarea>
              </div>

              <button
                class="btn btn-primary btn-block"
                [disabled]="!resolutionPhotoUrl.trim() || !resolutionDesc.trim() || isSubmitting()"
                (click)="submitResolutionEvidence()">
                @if (isSubmitting()) {
                  <span class="material-icons-round spin">sync</span>
                  <span>Submitting & Running AI Assessment...</span>
                } @else {
                  <span class="material-icons-round">upload</span>
                  <span>Submit Resolution for Verification</span>
                }
              </button>
            </div>
          }

          <!-- Step 2: Verification Sign-Off / Rejection (Human Reviewer Decision) -->
          <div class="civic-card action-card">
            <h3>2. Reviewer Verification Decision</h3>
            <p class="sub-text">Authorized municipal reviewer signs off on verified closure.</p>

            <div class="form-group">
              <label>Reviewer Verification Notes:</label>
              <textarea [(ngModel)]="verificationNotes" rows="2" placeholder="e.g. On-site verification confirms site is clean and roadway restored."></textarea>
            </div>

            <div class="verify-btn-group">
              <button class="btn btn-success btn-lg btn-block" (click)="approveResolution()">
                <span class="material-icons-round">check_circle</span>
                <span>Approve & Mark Resolved</span>
              </button>

              <div class="rejection-trigger">
                @if (!showRejectReason()) {
                  <button class="btn btn-danger btn-sm" (click)="showRejectReason.set(true)">
                    <span class="material-icons-round">cancel</span>
                    <span>Reject Resolution Evidence...</span>
                  </button>
                } @else {
                  <div class="reject-box">
                    <label>Mandatory Rejection Reason:</label>
                    <input
                      type="text"
                      [(ngModel)]="rejectionReason"
                      placeholder="e.g. Surface patch uneven, debris still scattered on berm" />
                    <div class="reject-btns">
                      <button class="btn btn-danger btn-sm" [disabled]="!rejectionReason.trim()" (click)="rejectResolution()">
                        Confirm Rejection (Return to In Progress)
                      </button>
                      <button class="btn btn-secondary btn-sm" (click)="showRejectReason.set(false)">
                        Cancel
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loading>
      <div class="p-8 text-center text-muted">
        Loading resolution verification view...
      </div>
    </ng-template>
  `,
  styles: [`
    .resolution-page {
      padding: 32px 20px 64px;
      max-width: 1240px;
      margin: 0 auto;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .back-link {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      &:hover { color: #0d9488; }
    }
    .id-tag {
      font-size: 0.9375rem;
      font-weight: 800;
      color: #0d9488;
    }
    .header-section {
      margin-bottom: 28px;
      h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin: 8px 0 4px; }
      p { font-size: 0.9375rem; color: #64748b; }
    }
    .verify-layout {
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: 24px;
      align-items: flex-start;
    }
    @media (max-width: 960px) {
      .verify-layout { grid-template-columns: 1fr; }
    }
    .comp-card {
      margin-bottom: 20px;
      h3 { font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    }
    .photos-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 600px) {
      .photos-grid { grid-template-columns: 1fr; }
    }
    .photo-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: #f8fafc;
      .box-label {
        display: block;
        padding: 8px 12px;
        background: #f1f5f9;
        font-size: 0.75rem;
        font-weight: 700;
        color: #475569;
        border-bottom: 1px solid var(--border);
      }
      .comp-img {
        width: 100%;
        height: 220px;
        object-fit: cover;
        display: block;
      }
      .photo-caption {
        padding: 8px 12px;
        font-size: 0.75rem;
        color: #475569;
      }
    }
    .no-photo-placeholder {
      height: 220px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      color: #94a3b8;
      gap: 8px;
      font-size: 0.8125rem;
      .material-icons-round { font-size: 36px; color: #cbd5e1; }
    }
    .ai-advisory-card {
      border-left: 4px solid #10b981;
      background: #f0fdf4;
      h3 { font-size: 1rem; font-weight: 700; color: #166534; }
      .text-teal { color: #059669; }
      .advisory-tag {
        font-size: 0.6875rem;
        font-weight: 700;
        background: #dcfce7;
        color: #15803d;
        padding: 2px 8px;
        border-radius: 4px;
      }
    }
    .advisory-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 14px;
    }
    .advisory-item {
      .lbl { display: block; font-size: 0.75rem; font-weight: 700; color: #166534; margin-bottom: 2px; }
      p { font-size: 0.8125rem; color: #14532d; line-height: 1.4; }
      .rec-text { font-weight: 600; color: #15803d; }
    }
    .action-card {
      margin-bottom: 20px;
      h3 { font-size: 1.0625rem; font-weight: 700; color: #0f172a; }
      .sub-text { font-size: 0.75rem; color: #64748b; margin-bottom: 14px; }
    }
    .quick-samples {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
      font-size: 0.6875rem;
      color: #64748b;
      .btn-link {
        background: none;
        border: none;
        color: #0d9488;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        font-size: 0.6875rem;
      }
    }
    .verify-btn-group {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 16px;
    }
    .rejection-trigger {
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }
    .reject-box {
      background: #fef2f2;
      border: 1px solid #fee2e2;
      padding: 12px;
      border-radius: 8px;
      label { display: block; font-size: 0.75rem; font-weight: 700; color: #991b1b; margin-bottom: 4px; }
      input { width: 100%; padding: 6px 10px; border: 1px solid #fca5a5; border-radius: 6px; font-size: 0.8125rem; margin-bottom: 8px; }
      .reject-btns { display: flex; gap: 8px; }
    }
    .btn-block { width: 100%; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class ResolutionVerifyComponent implements OnInit {
  caseItem = signal<CivicCase | null>(null);

  resolutionPhotoUrl = '';
  resolutionDesc = '';
  verificationNotes = '';
  rejectionReason = '';
  showRejectReason = signal(false);
  isSubmitting = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCase(id);
    }
  }

  loadCase(id: string) {
    this.api.getCaseById(id).subscribe({
      next: (c) => {
        this.caseItem.set(c);
        if (c.resolutionPhotoUrl) {
          this.resolutionPhotoUrl = c.resolutionPhotoUrl;
        }
        if (c.resolutionDescription) {
          this.resolutionDesc = c.resolutionDescription;
        }
      },
      error: () => {}
    });
  }

  setSamplePhoto(type: string) {
    if (type === 'pothole') {
      this.resolutionPhotoUrl = 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=800&q=80';
      this.resolutionDesc = 'Road surface patched with asphalt aggregate and compacted flush with roadway.';
    } else if (type === 'garbage') {
      this.resolutionPhotoUrl = 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80';
      this.resolutionDesc = 'Sanitation compactor truck cleared all overflowing bins and disinfected the sidewalk.';
    } else if (type === 'lights') {
      this.resolutionPhotoUrl = 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80';
      this.resolutionDesc = 'New 90W LED fixtures installed on all 4 light poles. Illumination confirmed.';
    }
  }

  parsedAssessment(): any {
    const raw = this.caseItem()?.verificationAssessment;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  submitResolutionEvidence() {
    const id = this.caseItem()?.id;
    if (!id || !this.resolutionPhotoUrl.trim() || !this.resolutionDesc.trim()) return;

    this.isSubmitting.set(true);
    this.api.submitResolution(id, {
      resolutionPhotoUrl: this.resolutionPhotoUrl.trim(),
      resolutionDescription: this.resolutionDesc.trim()
    }).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.caseItem.set(updated);
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  approveResolution() {
    const id = this.caseItem()?.id;
    if (!id) return;

    this.api.verifyResolution(id, {
      approved: true,
      notes: this.verificationNotes.trim() || 'Visual evidence verified and approved by municipal inspector.'
    }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.router.navigate(['/dashboard']);
      },
      error: () => {}
    });
  }

  rejectResolution() {
    const id = this.caseItem()?.id;
    if (!id || !this.rejectionReason.trim()) return;

    this.api.verifyResolution(id, {
      approved: false,
      rejectionReason: this.rejectionReason.trim()
    }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.router.navigate(['/dashboard']);
      },
      error: () => {}
    });
  }
}
