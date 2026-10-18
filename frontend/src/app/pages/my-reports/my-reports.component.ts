import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CivicCase } from '../../models/case.model';

@Component({
  selector: 'app-my-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="my-reports-page container">
      <div class="page-header">
        <div>
          <h1>My Reported Incidents</h1>
          <p>Track progress, response targets, and resolution sign-offs for your civic reports</p>
        </div>
        <a routerLink="/report" class="btn btn-primary">
          <span class="material-icons-round">add_a_photo</span>
          <span>Submit New Report</span>
        </a>
      </div>

      <!-- Filters Row -->
      <div class="filters-row">
        <button
          class="filter-pill"
          [class.active]="selectedStatus() === 'ALL'"
          (click)="setStatusFilter('ALL')">
          All ({{ cases().length }})
        </button>
        <button
          class="filter-pill"
          [class.active]="selectedStatus() === 'Needs Review'"
          (click)="setStatusFilter('Needs Review')">
          Pending Review
        </button>
        <button
          class="filter-pill"
          [class.active]="selectedStatus() === 'In Progress'"
          (click)="setStatusFilter('In Progress')">
          In Progress
        </button>
        <button
          class="filter-pill"
          [class.active]="selectedStatus() === 'Resolved'"
          (click)="setStatusFilter('Resolved')">
          Resolved
        </button>
      </div>

      <!-- Cases List Grid -->
      <div class="cases-grid">
        @for (c of filteredCases(); track c.id) {
          <div class="civic-card case-card">
            <div class="card-top">
              <span class="case-id">{{ c.id }}</span>
              <div class="badges-group">
                <span class="badge" [class.badge-p1]="c.priority === 'P1'"
                                    [class.badge-p2]="c.priority === 'P2'"
                                    [class.badge-p3]="c.priority === 'P3'"
                                    [class.badge-p4]="c.priority === 'P4'">
                  {{ c.priority }}
                </span>
                <span class="badge" [ngClass]="getStatusBadgeClass(c.status)">
                  {{ c.status }}
                </span>
              </div>
            </div>

            <div class="card-body">
              @if (c.photoUrl) {
                <img [src]="c.photoUrl" alt="Case Photo" class="case-thumb" />
              }
              <div class="case-info">
                <h3 class="case-title">{{ c.title }}</h3>
                <p class="case-category">
                  <span class="material-icons-round category-icon">category</span>
                  {{ c.category }}
                </p>
                @if (c.locationAddress) {
                  <p class="case-location">
                    <span class="material-icons-round location-icon">place</span>
                    {{ c.locationAddress }}
                  </p>
                }
                @if (c.assignedTeamName) {
                  <p class="case-team">
                    <span class="material-icons-round team-icon">engineering</span>
                    Assigned: {{ c.assignedTeamName }}
                  </p>
                }
              </div>
            </div>

            @if (c.audioUrl) {
              <div class="card-audio-player">
                <div class="audio-badge">
                  <span class="material-icons-round audio-icon">mic</span>
                  <span>Recorded Voice Note:</span>
                </div>
                <audio [src]="c.audioUrl" controls preload="none" class="case-audio-ctrl"></audio>
              </div>
            }

            <div class="card-footer">
              <span class="time-text">{{ c.createdAt | date:'mediumDate' }}</span>
              <div class="card-footer-actions">
                <button class="btn-action-icon" title="Modify Report" (click)="openQuickEdit(c)">
                  <span class="material-icons-round">edit</span>
                </button>
                <button class="btn-action-icon text-danger" title="Delete Report" (click)="confirmQuickDelete(c)">
                  <span class="material-icons-round">delete_outline</span>
                </button>
                <a [routerLink]="['/cases', c.id]" class="btn btn-secondary btn-sm">
                  <span>Details</span>
                  <span class="material-icons-round">arrow_forward</span>
                </a>
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <span class="material-icons-round empty-icon">inbox</span>
            <h3>No reports found</h3>
            <p>You haven't submitted any civic reports under this filter yet.</p>
            <a routerLink="/report" class="btn btn-primary">Start a Report</a>
          </div>
        }
      </div>

      <!-- Quick Edit Modal -->
      @if (showEditModal()) {
        <div class="modal-backdrop" (click)="closeQuickEdit()">
          <div class="modal-container" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>
                <span class="material-icons-round text-primary">edit_note</span>
                <span>Modify Report #{{ selectedCaseForEdit()?.id }}</span>
              </h3>
              <button class="close-btn" (click)="closeQuickEdit()">
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
                <label>Description:</label>
                <textarea rows="4" [(ngModel)]="editDescription" placeholder="Detailed description of the issue..."></textarea>
              </div>
              <div class="form-group-modal">
                <label>Location / Landmark Address:</label>
                <input type="text" [(ngModel)]="editLocationAddress" placeholder="Street name, landmark, or area..." />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" (click)="closeQuickEdit()" [disabled]="isSavingEdit()">
                Cancel
              </button>
              <button class="btn btn-primary btn-sm btn-save-quick-edit" (click)="saveQuickEdit()" [disabled]="isSavingEdit()">
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

      <!-- Quick Delete Modal -->
      @if (showDeleteModal()) {
        <div class="modal-backdrop" (click)="closeQuickDelete()">
          <div class="modal-container" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>
                <span class="material-icons-round text-danger">warning</span>
                <span>Confirm Deletion</span>
              </h3>
              <button class="close-btn" (click)="closeQuickDelete()">
                <span class="material-icons-round">close</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="delete-confirm-box">
                <span class="material-icons-round delete-warn-icon">delete_forever</span>
                <h4>Delete this Incident Report?</h4>
                <p>Are you sure you want to permanently delete report <strong>#{{ selectedCaseForDelete()?.id }}</strong>?</p>
                <p class="delete-warn-note">This action cannot be undone. All associated logs, evidence, and records will be removed.</p>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" (click)="closeQuickDelete()" [disabled]="isDeleting()">
                Cancel
              </button>
              <button class="btn btn-danger btn-sm btn-confirm-quick-delete" (click)="deleteReport()" [disabled]="isDeleting()">
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
  `,
  styles: [`
    .my-reports-page {
      padding: 36px 20px 64px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
      h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
      p { color: #64748b; font-size: 0.9375rem; }
    }
    .filters-row {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .filter-pill {
      background: white;
      border: 1px solid var(--border);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover { background: #f1f5f9; }
      &.active {
        background: #0d9488;
        color: white;
        border-color: #0d9488;
      }
    }
    .cases-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }
    @media (max-width: 600px) {
      .cases-grid { grid-template-columns: 1fr; }
    }
    .case-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 18px;
    }
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      .case-id { font-size: 0.875rem; font-weight: 800; color: #0d9488; }
      .badges-group { display: flex; gap: 6px; }
    }
    .card-body {
      display: flex;
      gap: 14px;
      margin-bottom: 16px;
    }
    .case-thumb {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid var(--border);
    }
    .case-info {
      flex: 1;
      .case-title { font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-bottom: 6px; line-height: 1.3; }
      .case-category, .case-location, .case-team {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 2px;
        .material-icons-round { font-size: 14px; color: #94a3b8; }
      }
    }
    .card-audio-player {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      .audio-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #0d9488;
        .audio-icon { font-size: 16px; }
      }
      .case-audio-ctrl {
        width: 100%;
        height: 36px;
      }
    }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding-top: 12px;
      gap: 8px;
      .time-text { font-size: 0.75rem; color: #94a3b8; }
    }
    .card-footer-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-action-icon {
      background: none;
      border: 1px solid var(--border);
      color: #64748b;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      .material-icons-round { font-size: 18px; }
      &:hover {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #cbd5e1;
      }
      &.text-danger:hover {
        background: #fef2f2;
        color: #dc2626;
        border-color: #fecaca;
      }
    }
    .empty-state {
      grid-column: 1 / -1;
      padding: 64px 20px;
      text-align: center;
      background: white;
      border-radius: 16px;
      border: 1px solid var(--border);
      .empty-icon { font-size: 48px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
      p { font-size: 0.875rem; color: #64748b; margin-bottom: 16px; }
    }

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
    .alert-box {
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.8125rem;
      &.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class MyReportsComponent implements OnInit {
  cases = signal<CivicCase[]>([]);
  selectedStatus = signal<string>('ALL');

  // Quick Edit State
  selectedCaseForEdit = signal<CivicCase | null>(null);
  showEditModal = signal(false);
  isSavingEdit = signal(false);
  editError = signal<string | null>(null);
  editTitle = '';
  editCategory = 'Road damage and potholes';
  editDescription = '';
  editLocationAddress = '';

  // Quick Delete State
  selectedCaseForDelete = signal<CivicCase | null>(null);
  showDeleteModal = signal(false);
  isDeleting = signal(false);

  constructor(private api: ApiService) {}

  openQuickEdit(c: CivicCase) {
    this.selectedCaseForEdit.set(c);
    this.editTitle = c.title || '';
    this.editCategory = c.category || 'Road damage and potholes';
    this.editDescription = c.rawDescription || '';
    this.editLocationAddress = c.locationAddress || '';
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeQuickEdit() {
    this.showEditModal.set(false);
    this.selectedCaseForEdit.set(null);
  }

  saveQuickEdit() {
    const c = this.selectedCaseForEdit();
    if (!c) return;
    if (!this.editDescription.trim()) {
      this.editError.set('Description cannot be empty.');
      return;
    }
    this.isSavingEdit.set(true);
    this.editError.set(null);

    this.api.updateCase(c.id, {
      title: this.editTitle.trim() || undefined,
      category: this.editCategory,
      description: this.editDescription.trim(),
      locationAddress: this.editLocationAddress.trim() || undefined
    }).subscribe({
      next: (updated) => {
        this.isSavingEdit.set(false);
        this.showEditModal.set(false);
        this.cases.update(items => items.map(item => item.id === updated.id ? updated : item));
      },
      error: (err) => {
        this.isSavingEdit.set(false);
        this.editError.set(err.error?.message || 'Failed to update report.');
      }
    });
  }

  confirmQuickDelete(c: CivicCase) {
    this.selectedCaseForDelete.set(c);
    this.showDeleteModal.set(true);
  }

  closeQuickDelete() {
    this.showDeleteModal.set(false);
    this.selectedCaseForDelete.set(null);
  }

  deleteReport() {
    const c = this.selectedCaseForDelete();
    if (!c) return;
    this.isDeleting.set(true);
    this.api.deleteCase(c.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.showDeleteModal.set(false);
        this.cases.update(items => items.filter(item => item.id !== c.id));
      },
      error: (err) => {
        this.isDeleting.set(false);
        alert(err.error?.message || 'Failed to delete report.');
      }
    });
  }

  ngOnInit() {
    this.api.getCases().subscribe({
      next: (items) => this.cases.set(items),
      error: () => {}
    });
  }

  setStatusFilter(status: string) {
    this.selectedStatus.set(status);
  }

  filteredCases(): CivicCase[] {
    const status = this.selectedStatus();
    if (status === 'ALL') return this.cases();
    return this.cases().filter(c => c.status === status);
  }

  getStatusBadgeClass(status: string): string {
    const s = status.toLowerCase().replace(/ /g, '-');
    return `badge-status-${s}`;
  }
}
