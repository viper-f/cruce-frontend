import { Component, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactionService } from '../../services/faction.service';
import { Faction } from '../../models/Faction';
import { FactionCreateModalComponent } from '../faction-create-modal/faction-create-modal.component';

interface FactionLevel {
  label: string;
  options: Faction[];
  selectedId: number | null;
}

@Component({
  selector: 'app-faction-paths',
  standalone: true,
  imports: [CommonModule, FormsModule, FactionCreateModalComponent],
  templateUrl: './faction-paths.component.html',
})
export class FactionPathsComponent implements OnInit {
  private factionService = inject(FactionService);

  @Input() initialFactions: Faction[] = [];
  @Input() allowCreate: boolean = true;
  @Input() includePending: boolean = false;
  @Output() factionsChange = new EventEmitter<Faction[][]>();

  pathLevels = signal<FactionLevel[][]>([[]]);

  showModal = false;
  activePathIndex: number | null = null;
  activeLevelIndex: number | null = null;
  activeParentId: number | null = null;

  ngOnInit() {
    if (this.initialFactions.length > 0) {
      const factions = this.initialFactions;
      const factionMap = new Map(factions.map(f => [f.id, f]));
      const usedAsParent = new Set(
        factions.map(f => f.parent_id).filter((id): id is number => id != null)
      );
      const leaves = factions.filter(f => !usedAsParent.has(f.id));

      let factionPaths: Faction[][] = leaves.map(leaf => {
        const path: Faction[] = [];
        let current: Faction | undefined = leaf;
        while (current) {
          path.unshift(current);
          current = current.parent_id != null ? factionMap.get(current.parent_id) : undefined;
        }
        return path;
      });

      if (factionPaths.length === 0) {
        factionPaths = [[]];
      }

      this.pathLevels.set(factionPaths.map(() => []));
      factionPaths.forEach((path, pathIndex) => this.initPathFromKnownFactions(pathIndex, path));
    } else {
      this.pathLevels.set([[]]);
      this.addFactionLevel(0, 0);
    }
    this.emitSelection();
  }

  private initPathFromKnownFactions(pathIndex: number, factions: Faction[]) {
    this.pathLevels.update(paths => {
      const updated = [...paths];
      updated[pathIndex] = factions.map((faction, i) => ({
        label: `Faction ${i + 1}`,
        options: [faction],
        selectedId: faction.id
      }));
      return updated;
    });

    factions.forEach((faction, index) => {
      const parentId = index === 0 ? 0 : factions[index - 1].id;
      if (parentId < 0) return;
      this.factionService.getFactionChildren(parentId, this.includePending).subscribe(children => {
        this.pathLevels.update(paths => {
          const updated = [...paths];
          const levels = [...updated[pathIndex]];
          if (levels[index]) {
            const inList = children.some(c => c.id === faction.id);
            levels[index] = { ...levels[index], options: inList ? children : [faction, ...children] };
          }
          updated[pathIndex] = levels;
          return updated;
        });
      });
    });

    const lastId = factions[factions.length - 1].id;
    this.addFactionLevel(pathIndex, lastId);
  }

  addFactionLevel(pathIndex: number, parentId: number) {
    if (parentId < 0) return;

    this.factionService.getFactionChildren(parentId, this.includePending).subscribe(children => {
      this.pathLevels.update(paths => {
        const updated = [...paths];
        const levels = updated[pathIndex] ?? [];
        if (children.length > 0 || levels.length === 0) {
          updated[pathIndex] = [
            ...levels,
            { label: `Faction ${levels.length + 1}`, options: children, selectedId: null }
          ];
        }
        return updated;
      });
    });
  }

  onFactionChange(pathIndex: number, levelIndex: number) {
    this.pathLevels.update(paths => {
      const updated = [...paths];
      const levels = [...updated[pathIndex]];
      let selectedId = levels[levelIndex].selectedId;
      if (selectedId !== null) {
        selectedId = +selectedId;
        levels[levelIndex] = { ...levels[levelIndex], selectedId };
      }
      updated[pathIndex] = levels.slice(0, levelIndex + 1);
      return updated;
    });

    const selectedId = this.pathLevels()[pathIndex][levelIndex].selectedId;
    if (selectedId !== null) {
      this.addFactionLevel(pathIndex, selectedId);
    }

    this.emitSelection();
  }

  addFactionPath() {
    this.pathLevels.update(paths => [...paths, []]);
    this.addFactionLevel(this.pathLevels().length - 1, 0);
    this.emitSelection();
  }

  removeFactionPath(pathIndex: number) {
    if (this.pathLevels().length > 1) {
      this.pathLevels.update(paths => paths.filter((_, i) => i !== pathIndex));
      this.emitSelection();
    }
  }

  openCreateModal(pathIndex: number, levelIndex: number) {
    const levels = this.pathLevels()[pathIndex];
    this.activeParentId = levelIndex === 0 ? 0 : levels[levelIndex - 1].selectedId;
    this.activePathIndex = pathIndex;
    this.activeLevelIndex = levelIndex;
    this.showModal = true;
  }

  onModalClose() {
    this.showModal = false;
    this.activePathIndex = null;
    this.activeLevelIndex = null;
    this.activeParentId = null;
  }

  onFactionCreated(newFaction: Faction) {
    if (this.activePathIndex !== null && this.activeLevelIndex !== null) {
      const pathIndex = this.activePathIndex;
      const index = this.activeLevelIndex;
      this.pathLevels.update(paths => {
        const updated = [...paths];
        const levels = [...updated[pathIndex]];
        levels[index] = {
          ...levels[index],
          options: [...levels[index].options, newFaction],
          selectedId: newFaction.id
        };
        updated[pathIndex] = levels;
        return updated;
      });
      this.onFactionChange(pathIndex, index);
    }
  }

  private emitSelection() {
    const paths = this.pathLevels().map(levels =>
      levels
        .map(level => level.options.find(f => f.id == level.selectedId))
        .filter((f): f is Faction => f !== undefined)
    );
    this.factionsChange.emit(paths);
  }
}
