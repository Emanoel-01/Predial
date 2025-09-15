import { Component, ChangeDetectionStrategy, input, output, signal, effect, computed } from '@angular/core';
import { UserProfile, LetterheadSettings } from '../../models/user-profile.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-profile-modal',
  templateUrl: './user-profile-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class UserProfileModalComponent {
  isOpen = input.required<boolean>();
  userProfile = input.required<UserProfile | null>();
  profileUpdate = output<UserProfile>();
  closeModal = output<void>();

  editableProfile = signal<UserProfile>({
    fullName: '', profession: '', professionalRegistry: '', registrationId: '', role: '',
    publicAgencyName: '', publicAgencyAddress: '', publicAgencyCNPJ: '',
    letterhead: { 
      logo: null, logoPosition: 'left',
      headerText: '', headerFontFamily: 'Helvetica, sans-serif', headerFontSize: '10pt', headerTextColor: '#333333', headerTextAlign: 'right',
      footerText: '', footerFontFamily: 'Helvetica, sans-serif', footerFontSize: '9pt', footerTextColor: '#666666', footerTextAlign: 'center'
    }
  });
  
  touched = signal<{ [key: string]: boolean }>({});
  activeTab = signal<'pessoal' | 'orgao' | 'timbrado'>('pessoal');

  professions: UserProfile['profession'][] = [
    'Arquiteto e Urbanista', 'Engenheiro Eletricista', 'Engenheiro Civil',
    'Técnico em Edificações', 'Assistente Técnico', 'Engenheiro Mecânico'
  ];
  
  headerTextOptions = signal<string[]>([
    'Relatório Técnico de Manutenção Predial',
    'Laudo de Vistoria Técnica',
    'Parecer Técnico de Engenharia',
    'Relatório Fotográfico de Anomalias',
    'Checklist de Inspeção Predial'
  ]);

  fontFamilies = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Times New Roman', value: "'Times New Roman', serif" },
    { label: 'Courier New', value: "'Courier New', monospace" },
    { label: 'Verdana', value: 'Verdana, sans-serif' }
  ];
  fontSizes = ['8pt','9pt', '10pt', '11pt', '12pt', '13pt', '14pt'];

  isCnpjValid = computed(() => {
    const cnpj = this.editableProfile().publicAgencyCNPJ;
    return cnpj === '' || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cnpj);
  });
  
  isFormValid = computed(() => {
    const profile = this.editableProfile();
    return (
      profile.fullName.trim() !== '' &&
      profile.profession !== '' &&
      profile.publicAgencyName.trim() !== '' &&
      profile.publicAgencyAddress.trim() !== '' &&
      this.isCnpjValid()
    );
  });

  formattedHeaderText = computed(() => {
    return this.editableProfile().letterhead!.headerText.replace(/\n/g, '<br>');
  });

  formattedFooterText = computed(() => {
    return this.editableProfile().letterhead!.footerText.replace(/\n/g, '<br>');
  });

  constructor() {
    effect(() => {
      const profile = this.userProfile();
      const defaultLetterhead: LetterheadSettings = {
        logo: null,
        logoPosition: 'left',
        headerText: this.headerTextOptions()[0],
        headerFontFamily: 'Helvetica, sans-serif',
        headerFontSize: '10pt',
        headerTextColor: '#333333',
        headerTextAlign: 'right',
        footerText: 'Gerado pelo Gestor Predial 4.0 | Desenvolvido por Emanoel Amorim',
        footerFontFamily: 'Helvetica, sans-serif',
        footerFontSize: '9pt',
        footerTextColor: '#666666',
        footerTextAlign: 'center',
      };

      if (profile) {
        const newProfile = JSON.parse(JSON.stringify(profile));
        newProfile.letterhead = {
          ...defaultLetterhead,
          ...(newProfile.letterhead || {})
        };
        // Ensure the header text is one of the available options
        if (!this.headerTextOptions().includes(newProfile.letterhead.headerText)) {
          newProfile.letterhead.headerText = this.headerTextOptions()[0];
        }
        this.editableProfile.set(newProfile);
      } else {
        this.editableProfile.set({
          fullName: '', profession: '', professionalRegistry: '', registrationId: '', role: '',
          publicAgencyName: '', publicAgencyAddress: '', publicAgencyCNPJ: '',
          letterhead: defaultLetterhead
        });
      }
      
      this.touched.set({});
      this.activeTab.set('pessoal');
    });
  }

  setActiveTab(tab: 'pessoal' | 'orgao' | 'timbrado') {
    this.activeTab.set(tab);
  }

  onClose() {
    this.closeModal.emit();
  }

  onSave() {
    this.touched.set({
      fullName: true, profession: true, publicAgencyName: true, publicAgencyAddress: true, publicAgencyCNPJ: true,
    });

    if (this.isFormValid()) {
      this.profileUpdate.emit(this.editableProfile());
      this.onClose();
    }
  }

  updateProfile<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    this.editableProfile.update(p => ({ ...p, [key]: value }));
  }
  
  updateLetterhead<K extends keyof LetterheadSettings>(key: K, value: LetterheadSettings[K]) {
    this.editableProfile.update(p => {
      const newProfile = { ...p };
      if (newProfile.letterhead) {
        newProfile.letterhead = { ...newProfile.letterhead, [key]: value };
      }
      return newProfile;
    });
  }
  
  markAsTouched(field: keyof UserProfile) {
    this.touched.update(t => ({...t, [field]: true }));
  }

  formatCnpj(event: Event) {
    let value = (event.target as HTMLInputElement).value;
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/, "$1.$2");
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
    value = value.replace(/(\d{4})(\d)/, "$1-$2");
    this.updateProfile('publicAgencyCNPJ', value.substring(0, 18));
    this.markAsTouched('publicAgencyCNPJ');
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          this.updateLetterhead('logo', result);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Por favor, selecione um arquivo .jpg ou .png');
      }
    }
  }

  removeLogo() {
    this.updateLetterhead('logo', null);
    const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}
