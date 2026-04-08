import {Component, effect, inject, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {BoardService} from '../services/board.service';
import {CategoryService} from '../services/category.service';
import {CurrentlyActiveComponent} from '../components/currently-active/currently-active.component';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  imports: [
    RouterLink,
    CurrentlyActiveComponent
  ]
})
export class HomeComponent implements OnInit {
  private titleService = inject(Title);
  boardService = inject(BoardService);
  categoryService = inject(CategoryService);
  board = this.boardService.board;
  categories = this.categoryService.homeCategories;

  constructor() {
    effect(() => {
      const name = this.board().site_name;
      if (name) this.titleService.setTitle(name);
    });
  }

  ngOnInit() {
    this.boardService.loadBoard();
    this.categoryService.loadHomeCategories();
  }
}
