import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WantedCharacterService } from '../services/wanted-character.service';
import { FactionService } from '../services/faction.service';
import { AuthService } from '../services/auth.service';
import { WantedCharacter } from '../models/WantedCharacter';
import { Faction } from '../models/Faction';
import { CustomFieldsData, CustomFieldValue } from '../models/Character';
import { FieldTemplate } from '../models/FieldTemplate';
import { FieldDisplayComponent } from '../components/field-display/field-display.component';
import { UserInfoComponent } from '../components/user-info/user-info.component';

interface ProcessedField {
  fieldName: string;
  fieldValue: any;
  type: string;
  order: number;
}

@Component({
  selector: 'app-wanted-character-list',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, FieldDisplayComponent, UserInfoComponent],
  templateUrl: './wanted-character-list.component.html',
})
export class WantedCharacterListComponent implements OnInit {
  private wantedCharacterService = inject(WantedCharacterService);
  private factionService = inject(FactionService);
  private authService = inject(AuthService);

  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;

  cardView = signal(true);
  selectedFactions: number[] = [];

  currentPage = 1;
  totalPages = this.wantedCharacterService.totalPages;

  list = this.wantedCharacterService.wantedCharacterList;
  treeList = this.wantedCharacterService.wantedCharacterTreeList;
  factions = this.factionService.wantedFactions;

  groupedTreeList = computed(() => {
    const list = this.treeList();
    const groups: Faction[][] = [];
    let currentGroup: Faction[] | null = null;

    for (const faction of list) {
      if (faction.level === 0) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = [faction];
      } else if (currentGroup) {
        currentGroup.push(faction);
      }
    }
    if (currentGroup) groups.push(currentGroup);

    return groups;
  });

  ngOnInit() {
    this.wantedCharacterService.loadTreeList();
    this.factionService.loadWantedFactions();
    this.applyFilters();
  }

  toggleFaction(id: number) {
    const index = this.selectedFactions.indexOf(id);
    if (index > -1) {
      this.selectedFactions.splice(index, 1);
    } else {
      this.selectedFactions.push(id);
    }
  }

  isFactionSelected(id: number): boolean {
    return this.selectedFactions.includes(id);
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadPage();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPage();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
      this.loadPage();
    }
  }

  private loadPage() {
    this.wantedCharacterService.loadListPage({
      faction_ids: this.selectedFactions,
      page: this.currentPage
    });
  }

  expandedCards = signal<Set<number>>(new Set());

  isExpanded(id: number): boolean {
    return this.expandedCards().has(id);
  }

  expandCard(id: number) {
    this.expandedCards.update(s => new Set(s).add(id));
  }

  collapseCard(id: number) {
    this.expandedCards.update(s => { const n = new Set(s); n.delete(id); return n; });
  }

  factionsString(wc: WantedCharacter): string {
    return (wc.factions ?? []).map(f => f.name).join(', ');
  }

  claimWantedCharacter(wc: WantedCharacter) {
    this.wantedCharacterService.createClaimRecord(wc.id).subscribe({
      next: () => this.loadPage(),
      error: (err) => console.error('Failed to claim wanted character', err)
    });
  }

  revokeClaimRecord(wc: WantedCharacter) {
    if (!wc.claim_record) return;
    this.wantedCharacterService.revokeClaimRecord(wc.claim_record.id).subscribe({
      next: () => this.loadPage(),
      error: (err) => console.error('Failed to revoke claim', err)
    });
  }

  canRevoke(wc: WantedCharacter): boolean {
    const record = wc.claim_record;
    if (!record) return false;
    const userId = this.currentUser()?.id;
    if (userId && userId === record.claim_author_id) return true;
    if (record.is_guest && record.guest_hash) {
      return this.getCookieValue(`claim_hash_${record.guest_hash}`) !== null;
    }
    return false;
  }

  private getCookieValue(name: string): string | null {
    const match = document.cookie.split('; ').find(c => c.startsWith(name + '='));
    return match ? match.split('=')[1] : null;
  }

  getFields(wc: WantedCharacter): ProcessedField[] {
    const data: CustomFieldsData = wc.custom_fields;
    if (!data?.field_config) return [];

    return data.field_config
      .map((config: FieldTemplate) => {
        const customField: CustomFieldValue | undefined = data.custom_fields?.[config.machine_field_name];
        let fieldValue: any = '';

        if (customField) {
          let content = customField.content;
          if (content !== null && content !== undefined && typeof content === 'object') {
            content = 'content' in content ? (content as any).content : '';
          }
          fieldValue = config.content_field_type === 'long_text'
            ? (customField.content_html || (content != null ? String(content) : ''))
            : content;
        }

        return {
          fieldName: config.human_field_name,
          fieldValue: fieldValue ?? '',
          type: config.content_field_type,
          order: config.order
        };
      })
      .sort((a, b) => a.order - b.order);
  }
}
