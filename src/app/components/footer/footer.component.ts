import { Component, computed, inject, LOCALE_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BoardService } from '../../services/board.service';

@Component({
  selector: '[app-footer]',
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  standalone: true,
})
export class FooterComponent {
  private boardService = inject(BoardService);
  private locale = inject(LOCALE_ID);

  siteName = computed(() => this.boardService.board().site_name || 'Cuento');
  privacyPolicyUrl = this.locale === 'ru-RU'
    ? 'https://docs.cuento.ca/ru/privacy-policy.html'
    : 'https://docs.cuento.ca/privacy-policy.html';
}
