import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { DashboardMetrics } from '../../models/case.model';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="landing-page">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="container hero-content">
          <h1 class="hero-title">
            {{ i18n.t('hero_title_1') }}<br />
            <span class="gradient-text">{{ i18n.t('hero_title_2') }}</span>
          </h1>
          <p class="hero-subtitle">
            {{ i18n.t('hero_subtitle') }}
          </p>

          <div class="hero-cta-group">
            <a routerLink="/report" class="btn btn-primary btn-lg">
              <span class="material-icons-round">camera_alt</span>
              <span>{{ i18n.t('hero_btn_report') }}</span>
            </a>
            @if (auth.isReviewer()) {
              <a routerLink="/dashboard" class="btn btn-secondary btn-lg">
                <span class="material-icons-round">analytics</span>
                <span>{{ i18n.t('hero_btn_reviewer') }}</span>
              </a>
            } @else {
              <a routerLink="/my-reports" class="btn btn-secondary btn-lg">
                <span class="material-icons-round">assignment</span>
                <span>{{ i18n.t('hero_btn_my_reports') }}</span>
              </a>
            }
          </div>

          <!-- Feature Highlights Bar -->
          <div class="highlights-grid">
            <div class="highlight-item">
              <div class="icon-wrap green"><span class="material-icons-round">camera</span></div>
              <div class="highlight-text">
                <strong>{{ i18n.t('highlight_camera') }}</strong>
                <span>{{ i18n.t('highlight_camera_sub') }}</span>
              </div>
            </div>
            <div class="highlight-item">
              <div class="icon-wrap teal"><span class="material-icons-round">record_voice_over</span></div>
              <div class="highlight-text">
                <strong>{{ i18n.t('highlight_voice') }}</strong>
                <span>{{ i18n.t('highlight_voice_sub') }}</span>
              </div>
            </div>
            <div class="highlight-item">
              <div class="icon-wrap amber"><span class="material-icons-round">verified</span></div>
              <div class="highlight-text">
                <strong>{{ i18n.t('highlight_verify') }}</strong>
                <span>{{ i18n.t('highlight_verify_sub') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Supported Regional Languages Showcase -->
      <section class="languages-section">
        <div class="container">
          <div class="section-header">
            <span class="section-pill-tag">{{ i18n.t('languages_badge') }}</span>
            <h2>{{ i18n.t('languages_title') }}</h2>
            <p>{{ i18n.t('languages_sub') }}</p>
          </div>

          <div class="languages-showcase-grid">
            @for (lang of i18n.getSupportedLanguages(); track lang.code) {
              <div
                class="lang-card"
                [class.active]="i18n.currentLang() === lang.code"
                (click)="i18n.setLanguage(lang.code)">
                <div class="lang-top">
                  <span class="lang-native-txt">{{ lang.nativeName }}</span>
                  @if (i18n.currentLang() === lang.code) {
                    <span class="active-badge">Selected</span>
                  }
                </div>
                <div class="lang-eng-txt">{{ lang.name }}</div>
                <div class="lang-features">
                  <span class="material-icons-round mic-tag-icon">mic</span>
                  <span>Voice & UI Supported</span>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Live Civic Metrics Counter -->
      <section class="metrics-section">
        <div class="container">
          <div class="section-header">
            <h2>{{ i18n.t('metrics_title') }}</h2>
            <p>{{ i18n.t('metrics_sub') }}</p>
          </div>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-num">{{ metrics()?.totalCases ?? 0 }}</div>
              <div class="metric-label">{{ i18n.t('metrics_total') }}</div>
            </div>
            <div class="metric-card urgent">
              <div class="metric-num">{{ metrics()?.p1Cases ?? 0 }}</div>
              <div class="metric-label">{{ i18n.t('metrics_urgent') }}</div>
            </div>
            <div class="metric-card active">
              <div class="metric-num">{{ metrics()?.inProgress ?? 0 }}</div>
              <div class="metric-label">{{ i18n.t('metrics_active') }}</div>
            </div>
            <div class="metric-card success">
              <div class="metric-num">{{ metrics()?.resolved ?? 0 }}</div>
              <div class="metric-label">{{ i18n.t('metrics_resolved') }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works Section -->
      <section class="how-it-works-section">
        <div class="container">
          <div class="section-header">
            <h2>{{ i18n.t('how_title') }}</h2>
            <p>{{ i18n.t('how_sub') }}</p>
          </div>

          <div class="steps-flow">
            <div class="step-card">
              <div class="step-number">1</div>
              <div class="step-icon"><span class="material-icons-round">photo_camera</span></div>
              <h3>{{ i18n.t('step1_title') }}</h3>
              <p>{{ i18n.t('step1_desc') }}</p>
            </div>
            <div class="step-card">
              <div class="step-number">2</div>
              <div class="step-icon"><span class="material-icons-round">smart_toy</span></div>
              <h3>{{ i18n.t('step2_title') }}</h3>
              <p>{{ i18n.t('step2_desc') }}</p>
            </div>
            <div class="step-card">
              <div class="step-number">3</div>
              <div class="step-icon"><span class="material-icons-round">merge_type</span></div>
              <h3>{{ i18n.t('step3_title') }}</h3>
              <p>{{ i18n.t('step3_desc') }}</p>
            </div>
            <div class="step-card">
              <div class="step-number">4</div>
              <div class="step-icon"><span class="material-icons-round">send_to_mobile</span></div>
              <h3>{{ i18n.t('step4_title') }}</h3>
              <p>{{ i18n.t('step4_desc') }}</p>
            </div>
            <div class="step-card">
              <div class="step-number">5</div>
              <div class="step-icon"><span class="material-icons-round">fact_check</span></div>
              <h3>{{ i18n.t('step5_title') }}</h3>
              <p>{{ i18n.t('step5_desc') }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    .hero-section {
      padding: 64px 0 48px;
      background: linear-gradient(180deg, #f0fdfa 0%, #f8fafc 100%);
      text-align: center;
    }
    .hero-content {
      max-width: 860px;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ccfbf1;
      color: #0f766e;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 700;
      margin-bottom: 24px;
      border: 1px solid #99f6e4;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #0d9488;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.7);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(13, 148, 136, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(13, 148, 136, 0); }
    }
    .hero-title {
      font-size: 3rem;
      font-weight: 800;
      line-height: 1.15;
      color: #0f172a;
      letter-spacing: -0.03em;
      margin-bottom: 20px;
    }
    .gradient-text {
      background: linear-gradient(135deg, #0d9488 0%, #059669 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: 1.125rem;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 36px;
    }
    .hero-cta-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 48px;
      flex-wrap: wrap;
    }
    .btn-lg {
      padding: 12px 24px;
      font-size: 1rem;
      border-radius: 12px;
    }
    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      text-align: left;
      margin-top: 24px;
    }
    .highlight-item {
      background: white;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      box-shadow: var(--shadow-sm);
    }
    .icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.green { background: #dcfce7; color: #15803d; }
      &.teal { background: #ccfbf1; color: #0f766e; }
      &.blue { background: #dbeafe; color: #1d4ed8; }
      &.amber { background: #fef3c7; color: #b45309; }
    }
    .highlight-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong { font-size: 0.875rem; color: #0f172a; }
      span { font-size: 0.75rem; color: #64748b; line-height: 1.4; }
    }
    .metrics-section {
      padding: 48px 0;
    }
    .section-header {
      text-align: center;
      margin-bottom: 36px;
      h2 { font-size: 1.75rem; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
      p { font-size: 0.9375rem; color: #64748b; }
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .metric-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px 20px;
      text-align: center;
      box-shadow: var(--shadow-sm);

      .metric-num { font-size: 2.25rem; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 8px; }
      .metric-label { font-size: 0.8125rem; font-weight: 600; color: #64748b; }

      &.urgent .metric-num { color: #dc2626; }
      &.active .metric-num { color: #0284c7; }
      &.success .metric-num { color: #059669; }
    }
    .languages-section {
      padding: 56px 0;
      background: #ffffff;
      border-top: 1px solid var(--border);
      text-align: center;
    }
    .section-pill-tag {
      display: inline-block;
      background: #ccfbf1;
      color: #0f766e;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 800;
      margin-bottom: 12px;
      letter-spacing: 0.04em;
    }
    .languages-showcase-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 16px;
      margin-top: 28px;
    }
    .lang-card {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      position: relative;
      &:hover {
        border-color: #0d9488;
        background: #f0fdfa;
        transform: translateY(-2px);
        box-shadow: 0 4px 14px rgba(13, 148, 136, 0.15);
      }
      &.active {
        border-color: #0d9488;
        background: #f0fdfa;
        box-shadow: 0 0 0 2px #0d9488;
      }
      .lang-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .lang-native-txt {
        font-size: 1.25rem;
        font-weight: 800;
        color: #0f172a;
      }
      .active-badge {
        background: #0d9488;
        color: #ffffff;
        font-size: 0.625rem;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .lang-eng-txt {
        font-size: 0.8125rem;
        color: #64748b;
        font-weight: 600;
        margin-bottom: 10px;
      }
      .lang-features {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.6875rem;
        color: #0d9488;
        font-weight: 600;
        .mic-tag-icon { font-size: 15px; }
      }
    }
    .how-it-works-section {
      padding: 48px 0 64px;
      background: #f8fafc;
      border-top: 1px solid var(--border);
    }
    .steps-flow {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .step-card {
      position: relative;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px 18px;
      text-align: center;

      .step-number {
        position: absolute;
        top: -12px;
        left: 20px;
        background: #0d9488;
        color: white;
        font-size: 0.75rem;
        font-weight: 800;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .step-icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 14px;
        background: #e0f2fe;
        color: #0369a1;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      h3 { font-size: 1rem; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
      p { font-size: 0.8125rem; color: #64748b; line-height: 1.5; }
    }
  `]
})
export class LandingComponent implements OnInit {
  metrics = signal<DashboardMetrics | null>(null);

  constructor(
    private api: ApiService,
    public auth: AuthService,
    public i18n: I18nService
  ) {}

  ngOnInit() {
    this.api.getMetrics().subscribe({
      next: (m) => this.metrics.set(m),
      error: () => {}
    });
  }
}
