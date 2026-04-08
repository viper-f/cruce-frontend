import { Component, inject, Input, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CharacterSheetHeaderComponent } from '../components/character-sheet-header/character-sheet-header.component';
import { CommonModule, DatePipe } from '@angular/common';
import { CharacterService } from '../services/character.service';

@Component({
  selector: 'app-characterview',
  imports: [
    RouterLink,
    CharacterSheetHeaderComponent,
    CommonModule,
    DatePipe
  ],
  templateUrl: './characterview.component.html',
  standalone: true,
})
export class CharacterviewComponent implements OnInit {
  @Input() id?: number;

  private characterService = inject(CharacterService);
  private router = inject(Router);

  character = this.characterService.character;

  ngOnInit() {
    if (this.id) {
      this.characterService.loadCharacter(this.id).subscribe({
        next: (data) => this.characterService.characterSignal.set(data),
        error: (err) => {
          if (err.status === 404) {
            setTimeout(() => this.router.navigate(['/404']));
          } else {
            console.error('Failed to load character', err);
          }
        }
      });
    }
  }
}
