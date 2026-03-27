import { Component, AfterViewInit, ElementRef, inject } from '@angular/core';

@Component({
  selector: 'spoiler-box',
  standalone: true,
  template: `<ng-content></ng-content>`,
  styles: [`
    :host {
      display: block;
      margin: 8px 0;
    }
    :host ::ng-deep .spoiler-header {
      cursor: pointer;
      user-select: none;
      background-color: #e9e3d5;
      border: 1px solid #d1bc9b;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 0.9em;
      color: #333;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background-color 0.2s;
    }
    :host ::ng-deep .spoiler-header::before {
      content: '▶';
      font-size: 0.7em;
      color: #9c7d58;
      transition: transform 0.3s ease;
      display: inline-block;
    }
    :host ::ng-deep .spoiler-header.open::before {
      transform: rotate(90deg);
    }
    :host ::ng-deep .spoiler-header:hover {
      background-color: #d1bc9b;
    }
    :host ::ng-deep .spoiler-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
      border: 1px solid #d1bc9b;
      border-top: none;
      border-radius: 0 0 4px 4px;
      padding: 0 10px;
    }
    :host ::ng-deep .spoiler-content.open {
      max-height: 10000px;
      padding: 8px 10px;
    }
  `]
})
export class SpoilerBoxComponent implements AfterViewInit {
  private el = inject(ElementRef);

  ngAfterViewInit() {
    const host: HTMLElement = this.el.nativeElement;
    const title = host.getAttribute('data-title') ?? '';
    const innerContent = host.innerHTML;

    host.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'spoiler-header';
    header.textContent = title;

    const content = document.createElement('div');
    content.className = 'spoiler-content';
    content.innerHTML = innerContent;

    header.addEventListener('click', () => {
      header.classList.toggle('open');
      content.classList.toggle('open');
    });

    host.appendChild(header);
    host.appendChild(content);
  }
}
