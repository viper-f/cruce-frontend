import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AdditionalNavlink, AdditionalNavlinkType } from '../../models/AdditionalNavlink';

@Component({
  selector: 'app-admin-additional-navlinks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-additional-navlinks.component.html',
  styleUrl: './admin-additional-navlinks.component.css'
})
export class AdminAdditionalNavlinksComponent implements OnInit {
  private apiService = inject(ApiService);

  navlinks = signal<AdditionalNavlink[]>([]);
  allRoles = signal<{ id: number; name: string }[]>([]);
  NavlinkType = AdditionalNavlinkType;

  private tempIdCounter = -1;

  ngOnInit() {
    this.apiService.get<AdditionalNavlink[]>('admin/additional-navlink/list').subscribe({
      next: (data) => this.navlinks.set(data),
      error: (err) => console.error('Failed to load navlinks', err)
    });
    this.apiService.get<{ id: number; name: string }[]>('admin/role/list').subscribe({
      next: (data) => this.allRoles.set(data),
      error: (err) => console.error('Failed to load roles', err)
    });
  }

  addNavlink() {
    const newLink: AdditionalNavlink = {
      id: this.tempIdCounter--,
      title: '',
      type: AdditionalNavlinkType.Link,
      config: {},
      roles: [],
      is_inactive: false
    };
    this.navlinks.update(list => [...list, newLink]);
  }

  isNew(link: AdditionalNavlink): boolean {
    return link.id < 0;
  }

  hasRole(link: AdditionalNavlink, roleId: number): boolean {
    return link.roles.some((r: any) => (typeof r === 'object' ? r.id : r) === roleId);
  }

  toggleRole(link: AdditionalNavlink, roleId: number, checked: boolean) {
    if (checked) {
      link.roles = [...link.roles, roleId];
    } else {
      link.roles = link.roles.filter((r: any) => (typeof r === 'object' ? r.id : r) !== roleId);
    }
  }

  save(link: AdditionalNavlink) {
    const payload = {
      ...link,
      roles: link.roles.map((r: any) => typeof r === 'object' ? r.id : r)
    };
    if (this.isNew(link)) {
      this.apiService.post<AdditionalNavlink>('admin/additional-navlink/create', payload).subscribe({
        next: (created) => this.navlinks.update(list => list.map(l => l === link ? created : l)),
        error: (err) => console.error('Failed to create navlink', err)
      });
    } else {
      this.apiService.post<AdditionalNavlink>(`admin/additional-navlink/update/${link.id}`, payload).subscribe({
        error: (err) => console.error('Failed to update navlink', err)
      });
    }
  }

  delete(link: AdditionalNavlink) {
    if (this.isNew(link)) {
      this.navlinks.update(list => list.filter(l => l !== link));
      return;
    }
    this.apiService.get(`admin/additional-navlink/delete/${link.id}`).subscribe({
      next: () => this.navlinks.update(list => list.filter(l => l !== link)),
      error: (err) => console.error('Failed to delete navlink', err)
    });
  }
}
