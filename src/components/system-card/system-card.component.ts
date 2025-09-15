import { Component, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';
import { DetailsModalComponent } from '../image-diagnosis-modal/details-modal/details-modal.component';
import { PathologyModalContentComponent } from '../pathology-modal-content/pathology-modal-content.component';
import { MaintenanceTableComponent } from '../maintenance-table/maintenance-table.component';
import { Pathology } from '../../models/pathology.model';
import { UserProfile } from '../../models/user-profile.model';

// In-line model definitions based on data structure
interface Typology {
  title: string;
  definicao: string;
  componentes: string;
  aplicacoes: string;
  vantagens: string;
  desvantagens: string;
}

interface Diagnostic {
  title: string;
  desc: string;
}

interface Technology {
  icon: string;
  title: string;
  desc: string;
}

interface MaintenanceSchedule {
  [typologyTitle: string]: {
    type: string;
    activity: string;
    periodicity: string;
    recommendations: string;
    tech_diagnostics: string;
  }[];
}

interface SystemData {
  title: string;
  icon: string;
  tipologias: Typology[];
  patologias: Pathology[];
  diagnostico: Diagnostic[];
  tecnologias: Technology[];
  maintenance_schedules: MaintenanceSchedule;
}

@Component({
  selector: 'app-system-card',
  templateUrl: './system-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailsModalComponent,
    PathologyModalContentComponent,
    MaintenanceTableComponent,
  ],
})
export class SystemCardComponent {
  system = input.required<SystemData>();
  userProfile = input<UserProfile | null>(null);

  activePanel = signal<string | null>(null);

  modalData = signal<{ isOpen: boolean; type: 'typology' | 'pathology' | null; data: Typology | Pathology | null }>({
    isOpen: false,
    type: null,
    data: null,
  });

  activeScheduleKey = signal<string | null>(null);
  pathologyFilter = signal<string | null>(null);

  // New computed property to optimize filter button generation
  typologyFilters = computed(() => {
    const sys = this.system();
    if (!sys) return [];
    return sys.tipologias.filter(t => 
      sys.patologias.some(p => p.typology_link === t.title)
    );
  });

  typologiesWithPathologies = computed(() => {
    const sys = this.system();
    const filter = this.pathologyFilter();
    if (!sys) return [];

    // Step 1: Efficiently group pathologies by typology using a Map.
    // This part is memoized by the computed signal and only re-runs if `system()` changes.
    const pathologyMap = new Map<string, Pathology[]>();
    for (const pathology of sys.patologias) {
      if (!pathologyMap.has(pathology.typology_link)) {
        pathologyMap.set(pathology.typology_link, []);
      }
      pathologyMap.get(pathology.typology_link)!.push(pathology);
    }

    // Step 2: Map typologies to their pathologies, filtering out those with no associated pathologies.
    const grouped = sys.tipologias
      .map(typology => ({
        typology,
        pathologies: pathologyMap.get(typology.title) || []
      }))
      .filter(item => item.pathologies.length > 0);
      
    // Step 3: Apply the filter if one is active.
    // This part of the computation re-runs when `pathologyFilter()` changes.
    if (filter) {
      return grouped.filter(item => item.typology.title === filter);
    }
    
    return grouped;
  });

  activeSchedule = computed(() => {
    const key = this.activeScheduleKey();
    if (!key) return null;
    return this.system().maintenance_schedules[key] || null;
  });

  modalTitle = computed(() => this.modalData().data?.title || '');

  togglePanel(panel: string): void {
    this.activePanel.update(current => (current === panel ? null : panel));
  }

  openTypologyModal(typology: Typology): void {
    this.modalData.set({ isOpen: true, type: 'typology', data: typology });
  }

  openPathologyModal(pathology: Pathology): void {
    this.modalData.set({ isOpen: true, type: 'pathology', data: pathology });
  }

  closeModal(): void {
    this.modalData.set({ isOpen: false, type: null, data: null });
  }

  showMaintenanceSchedule(typologyTitle: string): void {
    this.activeScheduleKey.update(currentKey => 
      currentKey === typologyTitle ? null : typologyTitle
    );
  }

  setPathologyFilter(typologyTitle: string | null): void {
    this.pathologyFilter.set(typologyTitle);
  }
}