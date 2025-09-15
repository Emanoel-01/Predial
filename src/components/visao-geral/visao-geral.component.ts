import { Component, ChangeDetectionStrategy, signal, output } from '@angular/core';

type ToolType = 'imageDiagnosis' | 'inspection' | 'techDiagnosis' | 'maintenanceSchedule' | 'chat' | 'profile';

@Component({
  selector: 'app-visao-geral',
  templateUrl: './visao-geral.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class VisaoGeralComponent {
  activePanel = signal<string | null>('ferramentas');
  openToolModal = output<ToolType>();

  togglePanel(panel: string): void {
    this.activePanel.update(current => (current === panel ? null : panel));
  }

  openTool(tool: ToolType): void {
    this.openToolModal.emit(tool);
  }
}