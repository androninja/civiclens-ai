import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { ReportComponent } from './pages/report/report.component';
import { ReportConfirmationComponent } from './pages/report-confirmation/report-confirmation.component';
import { MyReportsComponent } from './pages/my-reports/my-reports.component';
import { CaseDetailComponent } from './pages/case-detail/case-detail.component';
import { ReviewerDashboardComponent } from './pages/reviewer-dashboard/reviewer-dashboard.component';
import { ReviewerCaseDetailComponent } from './pages/reviewer-case-detail/reviewer-case-detail.component';
import { ResolutionVerifyComponent } from './pages/resolution-verify/resolution-verify.component';
import { AdminComponent } from './pages/admin/admin.component';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'report', component: ReportComponent },
  { path: 'confirmation/:id', component: ReportConfirmationComponent },
  { path: 'my-reports', component: MyReportsComponent },
  { path: 'cases/:id', component: CaseDetailComponent },
  { path: 'dashboard', component: ReviewerDashboardComponent },
  { path: 'reviewer/cases/:id', component: ReviewerCaseDetailComponent },
  { path: 'reviewer/resolution/:id', component: ResolutionVerifyComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' }
];
