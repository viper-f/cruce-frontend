import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { UserShort } from '../../models/UserShort';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-currently-active',
  imports: [RouterLink],
  templateUrl: './currently-active.component.html',
  standalone: true,
})
export class CurrentlyActiveComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private destroy$ = new Subject<void>();

  users = signal<UserShort[]>([]);

  ngOnInit() {
    this.notificationService.activeUsersUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.users.set(event.data);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
