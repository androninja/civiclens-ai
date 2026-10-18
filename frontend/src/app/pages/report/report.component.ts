import { Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { I18nService } from '../../services/i18n.service';
import { EmergencyHelpline } from '../../models/case.model';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-page container">
      <!-- Emergency Helpline Banner (Real-time Speech / Audio Detection) -->
      @if (liveEmergencyTrigger()) {
        <div class="emergency-crisis-banner">
          <div class="emergency-banner-top">
            <span class="material-icons-round emergency-pulse-icon">crisis_alert</span>
            <div>
              <h3>Immediate Crisis Support & Safety Helplines</h3>
              <p class="emergency-concern">Detected Concern: <strong>{{ liveEmergencyTrigger()?.type }}</strong></p>
            </div>
          </div>
          <p class="emergency-note">
            If you or someone around you is in immediate danger, crisis, or facing abuse, please contact these verified 24/7 national emergency helplines right away:
          </p>
          <div class="emergency-call-grid">
            @for (helpline of liveEmergencyTrigger()?.helplines; track helpline.number) {
              <a [href]="'tel:' + helpline.number" class="btn btn-emergency-call">
                <span class="material-icons-round">phone_in_talk</span>
                <div class="call-details">
                  <span class="call-num">Call {{ helpline.number }}</span>
                  <span class="call-label">{{ helpline.name }}</span>
                </div>
              </a>
            }
          </div>
        </div>
      }

      <!-- Audio Ambiguity / Quality Nudge Modal -->
      @if (showAudioNudgeModal()) {
        <div class="audio-nudge-overlay" (click)="dismissAudioNudge()">
          <div class="audio-nudge-modal" (click)="$event.stopPropagation()">
            <div class="nudge-icon-wrapper">
              <span class="material-icons-round nudge-icon">help_outline</span>
            </div>
            <h2>Audio Recording Not Clear</h2>
            <p class="nudge-desc">
              Your voice recording is unclear, inaudible, or has fewer than 4 words. Clearer audio helps ensure accurate routing to municipal repair crews.
            </p>

            <div class="nudge-quote-card">
              <div class="quote-header">
                <span class="material-icons-round">record_voice_over</span>
                <span>Transcribed Voice Note:</span>
              </div>
              <p class="quote-text">"{{ ambiguousAudioTranscript() }}"</p>
              @if (ambiguousAudioQualityNote()) {
                <div class="quote-quality-note">
                  <span class="material-icons-round">info</span>
                  <span>{{ ambiguousAudioQualityNote() }}</span>
                </div>
              }
            </div>

            <p class="nudge-decision-prompt">How would you like to proceed?</p>

            <div class="nudge-button-group">
              <button type="button" class="btn btn-primary btn-block" (click)="reRecordAudio()">
                <span class="material-icons-round">mic</span>
                <span>Re-record Voice with Clearer Voice</span>
              </button>
              <button type="button" class="btn btn-secondary btn-block" (click)="selectCategoryManually()">
                <span class="material-icons-round">category</span>
                <span>Choose Category Manually</span>
              </button>
              <button type="button" class="btn btn-outline btn-block text-muted" (click)="dismissAudioNudge()">
                <span class="material-icons-round">check</span>
                <span>Keep as 'Other Civic Issues' & Continue</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Header -->
      <div class="report-header">
        <div class="badge badge-status-needs-review">Citizen Reporting Portal</div>
        <h1>{{ i18n.t('report_page_title') }}</h1>
        <p>{{ i18n.t('report_page_sub') }}</p>
      </div>

      <div class="report-layout">
        <div class="report-main">

          <!-- ============================================== -->
          <!-- MAIN INPUT 1: Photo / Video (Max 3s)           -->
          <!-- ============================================== -->
          <div class="civic-card main-input-card">
            <div class="step-indicator">
              <span class="step-num">1</span>
              <div class="step-titles">
                <h2>{{ i18n.t('step1_photo_title') }}</h2>
                <p>{{ i18n.t('step1_photo_sub') }}</p>
              </div>
            </div>

            <!-- Active Camera Viewport -->
            @if (isCameraActive()) {
              <div class="camera-viewport-box">
                <video #videoElement autoplay playsinline muted class="video-preview"></video>
                @if (isRecordingVideo()) {
                  <div class="video-recording-indicator">
                    <span class="pulse-dot"></span>
                    <span>Recording Video: {{ videoCountdown() }}s left</span>
                  </div>
                }
                <div class="camera-controls-overlay">
                  @if (!isRecordingVideo()) {
                    <button type="button" class="btn btn-primary btn-cam-action" (click)="captureSnapshot()">
                      <span class="material-icons-round">photo_camera</span>
                      <span>Capture Photo</span>
                    </button>
                    <button type="button" class="btn btn-danger btn-cam-action" (click)="record3SecVideo()">
                      <span class="material-icons-round">videocam</span>
                      <span>Record 3s Video</span>
                    </button>
                    <button type="button" class="btn btn-secondary btn-cam-action" (click)="stopCamera()">
                      <span>Cancel</span>
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Media / Camera Error Banner -->
            @if (cameraError()) {
              <div class="alert-banner warning media-upload-error-box">
                <span class="material-icons-round alert-icon">
                  {{ cameraError()?.includes('2 MB') ? 'warning' : 'videocam_off' }}
                </span>
                <div class="alert-content-wrap">
                  @if (cameraError()?.includes('2 MB')) {
                    <strong class="alert-heading">Image Size Limit Exceeded (Max 2 MB)</strong>
                  }
                  <span class="alert-text">{{ cameraError() }}</span>
                </div>
                <button type="button" class="btn-alert-close" (click)="cameraError.set(null)" title="Dismiss">
                  <span class="material-icons-round">close</span>
                </button>
              </div>
            }

            <!-- Attached Photo or Video Preview -->
            @if (photoPreviewUrl()) {
              <div class="attached-media-preview">
                <div class="preview-media-box">
                  @if (isVideo()) {
                    <video [src]="photoPreviewUrl()" controls autoplay loop muted class="photo-preview-img"></video>
                    <span class="media-type-badge video-badge">
                      <span class="material-icons-round">videocam</span>
                      <span>3s Video Clip Attached</span>
                    </span>
                  } @else {
                    <img [src]="photoPreviewUrl()" alt="Incident Preview" class="photo-preview-img" />
                    <span class="media-type-badge photo-badge">
                      <span class="material-icons-round">photo</span>
                      <span>Photograph Attached</span>
                    </span>
                  }
                </div>
                <div class="image-meta-bar">
                  <span class="filename">
                    {{ photoFileName() }}
                    @if (photoFile) {
                      <span class="filesize-tag">({{ (photoFile.size / (1024 * 1024)).toFixed(2) }} MB)</span>
                    }
                  </span>
                  <div class="preview-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="triggerFileInput()">
                      <span class="material-icons-round">cached</span>
                      <span>Replace</span>
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="removePhoto()">
                      <span class="material-icons-round">delete</span>
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            } @else if (!isCameraActive()) {
              <!-- Big, Easy Action Buttons for Non-Tech Users -->
              <div class="big-button-grid">
                <button type="button" class="big-action-btn primary-btn" (click)="openCamera()">
                  <div class="btn-icon-wrap">
                    <span class="material-icons-round">photo_camera</span>
                  </div>
                  <div class="btn-text-wrap">
                    <strong>Use Device Camera</strong>
                    <span>Take a photo or 3-second video</span>
                  </div>
                </button>

                <button type="button" class="big-action-btn secondary-btn" (click)="triggerFileInput()">
                  <div class="btn-icon-wrap">
                    <span class="material-icons-round">file_upload</span>
                  </div>
                  <div class="btn-text-wrap">
                    <strong>Upload File</strong>
                    <span>Choose photo or video from device</span>
                    <span class="file-size-limit-badge">
                      <span class="material-icons-round limit-icon">rule</span>
                      <span>File limit: <strong>Max 2 MB</strong></span>
                    </span>
                  </div>
                </button>
              </div>
              <div class="upload-limit-note">
                <span class="material-icons-round note-icon">info</span>
                <span>Supported formats: JPEG, PNG, WebP • <strong>Max image file size: 2 MB</strong> (automatically compressed for rapid upload)</span>
              </div>
              <input
                #fileInput
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/*"
                style="display: none"
                (change)="onFileSelected($event)" />
            }
          </div>

          <!-- ============================================== -->
          <!-- MAIN INPUT 2: Voice Message or Text Box        -->
          <!-- ============================================== -->
          <div class="civic-card main-input-card">
            <div class="step-indicator">
              <span class="step-num">2</span>
              <div class="step-titles">
                <h2>{{ i18n.t('step2_voice_title') }}</h2>
                <p>{{ i18n.t('step2_voice_sub') }}</p>
              </div>
            </div>

            <!-- Big Voice Recording Control -->
            <div class="voice-hero-box">
              @if (!isRecording() && !audioBlob()) {
                <div class="voice-hero-actions">
                  <button type="button" class="hero-voice-btn" (click)="startRecording()">
                    <span class="material-icons-round voice-mic-icon">mic</span>
                    <div class="voice-btn-info">
                      <strong>{{ i18n.t('btn_tap_to_speak') }}</strong>
                      <span>{{ i18n.t('btn_tap_to_speak_sub') }}</span>
                    </div>
                  </button>
                  <div class="voice-or-upload">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="triggerAudioUpload()">
                      <span class="material-icons-round">audio_file</span>
                      <span>{{ i18n.t('btn_upload_audio') }}</span>
                    </button>
                  </div>
                </div>
              } @else if (isRecording()) {
                <div class="recording-live-panel">
                  <div class="rec-pulsing-badge">
                    <span class="rec-dot"></span>
                    <span>Recording: {{ recordingDuration() }}s</span>
                  </div>
                  <div class="rec-instruction">
                    <span class="material-icons-round">hearing</span>
                    <span>Listening in {{ getLanguageLabel(selectedLanguage) }}... Speak clearly</span>
                  </div>
                  <button type="button" class="btn btn-danger btn-stop-rec" (click)="stopRecording()">
                    <span class="material-icons-round">stop_circle</span>
                    <span>Finish Recording</span>
                  </button>
                </div>
                @if (liveSpeechTranscript()) {
                  <div class="live-speech-pill">
                    <span class="live-tag">Live Spoken Words:</span>
                    <span class="live-body">{{ liveSpeechTranscript() }}</span>
                  </div>
                }
              } @else if (audioBlob()) {
                <div class="audio-ready-panel">
                  <audio #audioPlayer controls [src]="audioUrlPreview()" class="audio-player"></audio>
                  <div class="audio-ready-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="resetAudio()">
                      <span class="material-icons-round">refresh</span>
                      <span>Re-record</span>
                    </button>
                    @if (!isTranscribing()) {
                      <button type="button" class="btn btn-primary btn-sm" (click)="transcribeAudio()">
                        <span class="material-icons-round">transcribe</span>
                        <span>Re-transcribe Audio</span>
                      </button>
                    } @else {
                      <span class="transcribing-badge">
                        <span class="material-icons-round spin">sync</span>
                        Transcribing voice...
                      </span>
                    }
                  </div>
                </div>
              }

              <input
                #audioInput
                type="file"
                accept="audio/*"
                style="display: none"
                (change)="onAudioSelected($event)" />
            </div>

            <!-- Auto-Selected Category Alert Pill -->
            @if (autoCategorySelected()) {
              <div class="auto-category-banner">
                <span class="material-icons-round">auto_awesome</span>
                <span>Category auto-selected from your voice: <strong>{{ autoCategorySelected() }}</strong></span>
              </div>
            }

            <!-- Integrated Big Description Text Box -->
            <div class="form-group desc-group">
              <label for="descInput" class="desc-label">
                <span>Problem Description (Type here or speak above):</span>
                <span class="req-star">*</span>
              </label>
              <textarea
                id="descInput"
                [(ngModel)]="description"
                (ngModelChange)="onManualDescriptionChange($event)"
                rows="4"
                class="desc-textarea"
                placeholder="What is broken, damaged, or hazardous? (e.g. Deep crater pothole near metro gate, sewage water leak...)"></textarea>
            </div>

            <!-- Editable Transcript Box if Audio is Present -->
            @if (transcript() || audioBlob()) {
              <div class="transcript-editor-box">
                <div class="transcript-header">
                  <span class="label">Editable Voice Transcript ({{ getLanguageLabel(transcriptLanguage() || selectedLanguage) }}):</span>
                  @if (transcriptProvider()) {
                    <span class="badge badge-status-acknowledged">{{ transcriptProvider() }}</span>
                  }
                </div>
                <textarea
                  [ngModel]="transcript()"
                  (ngModelChange)="onTranscriptChange($event)"
                  rows="2"
                  class="transcript-textarea"
                  placeholder="Review or edit transcribed voice words..."></textarea>
              </div>
            }
          </div>

          <!-- ============================================== -->
          <!-- SUBORDINATE INPUTS (Smaller, Below Main 2)     -->
          <!-- ============================================== -->
          <div class="subordinate-card civic-card">
            <div class="sub-header">
              <span class="material-icons-round text-muted">tune</span>
              <h3>Additional Details & Location (Optional / Secondary)</h3>
            </div>
            <p class="sub-info">All options below are automatically managed, but you can adjust them if you wish.</p>

            <div class="subordinate-grid">
              <!-- Category Selector (Compact) -->
              <div class="form-group compact-field">
                <div class="label-with-badge">
                  <label for="categorySelect">Issue Category:</label>
                  @if (autoCategorySelected()) {
                    <span class="auto-badge">AI Auto-Selected</span>
                  }
                </div>
                <select id="categorySelect" [(ngModel)]="category" class="compact-select">
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

              <!-- Language Selector (Compact) -->
              <div class="form-group compact-field">
                <label>{{ i18n.t('label_language') }}</label>
                <div class="lang-selector">
                  <select [(ngModel)]="selectedLanguage" (ngModelChange)="onLanguageChange($event)" class="compact-select">
                    @for (lang of i18n.getSupportedLanguages(); track lang.code) {
                      <option [value]="lang.code">{{ lang.nativeName }} ({{ lang.name }})</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            <!-- Incident Location & Map (Compact) -->
            <div class="compact-location-box">
              <div class="location-top-row">
                <div class="loc-title">
                  <span class="material-icons-round loc-icon">place</span>
                  <strong>Incident Location (Optional)</strong>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" (click)="useMyLocation()">
                  <span class="material-icons-round">my_location</span>
                  <span>Use My Location (GPS)</span>
                </button>
              </div>
              <p class="loc-hint">You can pin your location here, or skip this: you'll be prompted to share your location after submitting.</p>

              <div class="form-group compact-address">
                <input
                  id="addressInput"
                  type="text"
                  [(ngModel)]="locationAddress"
                  class="compact-input"
                  placeholder="Street Address or Landmark (e.g. Connaught Place Outer Circle, New Delhi)" />
              </div>

              <div class="coords-row-compact">
                <span>Lat: {{ latitude ?? 'Not pinned' }}</span>
                <span>•</span>
                <span>Lng: {{ longitude ?? 'Not pinned' }}</span>
              </div>

              <!-- Interactive Pin Location Map Simulator -->
              <div class="interactive-map-box-compact">
                <div class="simulated-map" (click)="onMapClick($event)">
                  <div class="map-grid-overlay"></div>
                  @if (latitude && longitude) {
                    <div class="map-pin" [style.left.%]="pinX()" [style.top.%]="pinY()">
                      <span class="material-icons-round pin-icon">location_on</span>
                      <span class="pin-label">Incident Pin ({{ latitude }}, {{ longitude }})</span>
                    </div>
                  } @else {
                    <div class="map-unpinned-prompt">
                      <span class="material-icons-round">pin_drop</span>
                      <span>Tap anywhere on the map simulator to pinpoint coordinates (Optional)</span>
                    </div>
                  }
                  <div class="map-watermark">CivicLens Map Picker</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ============================================== -->
        <!-- SIDEBAR / BOTTOM SUBMISSION ACTIONS            -->
        <!-- ============================================== -->
        <div class="report-sidebar">
          <div class="civic-card summary-card">
            <h3>Ready to Submit?</h3>
            <p class="summary-sub">Review checklist before registering your civic report.</p>

            <div class="summary-checklist">
              <div class="check-item" [class.complete]="!!photoFile || !!photoPreviewUrl()">
                <span class="material-icons-round">{{ photoFile || photoPreviewUrl() ? 'check_circle' : 'radio_button_unchecked' }}</span>
                <span>1. Photo or Video: {{ photoFile ? 'Attached' : 'Optional' }}</span>
              </div>
              <div class="check-item" [class.complete]="!!description.trim() || !!transcript().trim()">
                <span class="material-icons-round">{{ description.trim() || transcript().trim() ? 'check_circle' : 'radio_button_unchecked' }}</span>
                <span>2. Description / Voice: {{ description.trim() || transcript().trim() ? 'Provided' : 'Required *' }}</span>
              </div>
              <div class="check-item" [class.complete]="latitude !== null && longitude !== null">
                <span class="material-icons-round">{{ latitude !== null && longitude !== null ? 'check_circle' : 'info' }}</span>
                <span>Location: {{ latitude ? 'Pinned' : 'Prompted after submit' }}</span>
              </div>
            </div>

            @if (submissionError()) {
              <div class="alert-banner error">
                <span class="material-icons-round">error</span>
                <span>{{ submissionError() }}</span>
              </div>
            }

            <button
              type="button"
              class="btn btn-primary btn-block btn-giant-submit"
              [disabled]="isSubmitting() || (!description.trim() && !transcript().trim())"
              (click)="submitReport()">
              @if (isSubmitting()) {
                <span class="material-icons-round spin">sync</span>
                <span>Analyzing with Gemini AI...</span>
              } @else {
                <span class="material-icons-round submit-rocket">send</span>
                <span>Submit Civic Report</span>
              }
            </button>
            <p class="terms-note">
              Submitted reports are processed via Google Gemini AI for automated categorization and routing.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-page {
      padding: 28px 16px 80px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .report-header {
      margin-bottom: 24px;
      h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin: 8px 0 6px; }
      p { color: #64748b; font-size: 1rem; max-width: 720px; line-height: 1.5; }
    }
    .report-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 24px;
      align-items: flex-start;
    }
    @media (max-width: 900px) {
      .report-layout {
        grid-template-columns: 1fr;
      }
      .report-sidebar {
        order: 2;
      }
    }

    /* Step Card Styling */
    .main-input-card {
      margin-bottom: 24px;
      padding: 28px 24px;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      background: #ffffff;
    }
    .step-indicator {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .step-num {
      width: 44px;
      height: 44px;
      background: #0d9488;
      color: #ffffff;
      font-size: 1.375rem;
      font-weight: 800;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 8px rgba(13, 148, 136, 0.25);
    }
    .step-titles {
      h2 { font-size: 1.375rem; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
      p { font-size: 0.875rem; color: #64748b; margin: 0; }
    }

    /* Big Action Buttons for Step 1 */
    .big-button-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 600px) {
      .big-button-grid {
        grid-template-columns: 1fr;
      }
    }
    .big-action-btn {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      border-radius: 16px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
      min-height: 80px;

      &.primary-btn {
        background: #f0fdfa;
        border: 2px solid #0d9488;
        color: #0f766e;
        &:hover { background: #ccfbf1; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(13, 148, 136, 0.15); }
        .btn-icon-wrap { background: #0d9488; color: #ffffff; }
      }
      &.secondary-btn {
        background: #f8fafc;
        border: 2px solid #cbd5e1;
        color: #334155;
        &:hover { background: #f1f5f9; border-color: #94a3b8; transform: translateY(-2px); }
        .btn-icon-wrap { background: #64748b; color: #ffffff; }
      }
    }
    .btn-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      span { font-size: 28px; }
    }
    .btn-text-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong { font-size: 1.0625rem; font-weight: 800; }
      span { font-size: 0.8125rem; opacity: 0.85; }
    }

    .file-size-limit-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      padding: 3px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      font-size: 0.75rem !important;
      font-weight: 600;
      width: fit-content;

      .limit-icon { font-size: 14px; color: #0284c7; }
      strong { font-size: 0.75rem; color: #0369a1; font-weight: 800; }
    }

    .upload-limit-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      font-size: 0.8125rem;
      color: #64748b;

      .note-icon {
        font-size: 18px;
        color: #0d9488;
        flex-shrink: 0;
      }
      strong {
        color: #0f172a;
      }
    }

    .media-upload-error-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      background: #fef2f2;
      border: 1.5px solid #f87171;
      color: #991b1b;

      .alert-icon {
        color: #dc2626;
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .alert-content-wrap {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 0.875rem;
        line-height: 1.45;

        .alert-heading {
          font-weight: 800;
          color: #b91c1c;
        }
        .alert-text {
          color: #7f1d1d;
        }
      }

      .btn-alert-close {
        background: none;
        border: none;
        cursor: pointer;
        color: #991b1b;
        padding: 2px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        opacity: 0.7;
        &:hover { opacity: 1; background: rgba(0,0,0,0.06); }
        .material-icons-round { font-size: 18px; }
      }
    }

    .filesize-tag {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      margin-left: 6px;
    }

    /* Camera Viewport */
    .camera-viewport-box {
      border-radius: 16px;
      overflow: hidden;
      background: #000;
      position: relative;
      margin-bottom: 16px;
      video { width: 100%; max-height: 380px; object-fit: cover; display: block; }
    }
    .video-recording-indicator {
      position: absolute;
      top: 14px;
      left: 14px;
      background: rgba(220, 38, 38, 0.9);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      background: #fff;
      border-radius: 50%;
      animation: pulse 1s infinite alternate;
    }
    .camera-controls-overlay {
      position: absolute;
      bottom: 16px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 0 16px;
    }
    .btn-cam-action {
      min-height: 48px;
      padding: 10px 18px;
      font-weight: 700;
      border-radius: 10px;
    }

    /* Attached Media Preview */
    .attached-media-preview {
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      overflow: hidden;
      background: #f8fafc;
    }
    .preview-media-box {
      position: relative;
      background: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      max-height: 340px;
      overflow: hidden;

      .photo-preview-img {
        max-height: 340px;
        width: 100%;
        object-fit: contain;
      }
    }
    .media-type-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      &.photo-badge { background: rgba(13, 148, 136, 0.95); color: #fff; }
      &.video-badge { background: rgba(220, 38, 38, 0.95); color: #fff; }
    }
    .image-meta-bar {
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      .filename { font-size: 0.8125rem; font-weight: 600; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .preview-actions { display: flex; gap: 8px; }

    /* Step 2 Voice Hero */
    .voice-hero-box {
      margin-bottom: 20px;
    }
    .voice-hero-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .hero-voice-btn {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 20px 24px;
      background: #0d9488;
      color: #ffffff;
      border: none;
      border-radius: 18px;
      cursor: pointer;
      text-align: left;
      min-height: 84px;
      transition: all 0.2s ease;
      box-shadow: 0 6px 16px rgba(13, 148, 136, 0.3);

      &:hover {
        background: #0f766e;
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(13, 148, 136, 0.4);
      }
    }
    .voice-mic-icon {
      font-size: 38px;
      background: rgba(255, 255, 255, 0.2);
      padding: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .voice-btn-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
      strong { font-size: 1.1875rem; font-weight: 800; }
      span { font-size: 0.8125rem; opacity: 0.9; }
    }
    .voice-or-upload {
      text-align: right;
    }

    /* Live Recording Panel */
    .recording-live-panel {
      background: #fef2f2;
      border: 2px solid #f87171;
      border-radius: 16px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .rec-pulsing-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      color: #dc2626;
      font-size: 1.0625rem;
    }
    .rec-dot {
      width: 12px;
      height: 12px;
      background: #dc2626;
      border-radius: 50%;
      animation: pulse 0.8s infinite alternate;
    }
    .rec-instruction {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      color: #991b1b;
      font-weight: 600;
    }
    .btn-stop-rec {
      min-height: 48px;
      padding: 8px 18px;
      font-weight: 700;
      font-size: 0.9375rem;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .live-speech-pill {
      background: #fff;
      border: 1px solid #fecaca;
      border-radius: 10px;
      padding: 10px 14px;
      margin-top: 10px;
      font-size: 0.875rem;
      .live-tag { font-weight: 700; color: #dc2626; margin-right: 6px; }
      .live-body { color: #1e293b; }
    }

    .audio-ready-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      flex-wrap: wrap;
      .audio-player { flex: 1; min-width: 200px; height: 38px; }
      .audio-ready-actions { display: flex; gap: 8px; align-items: center; }
    }

    /* Auto Category Pill */
    .auto-category-banner {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 10px;
      padding: 10px 16px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9375rem;
      animation: fadeIn 0.3s ease;
      span.material-icons-round { color: #059669; }
    }

    /* Description Textarea */
    .desc-group {
      margin-bottom: 16px;
    }
    .desc-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .req-star { color: #dc2626; font-weight: 800; }
    .desc-textarea {
      width: 100%;
      font-size: 1rem;
      padding: 14px 16px;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      font-family: inherit;
      line-height: 1.5;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
      &:focus {
        border-color: #0d9488;
        outline: none;
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
      }
    }

    .transcript-editor-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: 10px;
      .transcript-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
      }
      .transcript-textarea {
        width: 100%;
        font-size: 0.875rem;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-family: inherit;
        box-sizing: border-box;
      }
    }

    /* Subordinate Elements (Smaller / Below Main 2) */
    .subordinate-card {
      margin-bottom: 24px;
      padding: 22px 20px;
      border-radius: 16px;
      border: 1px dashed #cbd5e1;
      background: #fbfcfe;
    }
    .sub-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      h3 { font-size: 1.0625rem; font-weight: 700; color: #334155; margin: 0; }
    }
    .sub-info {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0 0 16px;
    }
    .subordinate-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }
    @media (max-width: 600px) {
      .subordinate-grid {
        grid-template-columns: 1fr;
      }
    }
    .compact-field {
      margin-bottom: 0;
      label { font-size: 0.8125rem; font-weight: 600; color: #475569; margin-bottom: 4px; display: block; }
    }
    .label-with-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .auto-badge {
      font-size: 0.6875rem;
      background: #ecfdf5;
      color: #059669;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
    }
    .compact-select, .compact-input {
      width: 100%;
      height: 40px;
      font-size: 0.875rem;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      box-sizing: border-box;
    }

    /* Compact Location */
    .compact-location-box {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      margin-top: 12px;
    }
    .location-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .loc-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      color: #334155;
    }
    .loc-icon { font-size: 18px; color: #0d9488; }
    .loc-hint {
      font-size: 0.75rem;
      color: #64748b;
      margin: 0 0 10px;
    }
    .compact-address {
      margin-bottom: 8px;
    }
    .coords-row-compact {
      display: flex;
      gap: 8px;
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .interactive-map-box-compact {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
    }
    .simulated-map {
      height: 140px;
      background: #e2e8f0;
      position: relative;
      cursor: crosshair;
    }
    .map-grid-overlay {
      position: absolute;
      inset: 0;
      background-image: linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px);
      background-size: 20px 20px;
    }
    .map-pin {
      position: absolute;
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
      z-index: 5;
    }
    .pin-icon { color: #dc2626; font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .pin-label { background: #0f172a; color: #fff; font-size: 0.625rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
    .map-unpinned-prompt {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #475569;
      font-weight: 600;
    }
    .map-watermark {
      position: absolute;
      bottom: 4px;
      right: 6px;
      font-size: 0.5625rem;
      color: #64748b;
    }

    /* Giant Submit Button */
    .summary-card {
      position: sticky;
      top: 84px;
      padding: 24px;
      border-radius: 16px;
      h3 { font-size: 1.125rem; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
      .summary-sub { font-size: 0.75rem; color: #64748b; margin-bottom: 16px; }
    }
    .summary-checklist {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8125rem;
      color: #94a3b8;
      font-weight: 600;
      &.complete {
        color: #059669;
        span.material-icons-round { color: #059669; }
      }
    }
    .btn-giant-submit {
      min-height: 64px;
      font-size: 1.125rem;
      font-weight: 800;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 6px 18px rgba(13, 148, 136, 0.35);
      transition: all 0.2s ease;
      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(13, 148, 136, 0.45);
      }
    }
    .submit-rocket { font-size: 24px; }
    .terms-note {
      font-size: 0.6875rem;
      color: #94a3b8;
      margin-top: 12px;
      line-height: 1.4;
      text-align: center;
    }

    /* Emergency Crisis Banner */
    .emergency-crisis-banner {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.15);
      animation: fadeIn 0.3s ease-out;
    }
    .emergency-banner-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      h3 { font-size: 1.125rem; font-weight: 800; color: #b91c1c; margin: 0; }
    }
    .emergency-pulse-icon {
      font-size: 32px;
      color: #ef4444;
      animation: pulse 1.5s infinite;
    }
    .emergency-concern {
      font-size: 0.8125rem;
      color: #7f1d1d;
      margin: 2px 0 0 0;
    }
    .emergency-note {
      font-size: 0.875rem;
      color: #374151;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .emergency-call-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .btn-emergency-call {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #dc2626;
      color: #ffffff !important;
      padding: 10px 14px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
      &:hover {
        background: #b91c1c;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
      }
      .call-details {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .call-num { font-size: 0.9375rem; font-weight: 800; }
      .call-label { font-size: 0.6875rem; opacity: 0.9; }
    }

    /* Audio Ambiguity Nudge Modal */
    .audio-nudge-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.25s ease-out;
    }
    .audio-nudge-modal {
      background: #ffffff;
      border-radius: 20px;
      max-width: 500px;
      width: 100%;
      padding: 32px 28px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
      text-align: center;
      h2 {
        font-size: 1.375rem;
        font-weight: 800;
        color: #0f172a;
        margin-top: 16px;
        margin-bottom: 8px;
      }
    }
    .nudge-icon-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #fef3c7;
      color: #d97706;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      .nudge-icon { font-size: 36px; }
    }
    .nudge-desc {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .nudge-quote-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      text-align: left;
      margin-bottom: 20px;
    }
    .quote-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #0d9488;
      margin-bottom: 6px;
      span.material-icons-round { font-size: 16px; }
    }
    .quote-text {
      font-style: italic;
      color: #334155;
      font-size: 0.875rem;
      margin: 0 0 8px 0;
    }
    .quote-quality-note {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #b45309;
      background: #fffbeb;
      padding: 6px 10px;
      border-radius: 6px;
      span.material-icons-round { font-size: 16px; }
    }
    .nudge-decision-prompt {
      font-size: 0.875rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 16px;
    }
    .nudge-button-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        font-weight: 700;
        font-size: 0.875rem;
      }
    }
    .highlight-pulse {
      outline: 3px solid #0d9488 !important;
      box-shadow: 0 0 15px rgba(13, 148, 136, 0.6) !important;
      transition: all 0.3s ease;
    }

    @keyframes pulse { from { opacity: 0.4; } to { opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `]
})
export class ReportComponent implements OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('audioInput') audioInput?: ElementRef<HTMLInputElement>;

  // Form Fields
  category = 'Other civic issues';
  description = '';
  locationAddress = '';
  latitude: number | null = null;
  longitude: number | null = null;
  selectedLanguage = 'en';

  // Photo & Video state
  photoFile: File | null = null;
  photoPreviewUrl = signal<string | null>(null);
  photoFileName = signal<string>('');
  isVideo = signal(false);
  isCameraActive = signal(false);
  cameraError = signal<string | null>(null);
  isRecordingVideo = signal(false);
  videoCountdown = signal(3);
  isDragging = signal(false);

  private mediaStream: MediaStream | null = null;
  private videoRecorder: MediaRecorder | null = null;
  private videoChunks: Blob[] = [];
  private videoCountdownInterval: any = null;

  // Voice state
  isRecording = signal(false);
  recordingDuration = signal(0);
  audioBlob = signal<Blob | null>(null);
  audioUrlPreview = signal<string | null>(null);
  serverAudioUrl = signal<string | null>(null);
  transcript = signal<string>('');
  transcriptLanguage = signal<string>('en');
  transcriptProvider = signal<string>('');
  isTranscribing = signal(false);
  liveSpeechTranscript = signal<string>('');
  speechRecognitionActive = signal(false);
  speechRecognitionSupported = signal(false);
  transcriptionError = signal<string | null>(null);
  autoCategorySelected = signal<string | null>(null);

  // Audio ambiguity nudge modal & emergency triggers
  showAudioNudgeModal = signal(false);
  ambiguousAudioTranscript = signal<string>('');
  ambiguousAudioQualityNote = signal<string | null>(null);
  liveEmergencyTrigger = signal<{ type: string; helplines: EmergencyHelpline[] } | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: any = null;
  private speechRecognition: any = null;
  private lastAutoDescription = '';

  // Map pin coordinates percent
  pinX = signal(50);
  pinY = signal(50);

  // Submission state
  isSubmitting = signal(false);
  submissionError = signal<string | null>(null);

  constructor(public i18n: I18nService, private api: ApiService, private router: Router) {
    this.selectedLanguage = this.i18n.currentLang();
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.speechRecognitionSupported.set(!!SpeechRec);
    }
  }

  onLanguageChange(lang: string) {
    this.selectedLanguage = lang;
  }

  ngOnDestroy() {
    this.stopCamera();
    this.stopRecordingTimer();
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
      this.speechRecognition = null;
    }
  }

  // --- Photo & Video Camera Methods ---
  async openCamera() {
    this.cameraError.set(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by this browser or requires HTTPS / localhost.');
      }
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.isCameraActive.set(true);

      setTimeout(() => {
        if (this.videoElement?.nativeElement && this.mediaStream) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
        }
      }, 100);
    } catch (err: any) {
      this.cameraError.set(err.message || 'Camera permission denied or camera device unavailable.');
      this.isCameraActive.set(false);
    }
  }

  captureSnapshot() {
    if (!this.videoElement?.nativeElement) return;
    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          this.photoFile = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          this.photoPreviewUrl.set(URL.createObjectURL(blob));
          this.photoFileName.set(this.photoFile.name);
          this.isVideo.set(false);
          this.stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  }

  record3SecVideo() {
    if (!this.mediaStream) return;
    this.isRecordingVideo.set(true);
    this.videoCountdown.set(3);
    this.videoChunks = [];

    let mimeType = 'video/webm';
    if (!MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : '';
    }

    try {
      this.videoRecorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
    } catch {
      this.videoRecorder = new MediaRecorder(this.mediaStream);
    }

    this.videoRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.videoChunks.push(e.data);
    };

    this.videoRecorder.onstop = () => {
      const type = this.videoRecorder?.mimeType || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(this.videoChunks, { type });
      this.photoFile = new File([blob], `camera_video_3s_${Date.now()}.${ext}`, { type });
      this.photoPreviewUrl.set(URL.createObjectURL(blob));
      this.photoFileName.set(this.photoFile.name);
      this.isVideo.set(true);
      this.stopCamera();
      this.isRecordingVideo.set(false);
    };

    this.videoRecorder.start();

    this.videoCountdownInterval = setInterval(() => {
      this.videoCountdown.update(c => c - 1);
      if (this.videoCountdown() <= 0) {
        clearInterval(this.videoCountdownInterval);
        this.videoCountdownInterval = null;
        if (this.videoRecorder && this.videoRecorder.state === 'recording') {
          this.videoRecorder.stop();
        }
      }
    }, 1000);
  }

  stopCamera() {
    if (this.videoCountdownInterval) {
      clearInterval(this.videoCountdownInterval);
      this.videoCountdownInterval = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.isCameraActive.set(false);
    this.isRecordingVideo.set(false);
  }

  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
    }
    if (input) {
      input.value = '';
    }
  }

  handleFile(file: File) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validVideoTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type) || file.name.endsWith('.mp4') || file.name.endsWith('.webm');

    if (!isImage && !isVideo) {
      this.cameraError.set('Please upload a photo (JPEG, PNG, WebP) or video (MP4, WebM max 3s).');
      return;
    }
    if (isImage && file.size > 2 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      this.cameraError.set(`Image exceeds the maximum allowed size of 2 MB (Selected file: ${sizeMb} MB). Please choose a photo under 2 MB.`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.cameraError.set('File is too large. Max size is 20MB.');
      return;
    }

    this.photoFile = file;
    this.photoFileName.set(file.name);
    this.photoPreviewUrl.set(URL.createObjectURL(file));
    this.isVideo.set(isVideo);
    this.cameraError.set(null);
  }

  removePhoto() {
    this.photoFile = null;
    this.photoPreviewUrl.set(null);
    this.photoFileName.set('');
    this.isVideo.set(false);
  }

  // --- Voice & Audio Methods ---
  getLanguageLabel(code: string): string {
    const item = this.i18n.getSupportedLanguages().find(l => l.code === code);
    return item ? `${item.name} (${item.nativeName})` : code;
  }

  detectLanguageFromText(text: string): string {
    if (!text || !text.trim()) return this.selectedLanguage || 'en';
    const str = text.trim();

    // 1. Script checks
    // Devanagari: \u0900-\u097F
    if (/[\u0900-\u097F]/.test(str)) {
      const lower = str.toLowerCase();
      if (
        lower.includes('रस्ता') || lower.includes('खड्डा') || lower.includes('पाणी') ||
        lower.includes('आहे') || lower.includes('नाही') || lower.includes('झाले') ||
        lower.includes('गळती') || lower.includes('घाण') || lower.includes('झाड') ||
        lower.includes('थांबा') || lower.includes('स्थानक') || lower.includes('करावे') ||
        lower.includes('होते') || lower.includes('पाहिजे')
      ) {
        return 'mr';
      }
      return 'hi';
    }

    // Gurmukhi / Punjabi: \u0A00-\u0A7F
    if (/[\u0A00-\u0A7F]/.test(str)) return 'pa';
    // Gujarati: \u0A80-\u0AFF
    if (/[\u0A80-\u0AFF]/.test(str)) return 'gu';
    // Bengali: \u0980-\u09FF
    if (/[\u0980-\u09FF]/.test(str)) return 'bn';
    // Tamil: \u0B80-\u0BFF
    if (/[\u0B80-\u0BFF]/.test(str)) return 'ta';
    // Telugu: \u0C00-\u0C7F
    if (/[\u0C00-\u0C7F]/.test(str)) return 'te';
    // Kannada: \u0C80-\u0CFF
    if (/[\u0C80-\u0CFF]/.test(str)) return 'kn';
    // Malayalam: \u0D00-\u0D7F
    if (/[\u0D00-\u0D7F]/.test(str)) return 'ml';

    // 2. Hinglish / Romanized Hindi check
    const lowerStr = ' ' + str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ') + ' ';
    const strongHindiWords = [
      'gaddha', 'gaddhe', 'sadak', 'sadakein', 'kachra', 'kuda', 'kooda', 'kripya', 'kripaya',
      'samasya', 'kharab', 'kharaab', 'bijli', 'bijlee', 'andhera', 'batti', 'mohalla',
      'hamare', 'humare', 'hamara', 'humara', 'paani', 'kijiye', 'dekho', 'dekhein', 'safai',
      'nahin', 'bahut', 'bohot', 'jaldi', 'madad', 'chahiye', 'ilaqe', 'ilake', 'tuta', 'toot',
      'sewer', 'naali', 'gali', 'basti', 'pedh', 'janwar', 'kutta', 'kutte'
    ];
    for (const word of strongHindiWords) {
      if (lowerStr.includes(' ' + word + ' ')) {
        return 'hi';
      }
    }

    const commonHindiWords = [
      'hai', 'hain', 'nahi', 'mera', 'meri', 'mere', 'pani', 'ghar', 'gaya', 'gayi', 'gaye',
      'raha', 'rahi', 'rahe', 'karo', 'karein', 'karna', 'yahan', 'yaha', 'wahan', 'waha',
      'kahan', 'bhi', 'aur', 'pe', 'se', 'ko', 'par', 'log', 'bachha'
    ];
    let matchCount = 0;
    for (const word of commonHindiWords) {
      if (lowerStr.includes(' ' + word + ' ')) {
        matchCount++;
        if (matchCount >= 2) {
          return 'hi';
        }
      }
    }

    return this.selectedLanguage || 'en';
  }

  onTranscriptChange(val: string) {
    this.transcript.set(val);
    if (!this.description.trim() || this.description === this.lastAutoDescription) {
      this.description = val;
      this.lastAutoDescription = val;
    }
    const detected = this.detectLanguageFromText(val);
    if (detected !== 'en' || this.selectedLanguage === 'en') {
      this.selectedLanguage = detected;
      this.transcriptLanguage.set(detected);
    }
    this.autoSelectCategory(val);
    this.checkEmergencyKeywords(val);
  }

  onManualDescriptionChange(val: string) {
    const detected = this.detectLanguageFromText(val);
    if (detected !== 'en' || this.selectedLanguage === 'en') {
      this.selectedLanguage = detected;
      this.transcriptLanguage.set(detected);
    }
    this.autoSelectCategory(val);
    this.checkEmergencyKeywords(val);
  }

  // Automatic Category Selection from spoken transcript or text
  autoSelectCategory(text: string) {
    if (!text || !text.trim()) return;
    const lower = text.toLowerCase();

    // Road damage and potholes
    if (
      lower.includes('speed breaker') || lower.includes('pothole') || lower.includes('crater') || lower.includes('road') ||
      lower.includes('asphalt') || lower.includes('pavement') || lower.includes('footpath') ||
      lower.includes('tarmac') || lower.includes('गड्ढा') || lower.includes('सड़क') ||
      lower.includes('फुटपाथ') || lower.includes('खड्डा') || lower.includes('रस्ता') ||
      lower.includes('ரோடு') || lower.includes('குழி') || lower.includes('గుంత') ||
      lower.includes('రోడ్డు') || lower.includes('রাস্তা') || lower.includes('গর্ত') ||
      lower.includes('ખાડો') || lower.includes('રસ્તો') || lower.includes('ਖੱਡਾ')
    ) {
      this.category = 'Road damage and potholes';
      this.autoCategorySelected.set('Road damage and potholes');
      return;
    }

    // Waste and sanitation
    if (
      lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') ||
      lower.includes('dump') || lower.includes('rubbish') || lower.includes('litter') ||
      lower.includes('debris') || lower.includes('smell') || lower.includes('stench') ||
      lower.includes('कूड़ा') || lower.includes('कचरा') || lower.includes('गंदगी') ||
      lower.includes('सफाई') || lower.includes('घाण') || lower.includes('குப்பை') ||
      lower.includes('చెత్త') || lower.includes('আবর্জনা') || lower.includes('કચરો') ||
      lower.includes('ਕੂੜਾ')
    ) {
      this.category = 'Waste and sanitation';
      this.autoCategorySelected.set('Waste and sanitation');
      return;
    }

    // Water leakage and drainage
    if (
      lower.includes('water') || lower.includes('leak') || lower.includes('pipe') ||
      lower.includes('burst') || lower.includes('drain') || lower.includes('drainage') ||
      lower.includes('flood') || lower.includes('waterlog') || lower.includes('sewage') ||
      lower.includes('पानी') || lower.includes('रिसाव') || lower.includes('पाइप') ||
      lower.includes('नाली') || lower.includes('जलभराव') || lower.includes('सीवर') ||
      lower.includes('पाणी') || lower.includes('गळती') || lower.includes('தண்ணீர்') ||
      lower.includes('கசிவு') || lower.includes('నీరు') || lower.includes('లీకేజీ') ||
      lower.includes('জল') || lower.includes('পায়খানা') || lower.includes('પાણી')
    ) {
      this.category = 'Water leakage and drainage';
      this.autoCategorySelected.set('Water leakage and drainage');
      return;
    }

    // Broken streetlights
    if (
      lower.includes('light') || lower.includes('streetlight') || lower.includes('lamp') ||
      lower.includes('bulb') || lower.includes('pole') || lower.includes('dark') ||
      lower.includes('lighting') || lower.includes('बत्ती') || lower.includes('स्ट्रीट लाइट') ||
      lower.includes('खंभा') || lower.includes('अंधेरा') || lower.includes('रोशनी') ||
      lower.includes('दिवा') || lower.includes('अंधार') || lower.includes('விளக்கு') ||
      lower.includes('లైటు') || lower.includes('আলো') || lower.includes('લાઈટ')
    ) {
      this.category = 'Broken streetlights';
      this.autoCategorySelected.set('Broken streetlights');
      return;
    }

    // Public safety and accessibility
    if (
      lower.includes('wire') || lower.includes('electric') || lower.includes('spark') ||
      lower.includes('shock') || lower.includes('hazard') || lower.includes('danger') ||
      lower.includes('fire') || lower.includes('manhole') ||
      lower.includes('accessibility') || lower.includes('ramp') || lower.includes('बिजली') ||
      lower.includes('तार') || lower.includes('करंट') || lower.includes('खतरा') ||
      lower.includes('वीज') || lower.includes('மின்சாரம்') || lower.includes('విద్యుత్') ||
      lower.includes('বিপদ') || lower.includes('વીજળી')
    ) {
      this.category = 'Public safety and accessibility';
      this.autoCategorySelected.set('Public safety and accessibility');
      return;
    }

    // Traffic signals and road signage
    if (
      lower.includes('traffic') || lower.includes('signal') || lower.includes('signage') ||
      lower.includes('signboard') || lower.includes('sign post') || lower.includes('zebra crossing') ||
      lower.includes('divider') || lower.includes('सिग्नल') ||
      lower.includes('ट्रैफिक') || lower.includes('संकेत') || lower.includes('ट्रॅफिक') ||
      lower.includes('சிக்னல்') || lower.includes('సిగ్నల్')
    ) {
      this.category = 'Traffic signals and road signage';
      this.autoCategorySelected.set('Traffic signals and road signage');
      return;
    }

    // Parks, trees and public greenery
    if (
      lower.includes('tree') || lower.includes('branch') || lower.includes('park') ||
      lower.includes('garden') || lower.includes('plant') || lower.includes('greenery') ||
      lower.includes('horticulture') || lower.includes('lawn') || lower.includes('fallen tree') ||
      lower.includes('पेड़') || lower.includes('पौधा') || lower.includes('शाखा') ||
      lower.includes('बगीचा') || lower.includes('पार्क') || lower.includes('झाड') ||
      lower.includes('फांदी') || lower.includes('மரம்') || lower.includes('பூங்கா') ||
      lower.includes('చెట్టు')
    ) {
      this.category = 'Parks, trees and public greenery';
      this.autoCategorySelected.set('Parks, trees and public greenery');
      return;
    }

    // Stray animals and public health
    if (
      lower.includes('stray') || lower.includes('dog') || lower.includes('animal') ||
      lower.includes('cattle') || lower.includes('cow') || lower.includes('monkey') ||
      lower.includes('dead animal') || lower.includes('carcass') || lower.includes('mosquito') ||
      lower.includes('pest') || lower.includes('कुत्ता') || lower.includes('पशु') ||
      lower.includes('जानवर') || lower.includes('मच्छर') || lower.includes('गाय') ||
      lower.includes('कुत्रा') || lower.includes('जनावर') || lower.includes('நாய்') ||
      lower.includes('விலங்கு') || lower.includes('కుక్క')
    ) {
      this.category = 'Stray animals and public health';
      this.autoCategorySelected.set('Stray animals and public health');
      return;
    }

    // Air, noise and environmental pollution
    if (
      lower.includes('pollution') || lower.includes('smoke') || lower.includes('burning') ||
      lower.includes('smog') || lower.includes('toxic') || lower.includes('loudspeaker') ||
      lower.includes('noise') || lower.includes('fumes') || lower.includes('chimney') ||
      lower.includes('प्रदूषण') || lower.includes('धुआं') || lower.includes('शोर') ||
      lower.includes('आवाज') || lower.includes('जलाना') || lower.includes('धूर') ||
      lower.includes('புகை') || lower.includes('மாசு') || lower.includes('పొగ')
    ) {
      this.category = 'Air, noise and environmental pollution';
      this.autoCategorySelected.set('Air, noise and environmental pollution');
      return;
    }

    // Public transport and bus shelters
    if (
      lower.includes('bus') || lower.includes('shelter') || lower.includes('bus stop') ||
      lower.includes('bus stand') || lower.includes('transit') || lower.includes('metro gate') ||
      lower.includes('depot') || lower.includes('बस') || lower.includes('स्टॉप') ||
      lower.includes('स्थानक') || lower.includes('थांबा') || lower.includes('பேருந்து') ||
      lower.includes('బస్సు')
    ) {
      this.category = 'Public transport and bus shelters';
      this.autoCategorySelected.set('Public transport and bus shelters');
      return;
    }

    // Encroachment and illegal hoarding
    if (
      lower.includes('encroach') || lower.includes('hoarding') || lower.includes('illegal banner') ||
      lower.includes('poster') || lower.includes('hawker') || lower.includes('vendor') ||
      lower.includes('pavement blocked') || lower.includes('unauthorized') || lower.includes('कब्जा') ||
      lower.includes('अतिक्रमण') || lower.includes('अवैध होर्डिंग') || lower.includes('बैनर') ||
      lower.includes('आक्रमण') || lower.includes('ஆக்கிரமிப்பு') || lower.includes('ఆక్రమణ')
    ) {
      this.category = 'Encroachment and illegal hoarding';
      this.autoCategorySelected.set('Encroachment and illegal hoarding');
      return;
    }

    // If category is not clear from the text, default to "Other civic issues"
    this.category = 'Other civic issues';
    this.autoCategorySelected.set(null);
  }

  async startRecording() {
    this.transcriptionError.set(null);
    this.liveSpeechTranscript.set('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioBlob.set(blob);
        this.audioUrlPreview.set(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        // Request transcription
        this.transcribeAudio();
      };

      // Real-time speech recognition
      this.startSpeechRecognition();

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingDuration.set(0);

      this.timerInterval = setInterval(() => {
        this.recordingDuration.update(d => d + 1);
        if (this.recordingDuration() >= 60) {
          this.stopRecording();
        }
      }, 1000);
    } catch (err: any) {
      alert('Microphone permission denied or not supported.');
    }
  }

  startSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      const langMap: Record<string, string> = {
        'en': 'en-IN',
        'hi': 'hi-IN',
        'mr': 'mr-IN',
        'ta': 'ta-IN',
        'te': 'te-IN',
        'bn': 'bn-IN',
        'gu': 'gu-IN',
        'kn': 'kn-IN',
        'ml': 'ml-IN',
        'pa': 'pa-IN'
      };
      this.speechRecognition.lang = langMap[this.selectedLanguage] || 'en-IN';

      let finalAccumulator = '';
      this.speechRecognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalAccumulator += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (finalAccumulator + interim).trim();
        if (text) {
          const detected = this.detectLanguageFromText(text);
          if (detected !== 'en' || this.selectedLanguage === 'en') {
            this.selectedLanguage = detected;
            this.transcriptLanguage.set(detected);
            if (this.speechRecognition && this.speechRecognition.lang !== langMap[detected]) {
              try {
                this.speechRecognition.lang = langMap[detected] || 'en-IN';
              } catch (e) {}
            }
          }
          this.liveSpeechTranscript.set(text);
          this.transcript.set(text);
          this.transcriptLanguage.set(this.selectedLanguage);
          this.transcriptProvider.set('Web Speech API (Real-time Speech Recognition)');
          if (!this.description.trim() || this.description === this.lastAutoDescription) {
            this.description = text;
            this.lastAutoDescription = text;
          }
          this.autoSelectCategory(text);
          this.checkEmergencyKeywords(text);
        }
      };

      this.speechRecognition.onerror = (e: any) => {
        console.warn('SpeechRecognition notice:', e.error);
      };

      this.speechRecognition.onend = () => {
        this.speechRecognitionActive.set(false);
      };

      this.speechRecognition.start();
      this.speechRecognitionActive.set(true);
    } catch (e) {
      console.warn('Could not start SpeechRecognition:', e);
    }
  }

  stopRecording() {
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
      this.speechRecognition = null;
    }
    this.speechRecognitionActive.set(false);

    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.stopRecordingTimer();
    }
  }

  stopRecordingTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  triggerAudioUpload() {
    this.audioInput?.nativeElement.click();
  }

  onAudioSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.audioBlob.set(file);
      this.audioUrlPreview.set(URL.createObjectURL(file));
      this.transcribeAudio();
    }
  }

  resetAudio() {
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
      this.speechRecognition = null;
    }
    this.speechRecognitionActive.set(false);
    this.audioBlob.set(null);
    this.audioUrlPreview.set(null);
    this.serverAudioUrl.set(null);
    this.transcript.set('');
    this.liveSpeechTranscript.set('');
    this.transcriptProvider.set('');
    this.transcriptionError.set(null);
  }

  transcribeAudio() {
    const blob = this.audioBlob();
    if (!blob) return;

    this.isTranscribing.set(true);
    this.transcriptionError.set(null);
    const existingTranscript = this.transcript().trim();

    this.api.transcribeVoice(blob, 'voice_recording.webm', this.selectedLanguage, existingTranscript).subscribe({
      next: (res: any) => {
        this.isTranscribing.set(false);
        if (res.audioUrl) {
          this.serverAudioUrl.set(res.audioUrl);
        }

        // Emergency Crisis Detection from backend analysis
        if (res.hasEmergencyTrigger) {
          this.liveEmergencyTrigger.set({
            type: res.emergencyType || 'Urgent Safety / Crisis Concern',
            helplines: res.emergencyHelplines && res.emergencyHelplines.length > 0
              ? res.emergencyHelplines
              : this.getDefaultEmergencyHelplines()
          });
        }

        if (res.transcript && res.transcript.trim()) {
          if (!existingTranscript || (res.provider && res.provider.includes('Gemini'))) {
            this.transcript.set(res.transcript);
          }
          const detected = (res.detectedLanguage && res.detectedLanguage !== 'en')
            ? res.detectedLanguage
            : this.detectLanguageFromText(this.transcript());
          if (detected !== 'en' || this.selectedLanguage === 'en') {
            this.selectedLanguage = detected;
            this.transcriptLanguage.set(detected);
          } else {
            this.transcriptLanguage.set(res.detectedLanguage || this.selectedLanguage);
          }
          this.transcriptProvider.set(res.provider || 'AI Speech Transcription');
          if (!this.description.trim() || this.description === this.lastAutoDescription) {
            this.description = this.transcript();
            this.lastAutoDescription = this.transcript();
          }
          this.autoSelectCategory(this.transcript());
          this.checkEmergencyKeywords(this.transcript());
        }

        // Check word count of the transcript
        const transcriptText = (res.transcript || this.transcript() || '').trim();
        const words = transcriptText ? transcriptText.split(/\s+/).filter((w: string) => w.length > 0) : [];
        const isLessThan4Words = words.length < 4;
        const isAudioUnclear = res.isAudioUnclear || isLessThan4Words || transcriptText.includes('[inaudible]') || transcriptText.includes('[silence]');

        // Popup nudge ONLY if audio transcription is less than 4 words or not clear, NOT for incorrect category
        if (isAudioUnclear) {
          this.ambiguousAudioTranscript.set(transcriptText || '(Inaudible voice signal)');
          this.ambiguousAudioQualityNote.set(
            res.audioQualityIssue ||
            (isLessThan4Words
              ? (words.length === 0
                  ? 'No voice signal detected. The audio was silent or recording was not captured.'
                  : `Voice note has only ${words.length} word(s). Please provide at least 4 words for clear description.`)
              : 'Voice recording has low clarity, was muffled, or silent.')
          );
          this.showAudioNudgeModal.set(true);
        }
      },
      error: () => {
        this.isTranscribing.set(false);
      }
    });
  }

  reRecordAudio() {
    this.showAudioNudgeModal.set(false);
    this.resetAudio();
    this.startRecording();
  }

  selectCategoryManually() {
    this.showAudioNudgeModal.set(false);
    setTimeout(() => {
      const el = document.getElementById('categorySelect');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('highlight-pulse');
        setTimeout(() => el.classList.remove('highlight-pulse'), 2500);
      }
    }, 100);
  }

  dismissAudioNudge() {
    this.showAudioNudgeModal.set(false);
  }

  checkEmergencyKeywords(text: string) {
    if (!text || !text.trim()) return;
    const lower = text.toLowerCase();
    if (lower.includes('suicide') || lower.includes('kill myself') || lower.includes('end my life') || lower.includes('want to die') || lower.includes('marna chahta') || lower.includes('marna chahti') || lower.includes('आत्महत्या') || lower.includes('खुदकुशी')) {
      this.liveEmergencyTrigger.set({
        type: 'Suicide & Mental Health Crisis',
        helplines: [
          { name: 'Tele-MANAS (Mental Health Helpline)', number: '14416', description: '24/7 Free National Mental Health Tele-Counseling (1800-891-4416)' },
          { name: 'National Emergency Support', number: '112', description: 'All India Emergency Response Support System' },
          { name: 'KIRAN Mental Health Helpline', number: '18005990019', description: '24/7 National Mental Health Helpline by MoSJE' },
          { name: 'Vandrevala Foundation', number: '9999666555', description: '24/7 Crisis Intervention & Emotional Support' }
        ]
      });
    } else if (lower.includes('sexual abuse') || lower.includes('molest') || lower.includes('rape') || lower.includes('assault') || lower.includes('छेड़छाड़') || lower.includes('बलात्कार') || lower.includes('यौन शोषण')) {
      this.liveEmergencyTrigger.set({
        type: 'Sexual Abuse & Assault Emergency',
        helplines: [
          { name: 'National Emergency (Police)', number: '112', description: 'Immediate Police Rapid Response' },
          { name: 'Women Helpline (Police)', number: '1091', description: '24x7 Dedicated Women Distress Helpline' },
          { name: 'Women in Distress (OSC)', number: '181', description: 'One Stop Centre Crisis Support & Legal Aid' },
          { name: 'NCW Women Safety', number: '7827170170', description: 'National Commission for Women 24/7 Abuse Cell' }
        ]
      });
    } else if (lower.includes('child abuse') || lower.includes('child labor') || lower.includes('child labour') || lower.includes('बाल शोषण') || lower.includes('बाल मजदूरी') || lower.includes('abandoned baby')) {
      this.liveEmergencyTrigger.set({
        type: 'Child Abuse & Child Safety Emergency',
        helplines: [
          { name: 'Childline India', number: '1098', description: '24x7 Free Emergency Helpline for Children in Distress' },
          { name: 'National Emergency (Police)', number: '112', description: 'Immediate Police Assistance' },
          { name: 'Women & Child Helpline', number: '181', description: 'District Child Protection Support' }
        ]
      });
    } else if (lower.includes('harassment') || lower.includes('stalking') || lower.includes('domestic violence') || lower.includes('blackmail') || lower.includes('घरेलू हिंसा') || lower.includes('उत्पीड़न') || lower.includes('threat to life')) {
      this.liveEmergencyTrigger.set({
        type: 'Harassment & Safety Emergency',
        helplines: [
          { name: 'National Emergency (Police)', number: '112', description: 'Immediate Police Rapid Action & Safety Response' },
          { name: 'Women Helpline', number: '1091', description: '24x7 Women Safety & Anti-Harassment Helpline' },
          { name: 'National Cyber Crime Helpline', number: '1930', description: 'Cyber Harassment, Stalking & Fraud Reporting' },
          { name: 'Domestic Violence Helpline', number: '181', description: 'Emergency Protection & Crisis Support' }
        ]
      });
    }
  }

  getDefaultEmergencyHelplines(): EmergencyHelpline[] {
    return [
      { name: 'National Emergency Support System', number: '112', description: 'Immediate police, fire, and medical emergency assistance' },
      { name: 'Tele-MANAS (Mental Health Crisis)', number: '14416', description: '24/7 Free National Mental Health Tele-Counseling (1800-891-4416)' },
      { name: 'Women Helpline (Police & Safety)', number: '1091', description: '24/7 Dedicated Women Safety Helpline' },
      { name: 'Childline India', number: '1098', description: '24/7 Free Emergency Helpline for Children' },
      { name: 'National Cyber Crime Reporting', number: '1930', description: 'Cyber Harassment & Cyber Stalking Support' }
    ];
  }

  // --- Location Methods ---
  useMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.latitude = parseFloat(pos.coords.latitude.toFixed(5));
        this.longitude = parseFloat(pos.coords.longitude.toFixed(5));
        this.locationAddress = `GPS Location: ${this.latitude}, ${this.longitude}`;
      },
      (err) => {
        alert('Could not retrieve GPS location: ' + err.message);
      }
    );
  }

  onMapClick(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.pinX.set(Math.round(x));
    this.pinY.set(Math.round(y));

    const baseLat = 28.6328;
    const baseLon = 77.2197;
    const dLat = (50 - y) * 0.0008;
    const dLon = (x - 50) * 0.0008;
    this.latitude = parseFloat((baseLat + dLat).toFixed(5));
    this.longitude = parseFloat((baseLon + dLon).toFixed(5));
    this.locationAddress = `Pinned location (${this.latitude}, ${this.longitude})`;
  }

  // --- Final Submit Action ---
  async submitReport() {
    this.submissionError.set(null);
    if (!this.description.trim() && !this.transcript().trim()) {
      this.submissionError.set('Please provide either an issue description or a voice recording.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      let uploadedPhotoUrl: string | undefined = undefined;

      // 1. Upload photo / video if present
      if (this.photoFile) {
        if (this.photoFile.size > 2 * 1024 * 1024) {
          const sizeMb = (this.photoFile.size / (1024 * 1024)).toFixed(2);
          const sizeErr = `Image exceeds the maximum allowed size of 2 MB (Selected file: ${sizeMb} MB). Please choose a photo under 2 MB.`;
          this.cameraError.set(sizeErr);
          this.submissionError.set(sizeErr);
          this.isSubmitting.set(false);
          return;
        }
        try {
          const uploadRes = await this.api.uploadPhoto(this.photoFile).toPromise();
          uploadedPhotoUrl = uploadRes?.url;
        } catch (err: any) {
          const errMsg = err?.error?.message || err?.message || '';
          if (errMsg.includes('2 MB')) {
            const sizeErr = 'Image exceeds the maximum allowed size of 2 MB. Please choose a photo under 2 MB.';
            this.cameraError.set(sizeErr);
            this.submissionError.set(sizeErr);
            this.isSubmitting.set(false);
            return;
          }
          console.warn('Photo/video upload failed, proceeding with local blob reference');
          uploadedPhotoUrl = this.photoPreviewUrl() || undefined;
        }
      }

      // 1b. Ensure recorded/uploaded audio URL is resolved
      if (this.audioBlob() && !this.serverAudioUrl()) {
        let waitAttempts = 0;
        while (this.isTranscribing() && waitAttempts < 40) {
          await new Promise(r => setTimeout(r, 200));
          waitAttempts++;
        }
        if (!this.serverAudioUrl()) {
          try {
            const res: any = await this.api.transcribeVoice(
              this.audioBlob()!,
              'voice_recording.webm',
              this.selectedLanguage,
              this.transcript().trim()
            ).toPromise();
            if (res?.audioUrl) {
              this.serverAudioUrl.set(res.audioUrl);
            }
          } catch (e) {
            console.warn('Fallback audio transcription/upload error:', e);
          }
        }
      }

      // 2. Submit Case to Backend API
      const fullText = `${this.description} ${this.transcript()}`.trim();
      const detected = this.detectLanguageFromText(fullText);
      let submitLang = this.selectedLanguage;
      if (detected !== 'en' || submitLang === 'en') {
        submitLang = detected;
        this.selectedLanguage = detected;
      }

      const payload: any = {
        description: this.description.trim() || this.transcript().trim(),
        category: this.category,
        language: submitLang,
        photoUrl: uploadedPhotoUrl,
        audioUrl: this.serverAudioUrl() || undefined,
        editedTranscript: this.transcript().trim() || undefined,
        locationAddress: this.locationAddress,
        latitude: this.latitude ?? undefined,
        longitude: this.longitude ?? undefined
      };

      if (this.audioBlob() && (!this.transcript().trim() || this.ambiguousAudioQualityNote())) {
        payload.isAudioUnclear = true;
        payload.audioQualityIssue = this.ambiguousAudioQualityNote() || 'Voice recording has low clarity or was muffled.';
      }

      this.api.createCase(payload).subscribe({
        next: (created) => {
          this.isSubmitting.set(false);
          // Navigate to confirmation page (where automatic location prompt modal will display if location is unpinned)
          this.router.navigate(['/confirmation', created.id]);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          console.error('Submit case error:', err);
          const detail = err.error?.message || err.message || (typeof err.error === 'string' ? err.error : JSON.stringify(err.error));
          this.submissionError.set(detail || 'Failed to submit report. Please check details and retry.');
        }
      });
    } catch (e: any) {
      this.isSubmitting.set(false);
      this.submissionError.set(e.message || 'An error occurred during submission.');
    }
  }
}
