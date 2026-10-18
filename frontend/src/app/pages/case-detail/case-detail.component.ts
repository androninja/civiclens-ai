import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { CivicCase, CaseActivityLog, EmergencyHelpline } from '../../models/case.model';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    @if (caseItem()) {
      <div class="case-detail-page container">
      <!-- Breadcrumb & Top Bar -->
      <div class="top-nav-bar">
        <a [routerLink]="auth.isReviewer() ? '/dashboard' : '/my-reports'" class="back-link">
          <span class="material-icons-round">arrow_back</span>
          <span>Back to {{ auth.isReviewer() ? 'Reviewer Queue' : 'My Reports' }}</span>
        </a>

        <div class="top-actions">
          @if (canModifyCase()) {
            <button class="btn btn-secondary btn-sm" (click)="openEditModal()">
              <span class="material-icons-round">edit</span>
              <span>Modify Report</span>
            </button>
            <button class="btn btn-danger btn-sm" (click)="confirmDeleteCase()">
              <span class="material-icons-round">delete</span>
              <span>Delete Report</span>
            </button>
          }
          @if (auth.isReviewer()) {
            <a [routerLink]="['/reviewer/cases', caseItem()?.id]" class="btn btn-primary btn-sm">
              <span class="material-icons-round">edit</span>
              <span>Review & Assign Team</span>
            </a>
          }
        </div>
      </div>

      <!-- Case Header Card -->
      <div class="civic-card header-card">
        <div class="header-main">
          <div class="header-titles">
            <div class="id-row">
              <span class="case-id">{{ caseItem()?.id }}</span>
              <span class="badge" [class.badge-p1]="caseItem()?.priority === 'P1'"
                                  [class.badge-p2]="caseItem()?.priority === 'P2'"
                                  [class.badge-p3]="caseItem()?.priority === 'P3'"
                                  [class.badge-p4]="caseItem()?.priority === 'P4'">
                {{ caseItem()?.priority }} Priority
              </span>
              <span class="badge" [ngClass]="getStatusBadgeClass(caseItem()?.status || '')">
                {{ caseItem()?.status }}
              </span>
              @if (caseItem()?.isDemo) {
                <span class="demo-tag">Synthetic Demo Case</span>
              }
            </div>
            <h1>{{ caseItem()?.title }}</h1>
            <div class="meta-row">
              <span><span class="material-icons-round meta-icon">person</span> Reported by {{ caseItem()?.citizenName }}</span>
              <span><span class="material-icons-round meta-icon">schedule</span> {{ caseItem()?.createdAt | date:'medium' }}</span>
              <span><span class="material-icons-round meta-icon">category</span> {{ caseItem()?.category }}</span>
              <span><span class="material-icons-round meta-icon">translate</span> Language: {{ getLanguageLabel(caseItem()?.language || 'en') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Layout: Evidence & AI Insights vs Timeline -->
      <div class="detail-layout">
        <div class="main-column">
          <!-- Emergency Helplines Notice (if triggered) -->
          @if (caseItem()?.hasEmergencySafetyTrigger) {
            <div class="emergency-crisis-card">
              <div class="emergency-crisis-top">
                <span class="material-icons-round emergency-icon">crisis_alert</span>
                <div>
                  <h3>Immediate Crisis & Safety Support ({{ caseItem()?.emergencyType || 'Urgent Concern' }})</h3>
                  <p class="crisis-sub">Direct 24/7 National Emergency Helplines</p>
                </div>
              </div>
              <p class="crisis-desc">
                If you or anyone in the area is facing imminent peril, distress, or abuse, please contact these verified 24/7 helplines directly:
              </p>
              <div class="crisis-helpline-grid">
                @for (helpline of getEmergencyHelplines(); track helpline.number) {
                  <div class="crisis-helpline-item">
                    <div class="helpline-meta">
                      <strong>{{ helpline.name }}</strong>
                      <span>{{ helpline.description }}</span>
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

          <!-- Non-Civic Matter / Outside Jurisdiction Flag -->
          @if (caseItem()?.isNonCivicIssue) {
            <div class="non-civic-jurisdiction-banner">
              <div class="banner-title-row">
                <span class="material-icons-round">gavel</span>
                <strong>Outside Municipal Jurisdiction / Non-Civic Issue</strong>
              </div>
              <p class="banner-desc">{{ caseItem()?.nonCivicReason || 'This issue involves internal private household property or personal disputes outside the jurisdiction of municipal civic authorities.' }}</p>
            </div>
          }

          <!-- Citizen Evidence Card -->
          <div class="civic-card detail-card">
            <h2>Incident Evidence & Report Details</h2>

            <!-- Original Photo -->
            @if (caseItem()?.photoUrl) {
              <div class="evidence-media-box">
                <img [src]="caseItem()?.photoUrl" alt="Reported Evidence" class="evidence-img" />
                @if (caseItem()?.isPhotoUnclear) {
                  <div class="media-quality-tag warning-tag">
                    <span class="material-icons-round">no_photography</span>
                    <span>Photo Not Clear: {{ caseItem()?.photoQualityIssue || 'Image is blurry or low visibility.' }}</span>
                  </div>
                }
              </div>
            }

            <!-- Voice Recording Audio & Transcript -->
            @if (caseItem()?.audioUrl || caseItem()?.editedTranscript || caseItem()?.isAudioUnclear) {
              <div class="audio-evidence-box">
                <div class="audio-header">
                  <span class="material-icons-round">mic</span>
                  <strong>Citizen Voice Recording & Transcript ({{ getLanguageLabel(caseItem()?.language || 'en') }})</strong>
                </div>
                @if (caseItem()?.audioUrl) {
                  <audio controls [src]="caseItem()?.audioUrl" class="w-full audio-player"></audio>
                }
                @if (caseItem()?.isAudioUnclear) {
                  <div class="media-quality-tag warning-tag">
                    <span class="material-icons-round">volume_off</span>
                    <span>Audio Not Clear: {{ caseItem()?.audioQualityIssue || 'Voice recording has low clarity or was muffled.' }}</span>
                  </div>
                }
                @if (caseItem()?.editedTranscript) {
                  <blockquote class="transcript-quote">
                    "{{ caseItem()?.editedTranscript }}"
                  </blockquote>
                }
              </div>
            }

            <!-- Text Description -->
            <div class="desc-section">
              <h3>Original Description:</h3>
              <p class="desc-text">{{ caseItem()?.rawDescription }}</p>
            </div>

            <!-- Location & Map -->
            <div class="location-section">
              <h3>Confirmed Location:</h3>
              <p class="location-text">
                <span class="material-icons-round">place</span>
                {{ caseItem()?.locationAddress || 'Address not specified' }}
              </p>
              @if (caseItem()?.latitude && caseItem()?.longitude) {
                <div class="coords-pill">
                  Coordinates: Lat {{ caseItem()?.latitude }}, Lon {{ caseItem()?.longitude }}
                </div>
              }
            </div>
          </div>

          <!-- AI Understanding Card -->
          <div class="civic-card detail-card ai-insights-card">
            <div class="ai-header-row">
              <div class="title-with-icon">
                <span class="material-icons-round text-teal">psychology</span>
                <h2>Server-Side Gemini AI Analysis</h2>
              </div>
              <span class="model-badge">{{ caseItem()?.aiModelUsed || 'Gemini 1.5 Flash' }}</span>
            </div>

            <div class="ai-details-grid">
              <div class="ai-item">
                <span class="lbl">Concise Summary:</span>
                <span class="val">{{ caseItem()?.conciseSummary }}</span>
              </div>
              <div class="ai-item">
                <span class="lbl">Normalized Description:</span>
                <span class="val">{{ caseItem()?.normalizedDescription }}</span>
              </div>
              <div class="ai-item">
                <span class="lbl">Subcategory:</span>
                <span class="val">{{ caseItem()?.subcategory }}</span>
              </div>
              <div class="ai-item">
                <span class="lbl">AI Confidence:</span>
                <span class="val">{{ (caseItem()?.aiConfidence || 0) * 100 | number:'1.0-0' }}%</span>
              </div>

              <div class="ai-item full">
                <span class="lbl">Priority Evaluation & Rationale:</span>
                <p class="val-text">{{ caseItem()?.priorityRationale }}</p>
              </div>

              @if (parsedRules().length > 0) {
                <div class="ai-item full">
                  <span class="lbl">Triggered Priority Rules:</span>
                  <ul class="rules-list">
                    @for (rule of parsedRules(); track rule) {
                      <li><span class="material-icons-round rule-check">check_circle</span> {{ rule }}</li>
                    }
                  </ul>
                </div>
              }

              @if (caseItem()?.safetyConcerns) {
                <div class="alert-box danger full">
                  <span class="material-icons-round">warning</span>
                  <div>
                    <strong>Safety Concerns Identified:</strong>
                    <p>{{ caseItem()?.safetyConcerns }}</p>
                  </div>
                </div>
              }

              @if (caseItem()?.missingInformation) {
                <div class="alert-box info full">
                  <span class="material-icons-round">info</span>
                  <div>
                    <strong>Recommended Next Steps / Missing Data:</strong>
                    <p>{{ caseItem()?.missingInformation }}</p>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Resolution Evidence Card (If Resolution Submitted or Resolved) -->
          @if (caseItem()?.resolutionPhotoUrl || caseItem()?.status === 'Resolved' || caseItem()?.status === 'Resolution Submitted') {
            <div class="civic-card detail-card resolution-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <span class="material-icons-round text-green">verified</span>
                  <h2>Resolution Evidence & Verification</h2>
                </div>
                <span class="badge badge-status-resolved">Resolved Evidence</span>
              </div>

              <div class="resolution-comparison">
                <div class="photo-col">
                  <span class="col-title">Before (Original Issue):</span>
                  <img [src]="caseItem()?.photoUrl || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400'" alt="Before" class="comp-img" />
                </div>
                <div class="photo-col">
                  <span class="col-title">After (Resolution Evidence):</span>
                  <img [src]="caseItem()?.resolutionPhotoUrl || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400'" alt="After" class="comp-img" />
                </div>
              </div>

              <div class="resolution-notes">
                <strong>Resolution Description:</strong>
                <p>{{ caseItem()?.resolutionDescription || 'Municipal team completed repair and site cleanup.' }}</p>
                <div class="signoff-meta">
                  Signed off by <strong>{{ caseItem()?.resolutionReviewerName || 'Municipal Inspector' }}</strong> on {{ caseItem()?.resolutionDate | date:'mediumDate' }}
                </div>
              </div>

              <!-- Citizen Dispute / Review Request Option -->
              @if (caseItem()?.status === 'Resolved') {
                <div class="dispute-box">
                  <div class="dispute-header">
                    <h4>Is this issue still not fixed?</h4>
                    <p>Citizens can challenge resolution evidence if work is incomplete.</p>
                  </div>

                  @if (!showDisputeForm() && !caseItem()?.hasCitizenReviewRequest) {
                    <button class="btn btn-secondary btn-sm" (click)="showDisputeForm.set(true)">
                      <span class="material-icons-round">report_problem</span>
                      <span>Request Re-inspection / Dispute Resolution</span>
                    </button>
                  } @else if (showDisputeForm()) {
                    <div class="dispute-form">
                      <textarea [(ngModel)]="disputeReason" rows="3" placeholder="Explain why the problem is still unresolved..."></textarea>
                      <div class="dispute-btns">
                        <button class="btn btn-danger btn-sm" (click)="submitDispute()" [disabled]="!disputeReason.trim()">
                          Submit Review Request
                        </button>
                        <button class="btn btn-secondary btn-sm" (click)="showDisputeForm.set(false)">
                          Cancel
                        </button>
                      </div>
                    </div>
                  } @else if (caseItem()?.hasCitizenReviewRequest) {
                    <div class="dispute-submitted-banner">
                      <span class="material-icons-round">schedule</span>
                      <span>Review requested by citizen: "{{ caseItem()?.citizenReviewReason }}"</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Sidebar: Status Timeline & Audit History -->
        <div class="sidebar-column">
          <!-- Assignment Card -->
          <div class="civic-card sidebar-card">
            <h3>Service Team Assignment</h3>
            @if (caseItem()?.assignedTeamName) {
              <div class="team-assigned-box">
                <span class="material-icons-round team-badge-icon">engineering</span>
                <div>
                  <strong>{{ caseItem()?.assignedTeamName }}</strong>
                  <div class="sla-text">Target SLA: {{ caseItem()?.targetResponseHours }} Hours</div>
                </div>
              </div>
            } @else {
              <div class="unassigned-notice">
                <span class="material-icons-round">hourglass_empty</span>
                <span>Awaiting service team triage and routing.</span>
              </div>
            }
          </div>

          <!-- Activity Log & Status Progression Timeline -->
          <div class="civic-card sidebar-card">
            <h3>Status & Audit Timeline</h3>
            <div class="timeline-container">
              @for (log of activityLogs(); track log.id) {
                <div class="timeline-node">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-action">{{ log.action }}</div>
                    <div class="timeline-user">By {{ log.userName }}</div>
                    @if (log.notes) {
                      <div class="timeline-notes">{{ log.notes }}</div>
                    }
                    <div class="timeline-time">{{ log.timestamp | date:'short' }}</div>
                  </div>
                </div>
              } @empty {
                <div class="timeline-empty">Initial submission logged.</div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Case Modal -->
      @if (showEditModal()) {
        <div class="modal-backdrop" (click)="closeEditModal()">
          <div class="modal-container" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>
                <span class="material-icons-round text-primary">edit_note</span>
                <span>Modify Reported Incident</span>
              </h3>
              <button class="close-btn" (click)="closeEditModal()">
                <span class="material-icons-round">close</span>
              </button>
            </div>
            <div class="modal-body">
              @if (editError()) {
                <div class="alert-box danger">
                  <span class="material-icons-round">error</span>
                  <span>{{ editError() }}</span>
                </div>
              }
              <div class="form-group-modal">
                <label>Incident Title:</label>
                <input type="text" [(ngModel)]="editTitle" placeholder="Short descriptive title..." />
              </div>
              <div class="form-group-modal">
                <label>Issue Category:</label>
                <select [(ngModel)]="editCategory">
                  <option value="Road damage and potholes">Road damage and potholes</option>
                  <option value="Waste and sanitation">Waste and sanitation</option>
                  <option value="Water leakage and drainage">Water leakage and drainage</option>
                  <option value="Broken streetlights">Broken streetlights</option>
                  <option value="Public safety and accessibility">Public safety and accessibility</option>
                  <option value="Traffic signals and road signage">Traffic signals and road signage</option>
                  <option value="Parks, trees and public greenery">Parks, trees and public greenery</option>
                  <option value="Stray animals and public health">Stray animals and public health</option>
                  <option value="Air, noise and environmental pollution">Air, noise and environmental pollution</option>
                  <option value="Public transport and bus shelters">Public transport and bus shelters</option>
                  <option value="Encroachment and illegal hoarding">Encroachment and illegal hoarding</option>
                  <option value="Other civic issues">Other civic issues</option>
                </select>
              </div>
              <div class="form-group-modal">
                <label>Description of the Problem:</label>
                <textarea rows="4" [(ngModel)]="editDescription" placeholder="Detailed description of the issue..."></textarea>
              </div>
              <div class="form-group-modal">
                <label>Location / Landmark Address:</label>
                <input type="text" [(ngModel)]="editLocationAddress" placeholder="Street name, landmark, or area..." />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" (click)="closeEditModal()" [disabled]="isSavingEdit()">
                Cancel
              </button>
              <button class="btn btn-primary btn-sm btn-save-edit" (click)="saveCaseModifications()" [disabled]="isSavingEdit()">
                @if (isSavingEdit()) {
                  <span class="material-icons-round spin">sync</span>
                  <span>Saving Changes...</span>
                } @else {
                  <span class="material-icons-round">check</span>
                  <span>Save Modifications</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (showDeleteModal()) {
        <div class="modal-backdrop" (click)="closeDeleteModal()">
          <div class="modal-container" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>
                <span class="material-icons-round text-danger">warning</span>
                <span>Confirm Deletion</span>
              </h3>
              <button class="close-btn" (click)="closeDeleteModal()">
                <span class="material-icons-round">close</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="delete-confirm-box">
                <span class="material-icons-round delete-warn-icon">delete_forever</span>
                <h4>Delete this Incident Report?</h4>
                <p>Are you sure you want to permanently delete report <strong>#{{ caseItem()?.id }}</strong>?</p>
                <p class="delete-warn-note">This action cannot be undone. All associated logs, evidence, and records will be removed.</p>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" (click)="closeDeleteModal()" [disabled]="isDeleting()">
                Cancel
              </button>
              <button class="btn btn-danger btn-sm btn-confirm-delete" (click)="deleteCurrentCase()" [disabled]="isDeleting()">
                @if (isDeleting()) {
                  <span class="material-icons-round spin">sync</span>
                  <span>Deleting...</span>
                } @else {
                  <span class="material-icons-round">delete</span>
                  <span>Yes, Delete Report</span>
                }
              </button>
            </div>
          </div>
        </div>
      }
      </div>
    } @else {
      <div class="loading-container">
        <span class="material-icons-round spin">sync</span>
        <span>Loading case details and audit history...</span>
      </div>
    }
  `,
  styles: [`
    .case-detail-page {
      padding: 32px 20px 64px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .top-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .back-link {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #64748b;
      text-decoration: none;
      &:hover { color: #0d9488; }
    }
    .header-card {
      margin-bottom: 24px;
      padding: 24px;
    }
    .id-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .case-id {
      font-size: 1.125rem;
      font-weight: 800;
      color: #0d9488;
    }
    .demo-tag {
      background: #f1f5f9;
      color: #64748b;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 700;
      border: 1px solid var(--border);
    }
    h1 {
      font-size: 1.625rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 12px;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 0.8125rem;
      color: #64748b;
      flex-wrap: wrap;
      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .meta-icon { font-size: 16px; color: #94a3b8; }
    }
    .detail-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 24px;
      align-items: flex-start;
    }
    @media (max-width: 960px) {
      .detail-layout { grid-template-columns: 1fr; }
    }
    .detail-card {
      margin-bottom: 24px;
      h2 { font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    }
    .emergency-crisis-card {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.12);
    }
    .emergency-crisis-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      .emergency-icon { font-size: 28px; color: #dc2626; }
      h3 { font-size: 1.0625rem; font-weight: 800; color: #b91c1c; margin: 0; }
      .crisis-sub { font-size: 0.75rem; color: #7f1d1d; margin: 2px 0 0 0; }
    }
    .crisis-desc {
      font-size: 0.8125rem;
      color: #374151;
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .crisis-helpline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 10px;
    }
    .crisis-helpline-item {
      background: #ffffff;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .non-civic-jurisdiction-banner {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 20px;
      .banner-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #6d28d9;
        font-size: 0.9375rem;
        margin-bottom: 4px;
        span.material-icons-round { font-size: 20px; }
      }
      .banner-desc {
        font-size: 0.8125rem;
        color: #4b5563;
        margin: 0;
        line-height: 1.4;
      }
    }
    .media-quality-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 8px;
      &.warning-tag {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
        span.material-icons-round { font-size: 16px; color: #d97706; }
      }
    }
    .evidence-media-box {
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
      border: 1px solid var(--border);
    }
    .evidence-img {
      width: 100%;
      max-height: 380px;
      object-fit: cover;
      display: block;
    }
    .audio-evidence-box {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .audio-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .audio-player { width: 100%; height: 36px; margin-bottom: 8px; }
    .transcript-quote {
      font-style: italic;
      color: #475569;
      font-size: 0.875rem;
      border-left: 3px solid #0d9488;
      padding-left: 12px;
    }
    .desc-section, .location-section {
      margin-bottom: 16px;
      h3 { font-size: 0.875rem; font-weight: 700; color: #475569; margin-bottom: 4px; }
      .desc-text { font-size: 0.9375rem; color: #0f172a; line-height: 1.5; }
      .location-text { display: flex; align-items: center; gap: 4px; font-size: 0.875rem; color: #0f172a; }
    }
    .coords-pill {
      display: inline-block;
      margin-top: 6px;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #64748b;
      font-family: monospace;
    }
    .ai-insights-card {
      border-left: 4px solid #0d9488;
    }
    .ai-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 8px;
      .text-teal { color: #0d9488; font-size: 22px; }
    }
    .model-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .ai-details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .ai-item {
      &.full { grid-column: span 2; }
      .lbl { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 2px; }
      .val { font-size: 0.875rem; color: #0f172a; font-weight: 600; }
      .val-text { font-size: 0.875rem; color: #334155; line-height: 1.5; }
    }
    .rules-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
      li {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8125rem;
        color: #334155;
        .rule-check { font-size: 16px; color: #059669; }
      }
    }
    .alert-box {
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.8125rem;
      &.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
      &.info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    }
    .resolution-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
      .col-title { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 6px; }
      .comp-img { width: 100%; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
    }
    .resolution-notes {
      background: #f8fafc;
      padding: 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      strong { font-size: 0.8125rem; color: #0f172a; }
      p { font-size: 0.875rem; color: #334155; margin: 4px 0 8px; }
      .signoff-meta { font-size: 0.75rem; color: #64748b; }
    }
    .dispute-box {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      h4 { font-size: 0.875rem; font-weight: 700; color: #0f172a; }
      p { font-size: 0.75rem; color: #64748b; margin-bottom: 10px; }
    }
    .dispute-form {
      textarea { width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8125rem; margin-bottom: 8px; }
      .dispute-btns { display: flex; gap: 8px; }
    }
    .dispute-submitted-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff1f2;
      color: #be123c;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.8125rem;
    }
    .sidebar-card {
      margin-bottom: 20px;
      h3 { font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    }
    .team-assigned-box {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 12px;
      border-radius: 8px;
      .team-badge-icon { font-size: 28px; color: #16a34a; }
      strong { font-size: 0.875rem; color: #15803d; }
      .sla-text { font-size: 0.75rem; color: #166534; }
    }
    .unassigned-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      font-size: 0.8125rem;
    }
    .timeline-container {
      position: relative;
      padding-left: 20px;
      &::before {
        content: '';
        position: absolute;
        top: 8px;
        bottom: 8px;
        left: 6px;
        width: 2px;
        background: #e2e8f0;
      }
    }
    .timeline-node {
      position: relative;
      margin-bottom: 16px;
    }
    .timeline-dot {
      position: absolute;
      left: -20px;
      top: 4px;
      width: 10px;
      height: 10px;
      background: #0d9488;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #0d9488;
    }
    .timeline-action { font-size: 0.8125rem; font-weight: 700; color: #0f172a; }
    .timeline-user { font-size: 0.6875rem; color: #64748b; }
    .timeline-notes { font-size: 0.75rem; color: #334155; background: #f8fafc; padding: 4px 8px; border-radius: 4px; margin-top: 4px; }
    .timeline-time { font-size: 0.6875rem; color: #94a3b8; margin-top: 2px; }
    .timeline-empty { font-size: 0.75rem; color: #94a3b8; }
    .loading-container {
      padding: 80px 20px;
      text-align: center;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-container {
      background: #ffffff;
      border-radius: 16px;
      max-width: 560px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      h3 { font-size: 1.125rem; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px; }
      .close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; border-radius: 50%; padding: 4px; display: flex; align-items: center; justify-content: center; }
      .close-btn:hover { background: #f1f5f9; color: #0f172a; }
    }
    .modal-body {
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .modal-footer {
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }
    .form-group-modal {
      display: flex;
      flex-direction: column;
      gap: 6px;
      label { font-size: 0.8125rem; font-weight: 700; color: #334155; }
      input, select, textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.875rem;
        font-family: inherit;
        box-sizing: border-box;
        &:focus { outline: none; border-color: #0d9488; }
      }
    }
    .delete-confirm-box {
      text-align: center;
      padding: 10px 0;
      .delete-warn-icon { font-size: 52px; color: #dc2626; margin-bottom: 8px; }
      h4 { font-size: 1.125rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
      p { font-size: 0.875rem; color: #64748b; line-height: 1.5; margin: 0; }
      .delete-warn-note { font-size: 0.75rem; color: #94a3b8; margin-top: 6px; }
    }
  `]
})
export class CaseDetailComponent implements OnInit {
  caseItem = signal<CivicCase | null>(null);
  activityLogs = signal<CaseActivityLog[]>([]);
  showDisputeForm = signal(false);
  disputeReason = '';

  // Edit modal state
  showEditModal = signal(false);
  isSavingEdit = signal(false);
  editError = signal<string | null>(null);
  editTitle = '';
  editCategory = 'Road damage and potholes';
  editDescription = '';
  editLocationAddress = '';

  // Delete modal state
  showDeleteModal = signal(false);
  isDeleting = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService,
    public i18n: I18nService
  ) {}

  getLanguageLabel(code: string): string {
    const item = this.i18n.getSupportedLanguages().find(l => l.code === code);
    return item ? `${item.name} (${item.nativeName})` : code;
  }

  canModifyCase(): boolean {
    const c = this.caseItem();
    if (!c) return false;
    const user = this.auth.currentUser();
    if (user.role === 'Administrator') return true;
    if (user.role === 'Citizen') {
      return !c.citizenId || c.citizenId === user.userId;
    }
    return false;
  }

  openEditModal() {
    const c = this.caseItem();
    if (!c) return;
    this.editTitle = c.title || '';
    this.editCategory = c.category || 'Other civic issues';
    this.editDescription = c.rawDescription || '';
    this.editLocationAddress = c.locationAddress || '';
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editError.set(null);
  }

  saveCaseModifications() {
    const id = this.caseItem()?.id;
    if (!id) return;
    if (!this.editDescription.trim()) {
      this.editError.set('Description cannot be empty.');
      return;
    }
    this.isSavingEdit.set(true);
    this.editError.set(null);

    this.api.updateCase(id, {
      title: this.editTitle.trim() || undefined,
      category: this.editCategory,
      description: this.editDescription.trim(),
      locationAddress: this.editLocationAddress.trim() || undefined
    }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.isSavingEdit.set(false);
        this.showEditModal.set(false);
        this.loadLogs(id);
      },
      error: (err) => {
        this.isSavingEdit.set(false);
        this.editError.set(err.error?.message || 'Failed to update report details.');
      }
    });
  }

  confirmDeleteCase() {
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
  }

  deleteCurrentCase() {
    const id = this.caseItem()?.id;
    if (!id) return;
    this.isDeleting.set(true);
    this.api.deleteCase(id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.showDeleteModal.set(false);
        this.router.navigate(['/my-reports']);
      },
      error: (err) => {
        this.isDeleting.set(false);
        alert(err.error?.message || 'Failed to delete report.');
      }
    });
  }

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
        this.loadLogs(id);
      },
      error: () => {}
    });
  }

  loadLogs(id: string) {
    this.api.getActivityLogs(id).subscribe({
      next: (logs) => this.activityLogs.set(logs),
      error: () => {}
    });
  }

  parsedRules(): string[] {
    const raw = this.caseItem()?.priorityRulesTriggered;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  submitDispute() {
    const id = this.caseItem()?.id;
    if (!id || !this.disputeReason.trim()) return;

    this.api.requestCitizenReview(id, { reason: this.disputeReason.trim() }).subscribe({
      next: (updated) => {
        this.caseItem.set(updated);
        this.showDisputeForm.set(false);
        this.loadLogs(id);
      },
      error: (err) => alert(err.error?.message || 'Failed to submit review request.')
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
