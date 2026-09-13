import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { Locale } from '../../models/Locale';

type DownloadState = 'idle' | 'loading' | 'error';
type ActionState = 'idle' | 'loading' | 'error' | 'success';

const PROTECTED_LOCALES = ['en-CA'];

@Component({
  selector: 'app-admin-locales',
  host: { class: 'pun-page' },
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-locales.component.html',
})
export class AdminLocalesComponent implements OnInit {
  private apiService = inject(ApiService);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  locales = signal<Locale[]>([]);
  downloadStates = signal<Record<string, DownloadState>>({});

  pendingLocale = signal<{ locale: Locale; action: 'install' | 'uninstall' | 'delete' } | null>(null);
  actionState = signal<ActionState>('idle');

  uploadName = signal('');
  uploadCode = signal('');
  uploadFrontendFile = signal<File | null>(null);
  uploadBackendFile = signal<File | null>(null);
  uploadState = signal<ActionState>('idle');

  ngOnInit() {
    this.apiService.get<Locale[]>('locales').subscribe({
      next: (list) => this.locales.set(list.map(l => ({ ...l, is_installed: !!l.is_installed }))),
      error: (err) => console.error('Failed to load locales', err),
    });
  }

  onFrontendFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.uploadFrontendFile.set(input.files?.[0] ?? null);
  }

  onBackendFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.uploadBackendFile.set(input.files?.[0] ?? null);
  }

  upload() {
    const frontend = this.uploadFrontendFile();
    const backend = this.uploadBackendFile();
    if (!this.uploadName() || !this.uploadCode() || !frontend || !backend) return;

    const formData = new FormData();
    formData.append('human_name', this.uploadName());
    formData.append('code', this.uploadCode());
    formData.append('frontend_file', frontend);
    formData.append('backend_file', backend);

    const name = this.uploadName();
    const code = this.uploadCode();

    this.uploadState.set('loading');
    this.apiService.postForm<Partial<Locale>>('admin/locale/upload', formData).subscribe({
      next: (partial) => {
        const locale: Locale = {
          id: 0,
          human_name: name,
          code,
          is_installed: false,
          front_end_file_name: frontend.name,
          back_end_file_name: backend.name,
          ...partial,
        } as Locale;
        this.locales.update(list => [...list, locale]);
        this.uploadName.set('');
        this.uploadCode.set('');
        this.uploadFrontendFile.set(null);
        this.uploadBackendFile.set(null);
        this.uploadState.set('success');
      },
      error: () => this.uploadState.set('error'),
    });
  }

  confirmInstall(locale: Locale) {
    this.pendingLocale.set({ locale, action: 'install' });
    this.actionState.set('idle');
  }

  confirmUninstall(locale: Locale) {
    this.pendingLocale.set({ locale, action: 'uninstall' });
    this.actionState.set('idle');
  }

  confirmDelete(locale: Locale) {
    this.pendingLocale.set({ locale, action: 'delete' });
    this.actionState.set('idle');
  }

  cancelAction() {
    this.pendingLocale.set(null);
    this.actionState.set('idle');
  }

  confirmAction() {
    const pending = this.pendingLocale();
    if (!pending) return;

    this.actionState.set('loading');
    const endpoint = `admin/locale/${pending.locale.id}/${pending.action}`;

    this.apiService.post<void>(endpoint, {}).subscribe({
      next: () => {
        if (pending.action === 'delete') {
          this.locales.update(list => list.filter(l => l.id !== pending.locale.id));
        } else {
          const installed = pending.action === 'install';
          this.locales.update(list =>
            list.map(l => l.id === pending.locale.id ? { ...l, is_installed: installed } : l)
          );
        }
        this.actionState.set('success');
        setTimeout(() => {
          this.pendingLocale.set(null);
          this.actionState.set('idle');
        }, 1500);
      },
      error: () => {
        this.actionState.set('error');
        setTimeout(() => this.actionState.set('idle'), 3000);
      },
    });
  }

  isProtected(locale: Locale): boolean {
    return PROTECTED_LOCALES.includes(locale.code);
  }

  downloadFrontend(locale: Locale) {
    this.download(`admin/locale/${locale.id}/download/frontend`, locale.front_end_file_name, `frontend_${locale.id}`);
  }

  downloadBackend(locale: Locale) {
    this.download(`admin/locale/${locale.id}/download/backend`, locale.back_end_file_name, `backend_${locale.id}`);
  }

  private download(endpoint: string, filename: string, stateKey: string) {
    this.setDownloadState(stateKey, 'loading');
    const token = this.authService.authToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();

    this.http.get(`${environment.apiUrl}/${endpoint}`, { headers, responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.setDownloadState(stateKey, 'idle');
      },
      error: () => this.setDownloadState(stateKey, 'error'),
    });
  }

  private setDownloadState(key: string, state: DownloadState) {
    this.downloadStates.update(s => ({ ...s, [key]: state }));
  }

  getDownloadState(key: string): DownloadState {
    return this.downloadStates()[key] ?? 'idle';
  }
}
