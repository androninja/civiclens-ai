import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-page container">
      <div class="login-container civic-card">
        <!-- Header -->
        <div class="login-header">
          <div class="brand-badge">
            <span class="material-icons-round">security</span>
          </div>
          <h1>CivicLens Authentication Portal</h1>
          <p>Secure access for citizens, municipal reviewers, and administrative leadership</p>
        </div>

        <!-- Current User Banner if signed in -->
        @if (auth.currentUser() && auth.currentUser().userId) {
          <div class="current-user-banner">
            <div class="user-meta">
              <span class="material-icons-round user-icon">account_circle</span>
              <div>
                <strong>{{ auth.currentUser().fullName }}</strong>
                <span class="role-pill">{{ auth.currentUser().role }}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" (click)="logout()">Sign Out</button>
          </div>
        }

        <!-- Tab Controls -->
        <div class="auth-tabs">
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'citizen_login'"
            (click)="setTab('citizen_login')">
            <span class="material-icons-round">person</span>
            <span>Citizen Login</span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'citizen_register'"
            (click)="setTab('citizen_register')">
            <span class="material-icons-round">person_add</span>
            <span>Citizen Register</span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'staff_login'"
            (click)="setTab('staff_login')">
            <span class="material-icons-round">shield</span>
            <span>Reviewer / Admin Login</span>
          </button>
        </div>

        <!-- Global Alert Banners -->
        @if (errorMessage()) {
          <div class="alert-box danger">
            <span class="material-icons-round">error</span>
            <span>{{ errorMessage() }}</span>
          </div>
        }
        @if (successMessage()) {
          <div class="alert-box success">
            <span class="material-icons-round">check_circle</span>
            <span>{{ successMessage() }}</span>
          </div>
        }

        <!-- TAB 1: Citizen Login -->
        @if (activeTab() === 'citizen_login') {
          <form class="auth-form" (submit)="onCitizenLogin($event)">
            <div class="form-group">
              <label>Citizen Username or Email:</label>
              <input
                type="text"
                id="citizenUsername"
                [(ngModel)]="loginUsername"
                name="citizenUsername"
                placeholder="citizen@civiclens.local or username"
                required />
            </div>

            <div class="form-group">
              <label>Password:</label>
              <input
                type="password"
                id="citizenPassword"
                [(ngModel)]="loginPassword"
                name="citizenPassword"
                placeholder="••••••••"
                required />
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="loading()">
              @if (loading()) {
                <span class="material-icons-round spin">sync</span>
                <span>Authenticating...</span>
              } @else {
                <span class="material-icons-round">login</span>
                <span>Sign In as Citizen</span>
              }
            </button>

            <!-- Quick Demo Helper -->
            <div class="demo-helpers">
              <span>Quick Demo Fill:</span>
              <button type="button" class="btn-demo-fill" (click)="fillCitizenDemo()">
                Ananya Sharma (Citizen)
              </button>
            </div>

            <div class="form-switch-prompt">
              <span>Don't have an account yet?</span>
              <button type="button" class="btn-link" (click)="setTab('citizen_register')">
                Register as a New Citizen
              </button>
            </div>
          </form>
        }

        <!-- TAB 2: Citizen Register -->
        @if (activeTab() === 'citizen_register') {
          <form class="auth-form" (submit)="onCitizenRegister($event)">
            <div class="form-group">
              <label>Full Legal Name:</label>
              <input
                type="text"
                id="regFullName"
                [(ngModel)]="regFullName"
                name="regFullName"
                placeholder="e.g. Priya Sundaram"
                required />
            </div>

            <div class="form-group">
              <label>Email Address:</label>
              <input
                type="email"
                id="regEmail"
                [(ngModel)]="regEmail"
                name="regEmail"
                placeholder="priya@example.com"
                required />
            </div>

            <div class="form-group">
              <label>Choose Username:</label>
              <input
                type="text"
                id="regUsername"
                [(ngModel)]="regUsername"
                name="regUsername"
                placeholder="priyas"
                required />
            </div>

            <div class="form-group">
              <label>Password:</label>
              <input
                type="password"
                id="regPassword"
                [(ngModel)]="regPassword"
                name="regPassword"
                placeholder="At least 6 characters"
                required />
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="loading()">
              @if (loading()) {
                <span class="material-icons-round spin">sync</span>
                <span>Registering Account...</span>
              } @else {
                <span class="material-icons-round">how_to_reg</span>
                <span>Register Citizen Account</span>
              }
            </button>

            <div class="form-switch-prompt">
              <span>Already registered?</span>
              <button type="button" class="btn-link" (click)="setTab('citizen_login')">
                Sign In with your credentials
              </button>
            </div>
          </form>
        }

        <!-- TAB 3: Reviewer & Admin Login -->
        @if (activeTab() === 'staff_login') {
          <form class="auth-form" (submit)="onStaffLogin($event)">
            <div class="staff-role-toggle">
              <button
                type="button"
                class="role-badge-btn"
                [class.selected]="selectedStaffRole === 'Reviewer'"
                (click)="setStaffRole('Reviewer')">
                <span class="material-icons-round">rate_review</span>
                <span>Municipal Reviewer</span>
              </button>
              <button
                type="button"
                class="role-badge-btn"
                [class.selected]="selectedStaffRole === 'Administrator'"
                (click)="setStaffRole('Administrator')">
                <span class="material-icons-round">admin_panel_settings</span>
                <span>Civic Administrator</span>
              </button>
            </div>

            <div class="form-group">
              <label>Staff Username or Email:</label>
              <input
                type="text"
                id="staffUsername"
                [(ngModel)]="staffUsername"
                name="staffUsername"
                placeholder="staff@civiclens.local or username"
                required />
            </div>

            <div class="form-group">
              <label>Password:</label>
              <input
                type="password"
                id="staffPassword"
                [(ngModel)]="staffPassword"
                name="staffPassword"
                placeholder="••••••••"
                required />
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="loading()">
              @if (loading()) {
                <span class="material-icons-round spin">sync</span>
                <span>Authenticating Staff...</span>
              } @else {
                <span class="material-icons-round">vpn_key</span>
                <span>Sign In as {{ selectedStaffRole }}</span>
              }
            </button>

            <!-- Quick Staff Demo Helpers -->
            <div class="demo-helpers">
              <span>Demo Presets:</span>
              <button type="button" class="btn-demo-fill" (click)="fillReviewerDemo()">
                Vikram Patel (Reviewer)
              </button>
              <button type="button" class="btn-demo-fill" (click)="fillAdminDemo()">
                Operations Admin
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      padding: 40px 16px 80px;
      display: flex;
      justify-content: center;
    }
    .login-container {
      max-width: 540px;
      width: 100%;
      padding: 32px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      background: white;
    }
    .login-header {
      text-align: center;
      margin-bottom: 24px;
      .brand-badge {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #0d9488, #059669);
        color: white;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
        box-shadow: 0 4px 10px rgba(13, 148, 136, 0.25);
        .material-icons-round { font-size: 26px; }
      }
      h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
      p { font-size: 0.875rem; color: #64748b; margin: 0; line-height: 1.4; }
    }
    .current-user-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      .user-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.875rem;
        color: #166534;
        .user-icon { font-size: 24px; color: #16a34a; }
      }
      .role-pill {
        display: inline-block;
        margin-left: 6px;
        background: #dcfce7;
        color: #15803d;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
      }
    }
    .auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr 1.2fr;
      gap: 6px;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 10px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;
      .material-icons-round { font-size: 16px; }
      &.active {
        background: white;
        color: #0d9488;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #334155;
      }
      input {
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.9375rem;
        outline: none;
        transition: border-color 0.15s;
        &:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
        }
      }
    }
    .staff-role-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 6px;
    }
    .role-badge-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      border: 1px solid #cbd5e1;
      background: white;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      &.selected {
        border-color: #0d9488;
        background: #f0fdfa;
        color: #0d9488;
      }
    }
    .demo-helpers {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 4px;
      padding-top: 12px;
      border-top: 1px dashed #e2e8f0;
    }
    .btn-demo-fill {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #0f172a;
      cursor: pointer;
      &:hover { background: #e2e8f0; }
    }
    .form-switch-prompt {
      text-align: center;
      font-size: 0.8125rem;
      color: #64748b;
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-link {
      background: none;
      border: none;
      color: #0d9488;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
      &:hover { text-decoration: underline; }
    }
    .alert-box {
      padding: 10px 14px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      margin-bottom: 16px;
      &.danger {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
      }
      &.success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
      }
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class LoginComponent implements OnInit {
  activeTab = signal<'citizen_login' | 'citizen_register' | 'staff_login'>('citizen_login');
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Citizen Login Form
  loginUsername = 'citizen@civiclens.local';
  loginPassword = 'Citizen123!';

  // Citizen Register Form
  regFullName = '';
  regEmail = '';
  regUsername = '';
  regPassword = '';

  // Staff Login Form
  selectedStaffRole: 'Reviewer' | 'Administrator' = 'Reviewer';
  staffUsername = 'reviewer@civiclens.local';
  staffPassword = 'Reviewer123!';

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit() {
    // If not logged in or default, keep form ready
  }

  setTab(tab: 'citizen_login' | 'citizen_register' | 'staff_login') {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  setStaffRole(role: 'Reviewer' | 'Administrator') {
    this.selectedStaffRole = role;
    if (role === 'Reviewer') {
      this.staffUsername = 'reviewer@civiclens.local';
      this.staffPassword = 'Reviewer123!';
    } else {
      this.staffUsername = 'admin@civiclens.local';
      this.staffPassword = 'Admin123!';
    }
  }

  fillCitizenDemo() {
    this.loginUsername = 'citizen@civiclens.local';
    this.loginPassword = 'Citizen123!';
  }

  fillReviewerDemo() {
    this.selectedStaffRole = 'Reviewer';
    this.staffUsername = 'reviewer@civiclens.local';
    this.staffPassword = 'Reviewer123!';
  }

  fillAdminDemo() {
    this.selectedStaffRole = 'Administrator';
    this.staffUsername = 'admin@civiclens.local';
    this.staffPassword = 'Admin123!';
  }

  onCitizenLogin(e: Event) {
    e.preventDefault();
    this.errorMessage.set(null);
    this.loading.set(true);

    this.auth.login(this.loginUsername, this.loginPassword).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.successMessage.set(`Welcome back, ${user.fullName}!`);
        setTimeout(() => this.router.navigate(['/my-reports']), 500);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 429) {
          this.errorMessage.set('Too many requests. Please slow down and try again later.');
        } else {
          this.errorMessage.set(err.error?.message || 'Invalid username or password.');
        }
      }
    });
  }

  onCitizenRegister(e: Event) {
    e.preventDefault();
    this.errorMessage.set(null);
    if (!this.regFullName.trim() || !this.regEmail.trim() || !this.regUsername.trim() || !this.regPassword.trim()) {
      this.errorMessage.set('All registration fields are required.');
      return;
    }
    this.loading.set(true);

    this.auth.register(this.regFullName, this.regEmail, this.regUsername, this.regPassword, 'Citizen').subscribe({
      next: (user) => {
        this.loading.set(false);
        this.successMessage.set(`Account created successfully! Welcome, ${user.fullName}.`);
        setTimeout(() => this.router.navigate(['/my-reports']), 800);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 429) {
          this.errorMessage.set('Too many requests. Please slow down and try again later.');
        } else {
          this.errorMessage.set(err.error?.message || 'Registration failed. Please check information and retry.');
        }
      }
    });
  }

  onStaffLogin(e: Event) {
    e.preventDefault();
    this.errorMessage.set(null);
    this.loading.set(true);

    this.auth.login(this.staffUsername, this.staffPassword).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.successMessage.set(`Authenticated as ${user.role} (${user.fullName}).`);
        const target = user.role === 'Administrator' ? '/admin' : '/dashboard';
        setTimeout(() => this.router.navigate([target]), 500);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 429) {
          this.errorMessage.set('Too many requests. Please slow down and try again later.');
        } else {
          this.errorMessage.set(err.error?.message || 'Invalid staff credentials.');
        }
      }
    });
  }

  logout() {
    this.auth.logout();
    this.successMessage.set('You have signed out.');
  }
}
