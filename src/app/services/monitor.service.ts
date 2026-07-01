import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MonitorService {
  constructor() {
    const nr = (window as any).newrelic;
    if (nr) nr.consent(true);
  }

  track(action: string, attributes: Record<string, unknown> = {}): void {
    const nr = (window as any).newrelic;
    if (nr) nr.addPageAction(action, attributes);
  }

  setUserContext(user: { id: number; roles: { name: string }[] } | null): void {
    const nr = (window as any).newrelic;
    if (!nr) return;
    if (!user || user.id === 0) {
      nr.setCustomAttribute('userId', null);
      nr.setCustomAttribute('userRoles', null);
    } else {
      nr.setCustomAttribute('userId', user.id);
      nr.setCustomAttribute('userRoles', user.roles.map((r: { name: string }) => r.name).join(','));
    }
  }

  setCurrentPage(page: string): void {
    const nr = (window as any).newrelic;
    if (nr) nr.setCustomAttribute('currentPage', page);
  }
}
