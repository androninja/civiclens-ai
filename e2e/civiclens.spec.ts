import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('CivicLens AI — End-to-End Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Automatically accept any dialogs if triggered
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
  });

  test('E2E 1 — Photo reporting: Upload image, description, location, submit and verify case ID', async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText('Report a Civic Infrastructure Issue');

    // 1. Upload test photo
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload File")');
    const fileChooser = await fileChooserPromise;
    const fixturePath = path.resolve(__dirname, 'fixtures/test_pothole.png');
    await fileChooser.setFiles(fixturePath);

    // Verify preview is displayed
    await expect(page.locator('.photo-preview-img')).toBeVisible();

    // 2. Enter description & location & pin map
    await page.fill('#descInput', 'Deep crater pothole on outer circle road near metro station.');
    await page.click('.simulated-map');
    await page.fill('#addressInput', 'Connaught Place Gate 2, New Delhi');

    // 3. Submit report
    await page.click('button:has-text("Submit Civic Report")');

    // 4. Verify landing on confirmation page with unique CASE-2026- ID
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.case-id')).toContainText('CASE-2026-');
    await expect(page.locator('h1')).toContainText('Report Successfully Registered');
    await expect(page.locator('.ai-summary-box')).toBeVisible();
  });

  test('E2E 2 — Webcam reporting: Open camera, capture snapshot, and confirm attached', async ({ page }) => {
    await page.goto('/report');

    // 1. Click Use Device Camera
    await page.click('button:has-text("Use Device Camera")');
    await expect(page.locator('.video-preview')).toBeVisible();

    // 2. Capture Photo
    await page.click('button:has-text("Capture Photo")');

    // 3. Verify snapshot is captured and displayed in preview
    await expect(page.locator('.photo-preview-img')).toBeVisible();
    await expect(page.locator('.filename')).toContainText('camera_capture_');

    // 4. Enter description and submit
    await page.fill('#descInput', 'Broken pavement block after rain captured via camera.');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');

    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.case-id')).toContainText('CASE-2026-');
  });

  test('E2E 3 — Multilingual voice reporting: Select Hindi, transcribe voice, edit transcript, submit', async ({ page }) => {
    await page.goto('/report');

    // 1. Select Hindi
    await page.selectOption('.lang-selector select', 'hi');

    // 2. Upload audio fixture
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload Audio File")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, 'fixtures/test_audio.webm'));

    // Verify audio player & editable transcript appear
    await expect(page.locator('.audio-player')).toBeVisible();
    await expect(page.locator('.transcript-textarea')).toBeVisible();

    // 3. Verify and edit transcript
    await page.fill('.transcript-textarea', 'सड़क पर गहरा गड्ढा है और पानी का रिसाव हो रहा है। (नागरिक द्वारा संशोधित विवरण)');
    await page.click('.simulated-map');

    // 4. Submit report
    await page.click('button:has-text("Submit Civic Report")');

    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.case-id')).toContainText('CASE-2026-');
  });

  test('E2E 4 — AI understanding: Category and priority suggestions and structured rationale', async ({ page }) => {
    await page.goto('/report');

    await page.fill('#descInput', 'Major drinking water pipe leak flooding pedestrian walkway.');
    await page.selectOption('#categorySelect', 'Water leakage and drainage');
    await page.click('.simulated-map');

    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });

    // Verify AI analysis output
    await expect(page.locator('.ai-summary-box')).toBeVisible();
    await expect(page.locator('.ai-field:has-text("Assigned Category:")')).toBeVisible();
    await expect(page.locator('.ai-field:has-text("Priority Rationale:")')).toBeVisible();
  });

  test('E2E 5 — Duplicate detection: Review duplicate suggestions and preserve both records', async ({ page }) => {
    // 1. Submit initial incident
    await page.goto('/report');
    await page.fill('#descInput', 'Deep crater pothole on outer circle road near metro station.');
    await page.selectOption('#categorySelect', 'Road damage and potholes');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    const firstCaseId = (await page.locator('.case-id').innerText()).trim();

    // 2. Submit second matching incident (potential duplicate at same location)
    await page.goto('/report');
    await page.fill('#descInput', 'Deep crater pothole on outer circle road near metro station causing hazard.');
    await page.selectOption('#categorySelect', 'Road damage and potholes');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    const secondCaseId = (await page.locator('.case-id').innerText()).trim();

    // 3. Switch role to Reviewer and check Dashboard
    await page.goto('/dashboard');
    await page.selectOption('.role-select', 'Reviewer');
    await expect(page.locator('h1')).toContainText('Municipal Case Review Queue');

    // 4. Open newly created duplicate case in reviewer queue
    await page.goto(`/reviewer/cases/${secondCaseId}`);
    await expect(page.locator('.duplicate-review-card')).toBeVisible();
    await expect(page.locator('.dup-explanation')).toBeVisible();

    // 5. Mark as distinct incident or confirm duplicate
    await page.click('button:has-text("Mark as Distinct Incident")');
    await expect(page.locator('.alert-banner')).toContainText('Report marked as distinct incident.');

    // 6. Verify primary case remains accessible
    await page.goto(`/cases/${firstCaseId}`);
    await expect(page.locator('.case-id')).toContainText(firstCaseId);
    await expect(page.locator('h1')).toContainText('Deep crater pothole');
  });

  test('E2E 6 — Prioritization and routing: Safety concern triggers P1 and team assignment', async ({ page }) => {
    // 1. Citizen submits urgent safety issue
    await page.goto('/report');
    await page.fill('#descInput', 'Exposed live electric wire fell across waterlogged footpath sparking dangerously.');
    await page.selectOption('#categorySelect', 'Public safety and accessibility');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });

    // Verify P1 badge
    await expect(page.locator('.badge:has-text("P1 Recommended")')).toBeVisible();

    // 2. Reviewer opens case and assigns team
    await page.selectOption('.role-select', 'Reviewer');
    await page.click('a:has-text("Track Incident & Audit Timeline")');

    await page.click('a:has-text("Review & Assign Team")');
    await expect(page.locator('h3:has-text("Route & Assign Service Team")')).toBeVisible();

    // Select team and assign
    await page.selectOption('.action-card select:has(option:has-text("LIGHT-GRID"))', { label: 'Public Street Lighting & Electrical Grid (LIGHT-GRID)' });
    await page.click('button:has-text("Assign & Transition")');

    // Confirm assigned feedback
    await expect(page.locator('.alert-banner')).toContainText('Case assigned');
  });

  test('E2E 7 — Resolution: In Progress -> Upload evidence -> Verify closure', async ({ page }) => {
    // 1. Citizen submits incident
    await page.goto('/report');
    await page.fill('#descInput', 'Major water pipeline rupture flooding commercial market.');
    await page.selectOption('#categorySelect', 'Water leakage and drainage');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    const caseId = (await page.locator('.case-id').innerText()).trim();

    // 2. Switch to Reviewer and assign team
    await page.selectOption('.role-select', 'Reviewer');
    await page.goto(`/reviewer/cases/${caseId}`);
    await page.selectOption('.action-card select:has(option:has-text("WATER-DIV"))', { label: 'Water Supply & Urban Drainage Division (WATER-DIV)' });
    await page.click('button:has-text("Assign & Transition")');
    await expect(page.locator('.alert-banner')).toContainText('Case assigned');

    // 3. Open resolution evidence page
    await page.goto(`/reviewer/resolution/${caseId}`);
    await expect(page.locator('h1')).toContainText('Resolution Evidence & Verification Sign-Off');

    // Select sample evidence or enter details
    await page.click('button:has-text("Pothole Repaved")');
    await page.fill('textarea[placeholder*="Detail work performed"]', 'Repaired ruptured pipe joint and restored road access.');
    await page.click('button:has-text("Submit Resolution for Verification")');

    // 4. Approve resolution
    await expect(page.locator('button:has-text("Approve & Mark Resolved")')).toBeVisible();
    await page.click('button:has-text("Approve & Mark Resolved")');

    // 5. Verify redirected to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('.kpi-card.success')).toBeVisible();
  });

  test('E2E 8 — Reopen a case: Citizen review request triggers dispute review', async ({ page }) => {
    // 1. Citizen submits incident
    await page.goto('/report');
    await page.fill('#descInput', 'Streetlight pole loose and leaning dangerously towards walkway.');
    await page.selectOption('#categorySelect', 'Broken streetlights');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    const caseId = (await page.locator('.case-id').innerText()).trim();

    // 2. Reviewer assigns and resolves
    await page.selectOption('.role-select', 'Reviewer');
    await page.goto(`/reviewer/cases/${caseId}`);
    await page.selectOption('.action-card select:has(option:has-text("LIGHT-GRID"))', { label: 'Public Street Lighting & Electrical Grid (LIGHT-GRID)' });
    await page.click('button:has-text("Assign & Transition")');

    await page.goto(`/reviewer/resolution/${caseId}`);
    await page.click('button:has-text("Lights Functional")');
    await page.fill('textarea[placeholder*="Detail work performed"]', 'Reinforced pole base foundation.');
    await page.click('button:has-text("Submit Resolution for Verification")');
    await page.click('button:has-text("Approve & Mark Resolved")');

    // 3. Citizen views resolved case and requests re-inspection
    await page.selectOption('.role-select', 'Citizen');
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText('Resolved', { exact: true })).toBeVisible();

    const disputeBtn = page.locator('button:has-text("Request Re-inspection")');
    await expect(disputeBtn).toBeVisible();
    await disputeBtn.click();
    await page.fill('.dispute-form textarea', 'Pole is still wobbling when wind blows.');
    await page.click('button:has-text("Submit Review Request")');
    await expect(page.locator('.dispute-submitted-banner')).toBeVisible();
  });

  test('E2E 9 — Authorization: Enforce role-based access on backend', async ({ page, request }) => {
    // Citizen attempting reviewer action via API must be forbidden
    await page.goto('/');
    await page.waitForFunction(() => !!localStorage.getItem('civiclens_user'));
    const token = await page.evaluate(() => {
      const u = localStorage.getItem('civiclens_user');
      return u ? JSON.parse(u).token : '';
    });

    const res = await request.post('http://localhost:5000/api/cases/CASE-2026-9999/assign', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { teamId: 'team-roads' }
    });

    expect(res.status()).toBe(403); // Forbidden for Citizen role
  });

  test('E2E 10 — Persistence and error handling: Reload page and confirm state persists', async ({ page }) => {
    // 1. Submit incident
    await page.goto('/report');
    await page.fill('#descInput', 'Persistent road crater requiring heavy asphalt filling.');
    await page.selectOption('#categorySelect', 'Road damage and potholes');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    const caseId = (await page.locator('.case-id').innerText()).trim();

    // 2. Open case detail
    await page.goto(`/cases/${caseId}`);
    await expect(page.locator('h1')).toContainText('Persistent road crater');

    // 3. Refresh browser and verify state persists
    await page.reload();
    await expect(page.locator('.case-id')).toContainText(caseId);
    await expect(page.locator('.timeline-container')).toBeVisible();
  });

  test('E2E 11 — Incident lifecycle: Citizen can modify details and delete reported incident', async ({ page }) => {
    await page.goto('/report');

    // 1. Submit a fresh incident
    await page.fill('#descInput', 'Damaged speed breaker causing traffic bottleneck.');
    await page.click('.simulated-map');
    await page.fill('#addressInput', 'Road 12, Sector 5');
    await page.click('button:has-text("Submit Civic Report")');

    // 2. Land on confirmation, get ID, and navigate to case detail
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    const caseIdText = await page.locator('.case-id').innerText();
    const caseId = caseIdText.trim();

    await page.goto(`/cases/${caseId}`);
    await expect(page.locator('h1')).toContainText('Damaged speed breaker');

    // 3. Click Modify Report button
    await expect(page.locator('button:has-text("Modify Report")')).toBeVisible();
    await page.click('button:has-text("Modify Report")');

    // 4. Update title, category, description, location
    await expect(page.locator('.modal-container')).toBeVisible();
    await page.fill('.form-group-modal input[placeholder*="Short descriptive title"]', 'Hazardous Broken Speed Breaker');
    await page.selectOption('.form-group-modal select', 'Road damage and potholes');
    await page.fill('.form-group-modal textarea', 'Broken speed breaker with exposed metal rebar creating severe hazard.');
    await page.fill('.form-group-modal input[placeholder*="Street name"]', 'Road 12 Intersection, Sector 5');

    // 5. Save Modifications
    await page.click('button:has-text("Save Modifications")');
    await expect(page.locator('.modal-container')).not.toBeVisible();

    // Verify modifications updated in UI
    await expect(page.locator('h1')).toContainText('Hazardous Broken Speed Breaker');
    await expect(page.locator('.desc-text')).toContainText('Broken speed breaker with exposed metal rebar');

    // 6. Delete Report
    await expect(page.locator('button:has-text("Delete Report")')).toBeVisible();
    await page.click('button:has-text("Delete Report")');

    // Confirm deletion modal
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h4')).toContainText('Delete this Incident Report?');
    await page.click('button:has-text("Yes, Delete Report")');

    // 7. Verify redirected to /my-reports and case no longer listed
    await page.waitForURL('/my-reports');
    await expect(page.locator(`text=${caseId}`)).not.toBeVisible();
  });

  test('E2E 12 — Auto-detect Hindi language & Other civic issues category fallback', async ({ page }) => {
    await page.goto('/report');

    // 1. Initially verify category defaults to Other civic issues
    const categorySelect = page.locator('#categorySelect');
    await expect(categorySelect).toHaveValue('Other civic issues');

    // 2. Type unclear Hindi description (without manually changing language dropdown from English)
    await page.fill('#descInput', 'हमारे इलाके में बहुत समस्या है, कृपया सहायता करें');
    await page.click('.simulated-map');

    // Verify language automatically updated to Hindi in language selector
    const langSelect = page.locator('.lang-selector select');
    await expect(langSelect).toHaveValue('hi');

    // Verify category remains 'Other civic issues' since description is general/unclear
    await expect(categorySelect).toHaveValue('Other civic issues');

    // 3. Submit report
    await page.click('button:has-text("Submit Civic Report")');

    // 4. Verify confirmation page displays Hindi language and Other civic issues category
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.case-id')).toContainText('CASE-2026-');
    await expect(page.locator('.ai-field:has-text("Report Language:")')).toContainText('Hindi');
    await expect(page.locator('.ai-field:has-text("Assigned Category:")')).toContainText('Other civic issues');

    // 5. Navigate to case detail and verify language is displayed in header & meta
    await page.click('a:has-text("Track Incident & Audit Timeline")');
    await expect(page.locator('.meta-row')).toContainText('Hindi');
    await expect(page.locator('.meta-row')).toContainText('Other civic issues');
  });

  test('E2E 13 — Audio Clarity Nudge Modal: Unclear audio (< 4 words or silent) nudges citizen', async ({ page }) => {
    await page.goto('/report');

    // 1. Upload audio fixture which has no clear voice (< 4 words / silent test audio)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload Audio File")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, 'fixtures/test_audio.webm'));

    // 2. Verify Audio Clarity Nudge popup modal appears
    await expect(page.locator('.audio-nudge-modal')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.audio-nudge-modal h2')).toContainText("Audio Recording Not Clear");
    await expect(page.locator('button:has-text("Re-record Voice")')).toBeVisible();
    await expect(page.locator('button:has-text("Choose Category Manually")')).toBeVisible();
    await expect(page.locator('button:has-text("Keep as \'Other Civic Issues\' & Continue")')).toBeVisible();

    // 3. Click Choose Category Manually
    await page.click('button:has-text("Choose Category Manually")');

    // 4. Verify modal closes and category select receives highlight/focus
    await expect(page.locator('.audio-nudge-modal')).not.toBeVisible();
    await expect(page.locator('#categorySelect')).toBeVisible();

    // 5. Select category and fill description to submit
    await page.selectOption('#categorySelect', 'Waste and sanitation');
    await page.fill('#descInput', 'Garbage bin overflowing on street corner.');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');

    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.case-id')).toContainText('CASE-2026-', { timeout: 15000 });
  });

  test('E2E 14 — Quality Flags: Audio quality notice displayed on confirmation and detail', async ({ page }) => {
    await page.goto('/report');

    // 1. Upload audio fixture
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload Audio File")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, 'fixtures/test_audio.webm'));

    // If audio nudge appears, dismiss it with "Keep as Other Civic Issues & Continue"
    const nudgeKeepBtn = page.locator('button:has-text("Keep as \'Other Civic Issues\' & Continue")');
    if (await nudgeKeepBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nudgeKeepBtn.click();
    }

    // 2. Submit report with audio
    await page.fill('#descInput', 'Unclear audio recording regarding street maintenance.');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');

    // 3. Confirmation page displays Audio Not Clear quality notice
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.quality-flag-box.audio-flag')).toBeVisible();
    await expect(page.locator('.quality-flag-box.audio-flag')).toContainText('Audio Not Clear');

    // 4. Navigate to case detail and verify quality warning tag on evidence card
    await page.click('a:has-text("Track Incident & Audit Timeline")');
    await expect(page.locator('.media-quality-tag.warning-tag')).toBeVisible();
    await expect(page.locator('.media-quality-tag.warning-tag')).toContainText('Audio Not Clear');
  });

  test('E2E 15 — Non-Civic Matter: Issues outside government jurisdiction flagged with P4 priority', async ({ page }) => {
    await page.goto('/report');

    // 1. Enter non-civic private apartment dispute
    await page.fill('#descInput', 'Water leakage from the ceiling in my private bedroom and disputes with landlord regarding kitchen paint.');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');

    // 2. Verify confirmation page displays Outside Municipal Jurisdiction flag and P4
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.jurisdiction-flag-box')).toBeVisible();
    await expect(page.locator('.jurisdiction-flag-box')).toContainText('Outside Municipal Jurisdiction / Non-Civic Matter');
    await expect(page.locator('.badge:has-text("P4 Recommended")')).toBeVisible();

    // 3. Navigate to case detail and verify non-civic banner is displayed
    await page.click('a:has-text("Track Incident & Audit Timeline")');
    await expect(page.locator('.non-civic-jurisdiction-banner')).toBeVisible();
    await expect(page.locator('.non-civic-jurisdiction-banner')).toContainText('Outside Municipal Jurisdiction / Non-Civic Issue');
  });

  test('E2E 16 — Emergency Crisis Helpline: Distress keywords trigger clickable helpline dial buttons', async ({ page }) => {
    await page.goto('/report');

    // 1. Type distress crisis keywords in report description
    await page.fill('#descInput', 'Severe distress and need suicide helpline urgent counseling support');

    // 2. Verify real-time Emergency Crisis Card renders immediately on the reporting form
    await expect(page.locator('.emergency-crisis-banner')).toBeVisible();
    await expect(page.locator('.emergency-crisis-banner h3')).toContainText('Immediate Crisis Support & Safety Helplines');
    await expect(page.locator('.emergency-concern')).toContainText('Suicide & Mental Health Crisis');

    // 3. Verify verified Indian national emergency numbers with clickable tel: links
    const teleManasBtn = page.locator('.emergency-crisis-banner a[href="tel:14416"]');
    await expect(teleManasBtn).toBeVisible();
    await expect(teleManasBtn).toContainText('14416');

    const emergency112Btn = page.locator('.emergency-crisis-banner a[href="tel:112"]');
    await expect(emergency112Btn).toBeVisible();

    // 4. Submit report and verify confirmation page preserves emergency helplines
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');

    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await expect(page.locator('.emergency-crisis-box')).toBeVisible();
    await expect(page.locator('.emergency-crisis-box')).toContainText('Emergency & Crisis Support');
    await expect(page.locator('.helpline-dial-list a[href="tel:14416"]')).toBeVisible();

    // 5. Navigate to case detail and verify emergency support card remains visible
    await page.click('a:has-text("Track Incident & Audit Timeline")');
    await expect(page.locator('.emergency-crisis-card')).toBeVisible();
    await expect(page.locator('.emergency-crisis-card a[href="tel:14416"]')).toBeVisible();
  });

  test('E2E 17 — Rate Limiting: Excessive incoming requests receive HTTP 429 Too Many Requests', async ({ request }) => {
    // 1. Send first request (Permitted)
    const res1 = await request.get('http://localhost:5000/api/admin/ratelimit-test');
    expect(res1.status()).toBe(200);

    // 2. Send second request (Permitted)
    const res2 = await request.get('http://localhost:5000/api/admin/ratelimit-test');
    expect(res2.status()).toBe(200);

    // 3. Send third request immediately (Rate Limit Exceeded)
    const res3 = await request.get('http://localhost:5000/api/admin/ratelimit-test');
    expect(res3.status()).toBe(429);
    const body = await res3.json();
    expect(body.message).toContain('Too many requests. Please slow down and try again later.');
    expect(body.statusCode).toBe(429);
  });

  test('E2E 18 — Image Restrictions: Image larger than 2MB is rejected with error banner', async ({ page }) => {
    await page.goto('/report');

    // 1. Attempt to upload oversized image (2.5 MB)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload File")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, 'fixtures/test_oversized.jpg'));

    // 2. Verify client-side rejection error banner
    await expect(page.locator('.alert-banner.warning')).toBeVisible();
    await expect(page.locator('.alert-banner.warning')).toContainText('Image exceeds the maximum allowed size of 2 MB');

    // 3. Verify photo preview is not attached
    await expect(page.locator('.attached-media-preview')).not.toBeVisible();
  });

  test('E2E 19 — Audio Persistence & Playback: Recorded audio can be played again from My Requests', async ({ page }) => {
    await page.goto('/report');

    // 1. Upload audio recording
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload Audio File")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, 'fixtures/test_audio.webm'));

    // 2. Wait for audio player or nudge modal to appear and dismiss nudge if present
    await expect(page.locator('.audio-player, .audio-nudge-modal').first()).toBeVisible({ timeout: 15000 });
    const nudgeKeepBtn = page.locator('button:has-text("Keep as \'Other Civic Issues\' & Continue")');
    if (await nudgeKeepBtn.isVisible().catch(() => false)) {
      await nudgeKeepBtn.click();
    }

    // 3. Submit report with audio
    await page.fill('#descInput', 'Audio recording report for drainage inspection.');
    await page.click('.simulated-map');
    await page.click('button:has-text("Submit Civic Report")');

    // 4. Land on confirmation, then navigate to My Reports
    await page.waitForURL(/\/confirmation\/CASE-2026-/, { timeout: 30000 });
    await page.goto('/my-reports');

    // 5. Verify audio player control is rendered on the case card for playback
    await expect(page.locator('.card-audio-player').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.card-audio-player audio').first()).toBeVisible();
  });

  test('E2E 20 — Authentication Portal: Citizen registration, citizen login, and staff portal login', async ({ page }) => {
    const timestamp = Date.now();
    const testUsername = `user_${timestamp}`;
    const testEmail = `user_${timestamp}@example.com`;

    // 1. Navigate to /login
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('CivicLens Authentication Portal');

    // 2. Switch to Citizen Register tab
    await page.click('button:has-text("Citizen Register")');
    await page.fill('#regFullName', 'Rohan Mehta');
    await page.fill('#regEmail', testEmail);
    await page.fill('#regUsername', testUsername);
    await page.fill('#regPassword', 'SecurePass123!');
    await page.click('button:has-text("Register Citizen Account")');

    // 3. Verify successful registration redirects to My Reports
    await page.waitForURL('/my-reports', { timeout: 15000 });

    // 4. Navigate back to /login and test Staff Portal (Reviewer Login)
    await page.goto('/login');
    await page.click('button:has-text("Reviewer / Admin Login")');
    await page.click('button:has-text("Vikram Patel (Reviewer)")');
    await page.click('button:has-text("Sign In as Reviewer")');

    // 5. Verify successful reviewer authentication redirects to Reviewer Dashboard
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Municipal Case Review Queue');
  });

});

