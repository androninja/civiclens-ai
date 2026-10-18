import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { I18nService } from '../../services/i18n.service';
import { UserNotification } from '../../models/case.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="navbar-header">
      <div class="nav-container">
        <!-- Logo -->
        <a routerLink="/" class="nav-brand">
          <div class="brand-icon">
            <span class="material-icons-round">radar</span>
          </div>
          <div class="brand-text">
            <span class="brand-title">CivicLens <span class="ai-badge">AI</span></span>
            <span class="brand-sub">{{ i18n.t('brand_tagline') }}</span>
          </div>
        </a>

        <!-- Main Nav Links -->
        <nav class="nav-links">
          <a routerLink="/report" routerLinkActive="active" class="nav-item">
            <span class="material-icons-round">add_a_photo</span>
            <span>{{ i18n.t('nav_report') }}</span>
          </a>

          @if (auth.isCitizen()) {
            <a routerLink="/my-reports" routerLinkActive="active" class="nav-item">
              <span class="material-icons-round">assignment</span>
              <span>{{ i18n.t('nav_my_reports') }}</span>
            </a>
          }

          @if (auth.isReviewer()) {
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
              <span class="material-icons-round">dashboard</span>
              <span>{{ i18n.t('nav_reviewer') }}</span>
            </a>
          }

          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active" class="nav-item">
              <span class="material-icons-round">admin_panel_settings</span>
              <span>{{ i18n.t('nav_admin') }}</span>
            </a>
          }
        </nav>

        <!-- Right Side: Global Language Selector, Role Switcher & Notifications -->
        <div class="nav-actions">
          <!-- Global Language Selector -->
          <div class="lang-selector-nav">
            <span class="material-icons-round lang-icon">translate</span>
            <select [value]="i18n.currentLang()" (change)="onLanguageChange($event)" class="lang-nav-select" title="Choose Interface Language">
              @for (lang of i18n.getSupportedLanguages(); track lang.code) {
                <option [value]="lang.code">{{ lang.nativeName }} ({{ lang.name }})</option>
              }
            </select>
          </div>

          <!-- Notification Bell -->
          <div class="notification-wrapper">
            <button class="icon-btn" (click)="toggleNotifications()" title="Notifications">
              <span class="material-icons-round">notifications</span>
              @if (unreadCount() > 0) {
                <span class="notif-badge">{{ unreadCount() }}</span>
              }
            </button>

            @if (showNotifications()) {
              <div class="notif-dropdown">
                <div class="notif-header">
                  <strong>{{ i18n.t('nav_notifications') }}</strong>
                  <span class="badge">{{ notifications().length }}</span>
                </div>
                <div class="notif-list">
                  @for (n of notifications(); track n.id) {
                    <div class="notif-item">
                      <div class="notif-title">{{ n.title }}</div>
                      <div class="notif-msg">{{ n.message }}</div>
                      <div class="notif-time">{{ n.createdAt | date:'shortTime' }}</div>
                    </div>
                  } @empty {
                    <div class="notif-empty">{{ i18n.t('nav_no_notifications') }}</div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Quick Role Switcher for Hackathon Demo -->
          <div class="role-selector">
            <span class="role-label">{{ i18n.t('nav_active_role') }}</span>
            <select [value]="currentRole()" (change)="onRoleChange($event)" class="role-select">
              <option value="Citizen">Citizen (Ananya)</option>
              <option value="Reviewer">Reviewer (Vikram)</option>
              <option value="Administrator">Administrator</option>
            </select>
          </div>

          <!-- Authentication & Login Link -->
          <div class="auth-nav-action">
            <a routerLink="/login" class="login-nav-btn" title="Sign In or Switch Account">
              <span class="material-icons-round">account_circle</span>
              <span>Sign In / Portal</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .navbar-header {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
    }
    .nav-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 20px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-main);
    }
    .brand-icon {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #0d9488, #059669);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 0 2px 4px rgba(13, 148, 136, 0.2);
    }
    .brand-title {
      font-size: 1.125rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ai-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.6875rem;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
    }
    .brand-sub {
      display: block;
      font-size: 0.6875rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-muted);
      text-decoration: none;
      transition: all 0.15s ease;

      .material-icons-round {
        font-size: 18px;
      }

      &:hover {
        background: var(--surface-alt);
        color: var(--primary);
      }

      &.active {
        background: var(--primary-light);
        color: var(--primary);
      }
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .notification-wrapper {
      position: relative;
    }
    .icon-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      position: relative;
      transition: all 0.15s ease;

      &:hover {
        background: var(--surface-alt);
        color: var(--text-main);
      }
    }
    .notif-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 0.625rem;
      font-weight: 700;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .notif-dropdown {
      position: absolute;
      right: 0;
      top: 44px;
      width: 320px;
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 200;
    }
    .notif-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.875rem;
    }
    .notif-list {
      max-height: 280px;
      overflow-y: auto;
    }
    .notif-item {
      padding: 10px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.8125rem;

      &:hover {
        background: #f8fafc;
      }
    }
    .notif-title {
      font-weight: 600;
      color: var(--text-main);
    }
    .notif-msg {
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 2px;
    }
    .notif-time {
      color: var(--text-light);
      font-size: 0.6875rem;
      margin-top: 4px;
    }
    .notif-empty {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8125rem;
    }
    .lang-selector-nav {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      padding: 4px 10px;
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
      .lang-icon {
        font-size: 18px;
        color: #0d9488;
      }
    }
    .lang-nav-select {
      background: transparent;
      border: none;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #0f766e;
      cursor: pointer;
      outline: none;
    }
    .role-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
    }
    .role-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .role-select {
      background: transparent;
      border: none;
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--primary-hover);
      cursor: pointer;
      outline: none;
    }
    .login-nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #0d9488;
      color: #0d9488;
      background: #f0fdfa;
      border-radius: var(--radius-md);
      font-size: 0.8125rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
      &:hover {
        background: #0d9488;
        color: white;
      }
      .material-icons-round { font-size: 16px; }
    }
  `]
})
export class NavbarComponent implements OnInit {
  notifications = signal<UserNotification[]>([]);
  showNotifications = signal(false);
  unreadCount = signal(0);

  constructor(
    public auth: AuthService,
    private api: ApiService,
    public i18n: I18nService
  ) {}

  onLanguageChange(event: Event) {
    const code = (event.target as HTMLSelectElement).value;
    this.i18n.setLanguage(code);
  }

  ngOnInit() {
    this.refreshNotifications();
  }

  get currentRole(): () => string {
    return () => this.auth.currentUser()?.role || 'Citizen';
  }

  onRoleChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value as 'Citizen' | 'Reviewer' | 'Administrator';
    this.auth.loginWithDemoRole(val).subscribe(() => {
      this.refreshNotifications();
    });
  }

  toggleNotifications() {
    this.showNotifications.update(v => !v);
    if (this.showNotifications()) {
      this.refreshNotifications();
    }
  }

  refreshNotifications() {
    if (this.auth.currentUser()) {
      this.api.getNotifications().subscribe({
        next: (items) => {
          this.notifications.set(items);
          this.unreadCount.set(items.filter(n => !n.isRead).length);
        },
        error: () => {}
      });
    }
  }
}
