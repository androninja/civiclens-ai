import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CivicCase, DashboardMetrics, ServiceTeam } from '../../models/case.model';

@Component({
  selector: 'app-reviewer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dashboard-page container">
      <!-- Dashboard Header -->
      <div class="dash-header">
        <div>
          <div class="badge badge-status-assigned">Reviewer & Service Command Center</div>
          <h1>Municipal Case Review Queue</h1>
          <p>Triaging community signals, evaluating AI suggestions, routing service teams, and verifying closures.</p>
        </div>

        <div class="header-tools">
          <button class="btn btn-secondary btn-sm" (click)="refreshCases()">
            <span class="material-icons-round">refresh</span>
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      <!-- Quick Stats KPI Cards -->
      <div class="kpi-grid">
        <div class="civic-card kpi-card" (click)="setFilterStatus('')">
          <div class="kpi-num">{{ metrics()?.totalCases || cases().length }}</div>
          <div class="kpi-title">Total Active Cases</div>
        </div>
        <div class="civic-card kpi-card urgent" (click)="setFilterPriority('P1')">
          <div class="kpi-num">{{ metrics()?.p1Cases || countP1() }}</div>
          <div class="kpi-title">P1 Urgent Safety</div>
        </div>
        <div class="civic-card kpi-card warning" (click)="setFilterStatus('Needs Review')">
          <div class="kpi-num">{{ countNeedsReview() }}</div>
          <div class="kpi-title">Pending Review</div>
        </div>
        <div class="civic-card kpi-card info" (click)="setFilterStatus('In Progress')">
          <div class="kpi-num">{{ countInProgress() }}</div>
          <div class="kpi-title">In Field Repair</div>
        </div>
        <div class="civic-card kpi-card success" (click)="setFilterStatus('Resolved')">
          <div class="kpi-num">{{ countResolved() }}</div>
          <div class="kpi-title">Verified Resolved</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="civic-card filter-card">
        <div class="filter-controls-grid">
          <div class="filter-item search">
            <span class="material-icons-round search-icon">search</span>
            <input
              type="text"
              [(ngModel)]="searchTerm"
              (input)="applyFilters()"
              placeholder="Search by Case ID, description, or landmark..." />
          </div>

          <div class="filter-item">
            <select [(ngModel)]="filterCategory" (change)="applyFilters()">
              <option value="">All Categories</option>
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

          <div class="filter-item">
            <select [(ngModel)]="filterPriority" (change)="applyFilters()">
              <option value="">All Priorities</option>
              <option value="P1">P1 - Urgent Safety</option>
              <option value="P2">P2 - High Priority</option>
              <option value="P3">P3 - Normal Priority</option>
              <option value="P4">P4 - Low Priority</option>
            </select>
          </div>

          <div class="filter-item">
            <select [(ngModel)]="filterStatus" (change)="applyFilters()">
              <option value="">All Statuses</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolution Submitted">Resolution Submitted</option>
              <option value="Resolved">Resolved</option>
              <option value="Reopened">Reopened</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Cases Data Table -->
      <div class="civic-card table-card">
        <div class="table-responsive">
          <table class="cases-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Incident & Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned Service Team</th>
                <th>Flagged Duplicates</th>
                <th>Reported</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of cases(); track c.id) {
                <tr [class.highlight-urgent]="c.priority === 'P1'" [class.highlight-dup]="c.isDuplicate">
                  <td class="font-bold text-teal">
                    <a [routerLink]="['/reviewer/cases', c.id]" class="case-link">{{ c.id }}</a>
                    @if (c.isDemo) {
                      <span class="tiny-demo-badge">Demo</span>
                    }
                  </td>
                  <td>
                    <div class="cell-title">{{ c.title }}</div>
                    <div class="cell-sub">{{ c.category }} • {{ c.locationAddress || 'No Address' }}</div>
                  </td>
                  <td>
                    <span class="badge" [class.badge-p1]="c.priority === 'P1'"
                                        [class.badge-p2]="c.priority === 'P2'"
                                        [class.badge-p3]="c.priority === 'P3'"
                                        [class.badge-p4]="c.priority === 'P4'">
                      {{ c.priority }}
                    </span>
                    @if (c.isPriorityOverridden) {
                      <span class="override-tag" title="Overridden by reviewer">Overridden</span>
                    }
                  </td>
                  <td>
                    <span class="badge" [ngClass]="getStatusBadgeClass(c.status)">
                      {{ c.status }}
                    </span>
                    @if (c.hasCitizenReviewRequest) {
                      <span class="dispute-indicator" title="Citizen requested review">Review Requested</span>
                    }
                  </td>
                  <td>
                    @if (c.assignedTeamName) {
                      <div class="team-label">
                        <span class="material-icons-round">engineering</span>
                        <span>{{ c.assignedTeamName }}</span>
                      </div>
                      <div class="sla-micro">Target: {{ c.targetResponseHours }}h</div>
                    } @else {
                      <span class="unassigned-text">Unassigned</span>
                    }
                  </td>
                  <td>
                    @if (c.isDuplicate) {
                      <span class="dup-badge" title="{{ c.duplicateExplanation }}">
                        <span class="material-icons-round">content_copy</span>
                        <span>Dup of {{ c.primaryCaseId }}</span>
                      </span>
                    } @else {
                      <span class="text-light-sub">—</span>
                    }
                  </td>
                  <td class="date-cell">
                    {{ c.createdAt | date:'shortDate' }}
                  </td>
                  <td class="text-right">
                    <div class="table-actions">
                      @if (c.status === 'Resolution Submitted') {
                        <a [routerLink]="['/reviewer/resolution', c.id]" class="btn btn-success btn-xs">
                          <span class="material-icons-round">fact_check</span>
                          <span>Verify</span>
                        </a>
                      }
                      <a [routerLink]="['/reviewer/cases', c.id]" class="btn btn-secondary btn-xs">
                        <span>Review & Assign</span>
                      </a>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="text-center py-6 text-muted">
                    No cases match the active filter criteria.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 32px 20px 64px;
      max-width: 1280px;
      margin: 0 auto;
    }
    .dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
      h1 { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin: 6px 0 2px; }
      p { font-size: 0.9375rem; color: #64748b; }
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      padding: 18px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      &:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
      .kpi-num { font-size: 2rem; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 4px; }
      .kpi-title { font-size: 0.8125rem; font-weight: 600; color: #64748b; }

      &.urgent .kpi-num { color: #dc2626; }
      &.warning .kpi-num { color: #d97706; }
      &.info .kpi-num { color: #0284c7; }
      &.success .kpi-num { color: #059669; }
    }
    .filter-card {
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .filter-controls-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 12px;
      align-items: center;
    }
    @media (max-width: 900px) {
      .filter-controls-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 600px) {
      .filter-controls-grid { grid-template-columns: 1fr; }
    }
    .filter-item {
      position: relative;
      select, input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 0.8125rem;
        background: white;
        &:focus { outline: none; border-color: #0d9488; }
      }
      &.search {
        input { padding-left: 34px; }
        .search-icon {
          position: absolute;
          left: 10px;
          top: 9px;
          font-size: 18px;
          color: #94a3b8;
        }
      }
    }
    .table-card {
      padding: 0;
      overflow: hidden;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .cases-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.8125rem;

      th {
        background: #f8fafc;
        padding: 12px 16px;
        font-weight: 700;
        color: #475569;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      td {
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
      tr:hover {
        background: #f8fafc;
      }
      tr.highlight-urgent {
        background: #fff5f5;
      }
      tr.highlight-dup {
        background: #fffdf5;
      }
    }
    .case-link {
      font-weight: 800;
      color: #0d9488;
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .tiny-demo-badge {
      display: inline-block;
      font-size: 0.625rem;
      background: #e2e8f0;
      color: #475569;
      padding: 1px 4px;
      border-radius: 3px;
      margin-left: 4px;
    }
    .cell-title {
      font-weight: 700;
      color: #0f172a;
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cell-sub {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 2px;
    }
    .override-tag {
      display: inline-block;
      font-size: 0.625rem;
      color: #9333ea;
      font-weight: 700;
      background: #f3e8ff;
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 3px;
    }
    .dispute-indicator {
      display: inline-block;
      font-size: 0.625rem;
      color: #be123c;
      font-weight: 700;
      background: #ffe4e6;
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 3px;
    }
    .team-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      color: #1e40af;
      .material-icons-round { font-size: 14px; }
    }
    .sla-micro {
      font-size: 0.6875rem;
      color: #64748b;
    }
    .unassigned-text {
      color: #94a3b8;
      font-style: italic;
    }
    .dup-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 600;
      .material-icons-round { font-size: 12px; }
    }
    .table-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    .btn-xs {
      padding: 4px 8px;
      font-size: 0.75rem;
      border-radius: 6px;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .py-6 { padding-top: 24px; padding-bottom: 24px; }
    .text-muted { color: #94a3b8; }
  `]
})
export class ReviewerDashboardComponent implements OnInit {
  cases = signal<CivicCase[]>([]);
  metrics = signal<DashboardMetrics | null>(null);

  searchTerm = '';
  filterCategory = '';
  filterPriority = '';
  filterStatus = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.refreshCases();
    this.api.getMetrics().subscribe({
      next: (m) => this.metrics.set(m),
      error: () => {}
    });
  }

  refreshCases() {
    this.applyFilters();
  }

  applyFilters() {
    this.api.getCases({
      category: this.filterCategory || undefined,
      priority: this.filterPriority || undefined,
      status: this.filterStatus || undefined,
      search: this.searchTerm || undefined
    }).subscribe({
      next: (items) => this.cases.set(items),
      error: () => {}
    });
  }

  setFilterStatus(status: string) {
    this.filterStatus = status;
    this.applyFilters();
  }

  setFilterPriority(p: string) {
    this.filterPriority = p;
    this.applyFilters();
  }

  countP1(): number {
    return this.cases().filter(c => c.priority === 'P1').length;
  }

  countNeedsReview(): number {
    return this.cases().filter(c => c.status === 'Needs Review' || c.status === 'Submitted').length;
  }

  countInProgress(): number {
    return this.cases().filter(c => c.status === 'Assigned' || c.status === 'In Progress').length;
  }

  countResolved(): number {
    return this.cases().filter(c => c.status === 'Resolved').length;
  }

  getStatusBadgeClass(status: string): string {
    const s = status.toLowerCase().replace(/ /g, '-');
    return `badge-status-${s}`;
  }
}
