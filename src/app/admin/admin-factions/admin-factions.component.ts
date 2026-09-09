import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactionService } from '../../services/faction.service';
import { Faction } from '../../models/Faction';

@Component({
  selector: 'app-admin-factions',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './admin-factions.component.html',
  styleUrl: './admin-factions.component.css'
})
export class AdminFactionsComponent implements OnInit {
  private factionService = inject(FactionService);

  factions = this.factionService.factionTree;
  pendingFactions = this.factionService.pendingFactions;

  showDeleteErrorModal = false;

  private tempIdCounter = -1;

  ngOnInit() {
    this.factionService.loadFactionTree();
    this.factionService.loadPendingFactions();
  }

  approve(faction: Faction) {
    this.factionService.updateFactionStatus(faction.id, 0).subscribe({
      next: () => {
        this.factionService.pendingFactions.update(list => list.filter(f => f.id !== faction.id));
        this.factionService.loadFactionTree();
      },
      error: (err) => console.error('Failed to approve faction', err)
    });
  }

  decline(faction: Faction) {
    this.factionService.updateFactionStatus(faction.id, 1).subscribe({
      next: () => this.factionService.pendingFactions.update(list => list.filter(f => f.id !== faction.id)),
      error: (err) => console.error('Failed to decline faction', err)
    });
  }

  addChild(faction: Faction) {
    const child: Faction = {
      id: this.tempIdCounter--,
      name: '',
      level: faction.level + 1,
      description: null,
      icon: null,
      parent_id: faction.id,
      faction_status: 0,
      show_on_profile: false,
      characters: []
    };
    this.factions.update(list => {
      const index = list.indexOf(faction);
      const updated = [...list];
      updated.splice(index + 1, 0, child);
      return updated;
    });
  }

  isNew(faction: Faction): boolean {
    return faction.id < 0;
  }

  save(faction: Faction) {
    if (this.isNew(faction)) {
      this.factionService.createFaction(faction).subscribe({
        next: (created) => this.replaceFaction(faction, created),
        error: (err) => console.error('Failed to create faction', err)
      });
    } else {
      this.factionService.updateFaction(faction.id, faction).subscribe({
        error: (err) => console.error('Failed to save faction', err)
      });
    }
  }

  deleteFaction(faction: Faction) {
    this.factionService.deleteFaction(faction.id).subscribe({
      next: () => this.factions.update(list => list.filter(f => f.id !== faction.id)),
      error: (err) => {
        if (err.status === 409) {
          this.showDeleteErrorModal = true;
        } else {
          console.error('Failed to delete faction', err);
        }
      }
    });
  }

  private replaceFaction(temp: Faction, created: Faction) {
    this.factions.update(list =>
      list.map(f => f === temp ? created : f)
    );
  }
}
