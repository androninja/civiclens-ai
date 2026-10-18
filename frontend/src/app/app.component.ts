import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    <div class="app-layout">
      <app-navbar></app-navbar>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
      <footer class="app-footer">
        <div class="container footer-content">
          <div class="footer-left">
            <span class="footer-brand">CivicLens AI</span>
            <span class="footer-copy">— {{ i18n.t('brand_tagline') }}</span>
          </div>
          <div class="footer-right">
            <span>{{ i18n.t('footer_powered') }}</span>
            <span class="dot-sep">•</span>
            <span>{{ i18n.t('footer_tagline') }}</span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-main {
      flex: 1;
    }
    .app-footer {
      background: white;
      border-top: 1px solid var(--border);
      padding: 20px 0;
      font-size: 0.75rem;
      color: #64748b;
    }
    .footer-content {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .footer-brand {
      font-weight: 700;
      color: #0f172a;
    }
    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot-sep {
      color: #cbd5e1;
    }
  `]
})
export class AppComponent {
  constructor(public i18n: I18nService) {}
}
