import { Component, ChangeDetectionStrategy, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataService } from './services/data.service';
import { UserProfile } from './models/user-profile.model';
import { Notification } from './models/notification.model';

import { VisaoGeralComponent } from './components/visao-geral/visao-geral.component';
import { SystemCategoryComponent } from './components/system-category/system-category.component';
import { ImageDiagnosisModalComponent } from './components/image-diagnosis-modal/image-diagnosis-modal.component';
import { InspectionAssistantModalComponent } from './components/inspection-assistant-modal/inspection-assistant-modal.component';
import { TechDiagnosisModalComponent } from './components/tech-diagnosis-modal/tech-diagnosis-modal.component';
import { MaintenanceScheduleModalComponent } from './components/maintenance-schedule-modal/maintenance-schedule-modal.component';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';
import { ToastComponent } from './components/toast/toast.component';
import { ChatAssistantModalComponent } from './components/chat-assistant-modal/chat-assistant-modal.component';
import { NotificationsModalComponent } from './components/notifications-modal/notifications-modal.component';
import { ToastService } from './services/toast.service';
import { LoginComponent } from './components/login/login.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VisaoGeralComponent,
    SystemCategoryComponent,
    ImageDiagnosisModalComponent,
    InspectionAssistantModalComponent,
    TechDiagnosisModalComponent,
    MaintenanceScheduleModalComponent,
    UserProfileModalComponent,
    ToastComponent,
    ChatAssistantModalComponent,
    NotificationsModalComponent,
    LoginComponent,
  ],
})
export class AppComponent {
  private dataService = inject(DataService);
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);

  isLoggedIn = signal(false);
  activeView = signal('visao-geral');
  isSidebarOpen = signal(false);
  
  userProfile = signal<UserProfile>({
    fullName: 'Emanoel Amorim',
    profession: 'Arquiteto e Urbanista',
    professionalRegistry: '',
    registrationId: '',
    role: '',
    publicAgencyName: 'Amorim Arquitetura',
    publicAgencyAddress: '',
    publicAgencyCNPJ: '',
    letterhead: {
      logo: null,
      logoPosition: 'left',
      headerText: 'Relatório Técnico de Manutenção Predial',
      headerFontFamily: 'Helvetica, sans-serif',
      headerFontSize: '10pt',
      headerTextColor: '#333333',
      headerTextAlign: 'right',
      footerText: 'Gerado pelo Gestor Predial 4.0 | Desenvolvido por Emanoel Amorim',
      footerFontFamily: 'Helvetica, sans-serif',
      footerFontSize: '9pt',
      footerTextColor: '#666666',
      footerTextAlign: 'center'
    },
  });

  notifications = signal<Notification[]>([
    {
      id: 1,
      icon: '🚀',
      title: 'Nova Ferramenta: Diagnóstico por Imagem!',
      date: '10 de Setembro, 2025',
      content: 'Análise patologias de forma instantânea enviando uma foto. Nossa IA identifica problemas, sugere causas e recomenda ações. Experimente agora na tela principal!',
      read: false,
    },
    {
      id: 2,
      icon: '🔧',
      title: 'Atualização na Base de Conhecimento',
      date: '05 de Setembro, 2025',
      content: 'Adicionamos 25 novas patologias comuns em sistemas de impermeabilização e coberturas. A base de dados está mais completa para auxiliar em seus diagnósticos.',
      read: false,
    },
    {
      id: 3,
      icon: '📢',
      title: 'Bem-vindo ao Gestor Predial 4.0',
      date: '01 de Setembro, 2025',
      content: 'Estamos felizes em tê-lo a bordo. Explore nossas ferramentas de IA para otimizar sua rotina de manutenção predial. Qualquer dúvida, entre em contato com o suporte.',
      read: true,
    },
  ]);
  
  hasUnreadNotifications = computed(() => this.notifications().some(n => !n.read));
  
  userName = computed(() => this.userProfile()?.fullName.split(' ')[0] || '');

  isDiagnosisModalOpen = signal(false);
  isInspectionModalOpen = signal(false);
  isTechDiagnosisModalOpen = signal(false);
  isMaintenanceScheduleModalOpen = signal(false);
  isProfileModalOpen = signal(false);
  isChatModalOpen = signal(false);
  isNotificationsModalOpen = signal(false);

  navItems = [
    { id: 'visao-geral', label: 'Visão Geral' },
    { id: 'estrutura', label: 'Estrutura & Envoltória' },
    { id: 'instalacoes', label: 'Instalações' },
    { id: 'seguranca', label: 'Segurança & Transporte' },
    { id: 'externas', label: 'Áreas Externas' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      if (window.innerWidth >= 768) {
        this.isSidebarOpen.set(true);
      }
    }
  }

  handleLogin(): void {
    this.isLoggedIn.set(true);
  }

  setActiveView(view: string) {
    this.activeView.set(view);
    if (isPlatformBrowser(this.platformId) && window.innerWidth < 768) {
        this.isSidebarOpen.set(false);
    }
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onProfileUpdate(profile: UserProfile) {
    this.userProfile.set(profile);
    this.isProfileModalOpen.set(false);
  }

  logout() {
    this.isLoggedIn.set(false);
    this.toastService.show('Você saiu da sua conta.', 'info');
  }

  handleOpenTool(tool: string): void {
    switch (tool) {
      case 'imageDiagnosis': this.isDiagnosisModalOpen.set(true); break;
      case 'inspection': this.isInspectionModalOpen.set(true); break;
      case 'techDiagnosis': this.isTechDiagnosisModalOpen.set(true); break;
      case 'maintenanceSchedule': this.isMaintenanceScheduleModalOpen.set(true); break;
      case 'chat': this.isChatModalOpen.set(true); break;
      case 'profile': this.isProfileModalOpen.set(true); break;
    }
  }
  
  markNotificationAsRead(id: number) {
    this.notifications.update(notes => 
      notes.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }
}
