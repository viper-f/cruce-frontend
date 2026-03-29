import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterClaimService } from '../../services/character-claim.service';

@Component({
  selector: 'app-character-claims',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-claims.component.html',
  styleUrl: './character-claims.component.css'
})
export class CharacterClaimsComponent implements OnInit {
  private claimService = inject(CharacterClaimService);

  factions = this.claimService.factions;

  ngOnInit() {
    this.claimService.load();
  }
}
