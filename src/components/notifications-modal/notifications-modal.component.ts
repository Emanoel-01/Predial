import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
})
export class NotificationsModalComponent {
  isOpen = input.required<boolean>();
  notifications = input.required<Notification[]>();
  closeModal = output<void>();
  markAsRead = output<number>();

  onClose() {
    this.closeModal.emit();
  }

  onMarkAsRead(id: number) {
    this.markAsRead.emit(id);
  }
}
