import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WantedCharacterService } from '../services/wanted-character.service';
import { FactionService } from '../services/faction.service';
import { WantedCharacter } from '../models/WantedCharacter';
import { Faction } from '../models/Faction';
import { CustomFieldsData, CustomFieldValue } from '../models/Character';
import { FieldTemplate } from '../models/FieldTemplate';
import { FieldDisplayComponent } from '../components/field-display/field-display.component';

interface ProcessedField {
  fieldName: string;
  fieldValue: any;
  type: string;
  order: number;
}

@Component({
  selector: 'app-wanted-character-list',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, FieldDisplayComponent],
  templateUrl: './wanted-character-list.component.html',
})
export class WantedCharacterListComponent implements OnInit {
  private wantedCharacterService = inject(WantedCharacterService);
  private factionService = inject(FactionService);

  cardView = signal(true);
  selectedFactions = signal<number[]>([]);

  rawList = this.wantedCharacterService.wantedCharacterList;
  treeList = this.wantedCharacterService.wantedCharacterTreeList;
  factions = this.factionService.factions;

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

  filteredList = computed(() => {
    const factionIds = this.selectedFactions();

    return this.rawList().filter(wc => {
      if (wc.is_claimed) return false;

      if (factionIds.length > 0) {
        const wcFactionIds = (wc.factions ?? []).map(f => f.id);
        if (!factionIds.some(id => wcFactionIds.includes(id))) return false;
      }

      return true;
    });
  });

  ngOnInit() {
    this.wantedCharacterService.loadList();
    this.wantedCharacterService.loadTreeList();
    this.factionService.loadFactions();
  }

  toggleFaction(id: number) {
    this.selectedFactions.update(ids =>
      ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
    );
  }

  isFactionSelected(id: number): boolean {
    return this.selectedFactions().includes(id);
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
