import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { I18nService } from '../../services/i18n.service';
import { CivicCase, ServiceTeam, DuplicateRelation, CaseActivityLog, EmergencyHelpline } from '../../models/case.model';

@Component({
  selector: 'app-reviewer-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="reviewer-action-page container" *ngIf="caseItem(); else loading">
      <!-- Top Nav -->
      <div class="top-nav">
        <a routerLink="/dashboard" class="back-link">
          <span class="material-icons-round">arrow_back</span>
          <span>Back to Reviewer Queue</span>
        </a>
        <div class="case-header-pill">
          <span class="id-tag">{{ caseItem()?.id }}</span>
          <span class="badge" [class.badge-p1]="caseItem()?.priority === 'P1'"
                              [class.badge-p2]="caseItem()?.priority === 'P2'"
                              [class.badge-p3]="caseItem()?.priority === 'P3'"
                              [class.badge-p4]="caseItem()?.priority === 'P4'">
            {{ caseItem()?.priority }}
          </span>
          <span class="badge" [ngClass]="getStatusBadgeClass(caseItem()?.status || '')">
            {{ caseItem()?.status }}
          </span>
        </div>
      </div>

      @if (feedbackMessage()) {
        <div class="alert-banner warning" style="margin-bottom: 20px;">
          <span class="material-icons-round">info</span>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }

      <div class="action-layout">
        <!-- Left Column: Case Overview & Evidence -->
        <div class="case-summary-col">
          <div class="civic-card">
            <h2>{{ caseItem()?.title }}</h2>
            <div class="meta-sub">
              <span>Category: <strong>{{ caseItem()?.category }}</strong></span>
              <span>Language: <strong>{{ getLanguageLabel(caseItem()?.language || 'en') }}</strong></span>
              <span>Reported: <strong>{{ caseItem()?.createdAt | date:'medium' }}</strong></span>
              <span>Citizen: <strong>{{ caseItem()?.citizenName }}</strong></span>
            </div>

            <!-- Emergency Safety Trigger Banner -->
            @if (caseItem()?.hasEmergencySafetyTrigger) {
              <div class="reviewer-emergency-banner">
                <div class="banner-hdr">
                  <span class="material-icons-round">crisis_alert</span>
                  <strong>CRITICAL EMERGENCY TRIGGER ({{ caseItem()?.emergencyType || 'Urgent Safety' }})</strong>
                </div>
                <p>Distress or personal safety keywords identified. Emergency helplines presented to citizen:</p>
                <div class="reviewer-helpline-chips">
                  @for (h of getEmergencyHelplines(); track h.number) {
                    <span class="helpline-chip">📞 {{ h.name }}: <strong>{{ h.number }}</strong></span>
                  }
                </div>
              </div>
            }

            <!-- Outside Jurisdiction Banner -->
            @if (caseItem()?.isNonCivicIssue) {
              <div class="reviewer-jurisdiction-banner">
                <div class="banner-hdr">
                  <span class="material-icons-round">gavel</span>
                  <strong>OUTSIDE MUNICIPAL JURISDICTION / NON-CIVIC ISSUE</strong>
                </div>
                <p>{{ caseItem()?.nonCivicReason || 'Reported incident involves internal private household matters or civil disputes outside government civic authority.' }}</p>
              </div>
            }

            <!-- Evidence Photo -->
            @if (caseItem()?.photoUrl) {
              <div class="photo-wrapper">
                <img [src]="caseItem()?.photoUrl" alt="Incident Photo" class="evidence-img" />
                @if (caseItem()?.isPhotoUnclear) {
                  <div class="reviewer-quality-alert photo-alert">
                    <span class="material-icons-round">no_photography</span>
                    <span><strong>Photo Not Clear:</strong> {{ caseItem()?.photoQualityIssue || 'Attached photograph has blur, low lighting, or poor visibility.' }}</span>
                  </div>
                }
              </div>
            }

            <!-- Voice Transcript & Description -->
            <div class="desc-box">
              <h4>Citizen Description:</h4>
              <p>{{ caseItem()?.rawDescription }}</p>

              @if (caseItem()?.editedTranscript || caseItem()?.isAudioUnclear) {
                <div class="transcript-box">
                  @if (caseItem()?.editedTranscript) {
                    <strong>Transcribed Voice:</strong>
                    <p>"{{ caseItem()?.editedTranscript }}"</p>
                  }
                  @if (caseItem()?.isAudioUnclear) {
                    <div class="reviewer-quality-alert audio-alert">
                      <span class="material-icons-round">volume_off</span>
                      <span><strong>Audio Not Clear:</strong> {{ caseItem()?.audioQualityIssue || 'Voice recording has low clarity or was muffled.' }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="location-box">
              <span class="material-icons-round">place</span>
              <span>{{ caseItem()?.locationAddress || 'No address provided' }}</span>
              @if (caseItem()?.latitude && caseItem()?.longitude) {
                <span class="coord-tag">({{ caseItem()?.latitude }}, {{ caseItem()?.longitude }})</span>
              }
            </div>
          </div>

          <!-- Potential Duplicate Review Card -->
          @if (caseItem()?.isDuplicate || duplicates().length > 0) {
            <div class="civic-card duplicate-review-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <span class="material-icons-round text-amber">content_copy</span>
                  <h3>Feature Three A: Duplicate Incident Triage</h3>
                </div>
                <span class="status-tag">{{ caseItem()?.duplicateReviewStatus }}</span>
              </div>

              <p class="dup-explanation">
                <strong>Matching Algorithm Rationale:</strong> {{ caseItem()?.duplicateExplanation || 'Geospatial and semantic similarity match.' }}
              </p>

              @for (dup of duplicates(); track dup.id) {
                <div class="dup-item-box">
                  <div class="dup-item-header">
                    <span>Potential Match: <strong>{{ dup.potentialDuplicateCaseId }}</strong></span>
                    <span class="score-badge">{{ dup.similarityScore * 100 | number:'1.0-0' }}% Match Score</span>
                  </div>
                  @if (dup.distanceMeters !== null && dup.distanceMeters !== undefined) {
                    <div class="dist-meta">Geographic Proximity: {{ dup.distanceMeters | number:'1.0-0' }} meters away</div>
                  }
                  <div class="dup-actions">
                    <button class="btn btn-primary btn-sm" (click)="confirmDuplicate(dup.potentialDuplicateCaseId)">
                      <span class="material-icons-round">link</span>
                      <span>Confirm Duplicate (Link to {{ dup.potentialDuplicateCaseId }})</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" (click)="rejectDuplicate()">
                      <span class="material-icons-round">link_off</span>
                      <span>Mark as Distinct Incident</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Right Column: Reviewer Actions (Priority, Team Routing, Status) -->
        <div class="actions-col">
          <!-- Priority Override Tool -->
          <div class="civic-card action-card">
            <div class="card-title-row">
              <div class="title-with-icon">
                <span class="material-icons-round text-teal">tune</span>
                <h3>Set Issue Priority</h3>
              </div>
            </div>
            <p class="tool-sub">AI Suggested: <strong>{{ caseItem()?.suggestedPriority }}</strong>. Reviewers can adjust priority with required rationale.</p>

            <div class="form-group">
              <label>Assign Priority:</label>
              <select [(ngModel)]="selectedPriority">
                <option value="P1">P1 — Urgent Public Safety Danger (4h SLA)</option>
                <option value="P2">P2 — High Priority / Severe Disruption (24h SLA)</option>
                <option value="P3">P3 — Normal Maintenance (72h SLA)</option>
                <option value="P4">P4 — Low Priority / Routine (168h SLA)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Override Rationale (Mandatory if changing):</label>
              <input
                type="text"
                [(ngModel)]="priorityRationale"
                placeholder="e.g. Field inspection confirmed water main damage near metro station..." />
            </div>

            <button
              class="btn btn-secondary btn-sm"
              [disabled]="selectedPriority === caseItem()?.priority && !priorityRationale.trim()"
              (click)="savePriorityOverride()">
              <span class="material-icons-round">save</span>
              <span>Apply Priority</span>
            </button>
          </div>

          <!-- Team Routing & Assignment -->
          <div class="civic-card action-card">
            <div class="card-title-row">
              <div class="title-with-icon">
                <span class="material-icons-round text-teal">send_to_mobile</span>
                <h3>Route & Assign Service Team</h3>
              </div>
            </div>

            <div class="form-group">
              <label>Select Municipal Service Team:</label>
              <select [(ngModel)]="selectedTeamId">
                <option value="">-- Choose Department --</option>
                @for (team of serviceTeams(); track team.id) {
                  <option [value]="team.id">{{ team.name }} ({{ team.code }})</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label>Target SLA Response Window (Hours):</label>
              <input type="number" [(ngModel)]="customHours" placeholder="e.g. 24" />
            </div>

            <div class="form-group">
              <label>Dispatch Notes for Field Crew:</label>
              <textarea [(ngModel)]="assignmentNotes" rows="2" placeholder="Navigation instructions, gate access codes, urgency..."></textarea>
            </div>

            <button
              class="btn btn-primary btn-sm"
              [disabled]="!selectedTeamId"
              (click)="assignTeam()">
              <span class="material-icons-round">assignment_ind</span>
              <span>Assign & Transition to 'Assigned'</span>
            </button>
          </div>

          <!-- Status Progression Workflow -->
          <div class="civic-card action-card">
            <div class="card-title-row">
              <div class="title-with-icon">
                <span class="material-icons-round text-teal">alt_route</span>
                <h3>Status Progression Workflow</h3>
              </div>
            </div>

            <div class="form-group">
              <label>Advance Case Status:</label>
              <select [(ngModel)]="nextStatus">
                <option value="Acknowledged">Acknowledged</option>
                <option value="In Progress">In Progress (Field Work Started)</option>
                <option value="Resolution Submitted">Resolution Submitted</option>
                <option value="Reopened">Reopened</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            @if (nextStatus === 'Rejected') {
              <div class="form-group">
                <label>Rejection Reason (Mandatory):</label>
                <input type="text" [(ngModel)]="rejectionReason" placeholder="e.g. Private property outside municipal jurisdiction" />
              </div>
            }

            <div class="form-group">
              <label>Status Update Notes:</label>
              <input type="text" [(ngModel)]="statusNotes" placeholder="Optional notes for audit log..." />
            </div>

            <button
              class="btn btn-secondary btn-sm"
              [disabled]="nextStatus === 'Rejected' && !rejectionReason.trim()"
              (click)="updateStatus()">
              <span>Transition Status</span>
            </button>
          </div>

          <!-- Quick Navigation to Resolution Verification if available -->
          @if (caseItem()?.status === 'In Progress' || caseItem()?.status === 'Resolution Submitted') {
            <div class="civic-card action-card resolution-action-box">
              <h4>Ready to upload resolution evidence?</h4>
              <p>Upload after-photos and submit work for closed-loop verification.</p>
              <a [routerLink]="['/reviewer/resolution', caseItem()?.id]" class="btn btn-success btn-sm">
                <span class="material-icons-round">fact_check</span>
                <span>Open Resolution Evidence Form</span>
              </a>
            </div>
          }
        </div>
      </div>
    </div>

    <ng-template #loading>
      <div class="p-8 text-center text-muted">
        Loading reviewer triage view...
      </div>
    </ng-template>
  `,
  styles: [`
    .reviewer-action-page {
      padding: 32px 20px 64px;
      max-width: 1240px;
      margin: 0 auto;
    }
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
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
    .case-header-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      .id-tag { font-size: 1rem; font-weight: 800; color: #0d9488; }
    }
    .action-layout {
      display: grid;
      grid-template-columns: 1fr 440px;
      gap: 24px;
      align-items: flex-start;
    }
    @media (max-width: 960px) {
      .action-layout { grid-template-columns: 1fr; }
    }
    .case-summary-col {
      display: flex;
      flex-direction: column;
      gap: 20px;
      h2 { font-size: 1.375rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
      .meta-sub {
        display: flex;
        gap: 16px;
        font-size: 0.8125rem;
        color: #64748b;
        margin-bottom: 16px;
        flex-wrap: wrap;
        strong { color: #0f172a; }
      }
    }
    .reviewer-emergency-banner {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
      color: #991b1b;
      .banner-hdr {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #b91c1c;
        font-size: 0.875rem;
        margin-bottom: 4px;
        span.material-icons-round { font-size: 20px; }
      }
      p { font-size: 0.75rem; color: #7f1d1d; margin: 0 0 8px 0; }
    }
    .reviewer-helpline-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .helpline-chip {
      background: #ffffff;
      border: 1px solid #fca5a5;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #991b1b;
    }
    .reviewer-jurisdiction-banner {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
      .banner-hdr {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #6d28d9;
        font-size: 0.875rem;
        margin-bottom: 4px;
        span.material-icons-round { font-size: 20px; }
      }
      p { font-size: 0.75rem; color: #4b5563; margin: 0; line-height: 1.4; }
    }
    .reviewer-quality-alert {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 8px;
      span.material-icons-round { font-size: 16px; color: #d97706; }
    }
    .photo-wrapper {
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
      border: 1px solid var(--border);
      .evidence-img { width: 100%; max-height: 320px; object-fit: cover; display: block; }
    }
    .desc-box {
      background: #f8fafc;
      padding: 14px;
      border-radius: 8px;
      margin-bottom: 14px;
      h4 { font-size: 0.8125rem; font-weight: 700; color: #475569; margin-bottom: 4px; }
      p { font-size: 0.875rem; color: #0f172a; line-height: 1.4; }
    }
    .transcript-box {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--border);
      strong { font-size: 0.75rem; color: #0d9488; }
      p { font-size: 0.8125rem; font-style: italic; color: #475569; }
    }
    .location-box {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
      color: #64748b;
      .coord-tag { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    }
    .duplicate-review-card {
      border: 1px solid #fde68a;
      background: #fffbeb;
      h3 { font-size: 1rem; font-weight: 700; color: #92400e; }
      .text-amber { color: #d97706; }
      .status-tag { font-size: 0.6875rem; font-weight: 700; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; }
    }
    .dup-explanation {
      font-size: 0.8125rem;
      color: #78350f;
      margin-bottom: 14px;
      line-height: 1.4;
    }
    .dup-item-box {
      background: white;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .dup-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 0.8125rem;
      color: #0f172a;
    }
    .score-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      background: #fed7aa;
      color: #9a3412;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .dist-meta { font-size: 0.75rem; color: #64748b; margin-bottom: 10px; }
    .dup-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .actions-col {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .action-card {
      h3 { font-size: 1rem; font-weight: 700; color: #0f172a; }
      .tool-sub { font-size: 0.75rem; color: #64748b; margin-bottom: 14px; }
    }
    .resolution-action-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      h4 { font-size: 0.9375rem; font-weight: 700; color: #15803d; margin-bottom: 4px; }
      p { font-size: 0.8125rem; color: #166534; margin-bottom: 12px; }
    }
    .btn-sm { padding: 6px 12px; font-size: 0.8125rem; }
    .btn-xs { padding: 4px 8px; font-size: 0.75rem; }
  `]
})
export class ReviewerCaseDetailComponent implements OnInit {
  caseItem = signal<CivicCase | null>(null);
  serviceTeams = signal<ServiceTeam[]>([]);
  duplicates = signal<DuplicateRelation[]>([]);

  // Override State
  selectedPriority = 'P3';
  priorityRationale = '';

  // Assignment State
  selectedTeamId = '';
  customHours: number | null = null;
  assignmentNotes = '';

  // Status Progression State
  nextStatus = 'Acknowledged';
  rejectionReason = '';
  statusNotes = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    public i18n: I18nService
  ) {}

  getLanguageLabel(code: string): string {
    const item = this.i18n.getSupportedLanguages().find(l => l.code === code);
    return item ? `${item.name} (${item.nativeName})` : code;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCase(id);
      this.loadTeams();
      this.loadDuplicates(id);
    }
  }

  loadCase(id: string) {
    this.api.getCaseById(id).subscribe({
      next: (c) => {
        this.caseItem.set(c);
        this.selectedPriority = c.priority;
        this.selectedTeamId = c.assignedTeamId || '';
        this.customHours = c.targetResponseHours || null;
      },
      error: () => {}
    });
  }

  loadTeams() {
    this.api.getTeams().subscribe({
      next: (teams) => this.serviceTeams.set(teams),
      error: () => {}
    });
  }

  loadDuplicates(id: string) {
    this.api.getDuplicates(id).subscribe({
      next: (dups) => this.duplicates.set(dups),
      error: () => {}
    });
  }

  feedbackMessage = signal<string | null>(null);

  savePriorityOverride() {
    const id = this.caseItem()?.id;
    if (!id) return;
    this.api.overridePriority(id, {
      priority: this.selectedPriority,
      rationale: this.priorityRationale.trim() || 'Reviewed and updated by authorized municipal officer.'
    }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.feedbackMessage.set(`Priority updated to ${this.selectedPriority}`);
      },
      error: (err) => this.feedbackMessage.set(err.error?.message || 'Failed to override priority.')
    });
  }

  assignTeam() {
    const id = this.caseItem()?.id;
    if (!id || !this.selectedTeamId) return;

    this.api.assignTeam(id, {
      teamId: this.selectedTeamId,
      targetResponseHours: this.customHours ?? undefined,
      notes: this.assignmentNotes.trim() || undefined
    }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.feedbackMessage.set(`Case assigned to ${updated.assignedTeamName} with target response of ${updated.targetResponseHours} hours.`);
      },
      error: (err) => this.feedbackMessage.set(err.error?.message || 'Failed to assign team.')
    });
  }

  updateStatus() {
    const id = this.caseItem()?.id;
    if (!id) return;

    this.api.updateStatus(id, {
      status: this.nextStatus,
      rejectionReason: this.nextStatus === 'Rejected' ? this.rejectionReason : undefined,
      notes: this.statusNotes || undefined
    }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.feedbackMessage.set(`Status updated to ${this.nextStatus}`);
      },
      error: (err) => this.feedbackMessage.set(err.error?.message || 'Failed to update status.')
    });
  }

  confirmDuplicate(primaryId: string) {
    const id = this.caseItem()?.id;
    if (!id) return;

    this.api.reviewDuplicate(id, { action: 'confirm', primaryCaseId: primaryId }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.feedbackMessage.set(`Duplicate confirmed and linked to ${primaryId}. Original report preserved.`);
      },
      error: () => {}
    });
  }

  rejectDuplicate() {
    const id = this.caseItem()?.id;
    if (!id) return;

    this.api.reviewDuplicate(id, { action: 'reject' }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.feedbackMessage.set('Report marked as distinct incident.');
      },
      error: () => {}
    });
  }

  getStatusBadgeClass(status: string): string {
    const s = status.toLowerCase().replace(/ /g, '-');
    return `badge-status-${s}`;
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
      { name: 'Tele-MANAS Mental Health', number: '14416', description: '24/7 National Mental Health Helpline' },
      { name: 'Women Helpline', number: '1091', description: '24/7 Dedicated Women Distress Helpline' },
      { name: 'Childline India', number: '1098', description: '24/7 Free Helpline for Children in Distress' }
    ];
  }
}
