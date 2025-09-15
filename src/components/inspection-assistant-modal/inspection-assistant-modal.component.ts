import { Component, ChangeDetectionStrategy, input, output, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { DataService } from '../../services/data.service';
import { UserProfile } from '../../models/user-profile.model';

@Component({
  selector: 'app-inspection-assistant-modal',
  templateUrl: './inspection-assistant-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class InspectionAssistantModalComponent {
  isOpen = input.required<boolean>();
  userProfile = input.required<UserProfile | null>();
  closeModal = output<void>();

  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private dataService = inject(DataService);

  loading = signal(false);
  checklistResult = signal<string | null>(null);
  
  formData = signal({ buildingName: '', address: '', inspectionDate: '' });
  selectedSystems = signal<{[systemId: string]: {[typologyId: string]: boolean}}>({});

  systemOptions = computed(() => {
    const data = this.dataService.getData();
    return Object.keys(data).map(catKey => ({
      id: catKey,
      label: data[catKey].title,
      systems: Object.keys(data[catKey].systems).map(sysKey => ({
        id: sysKey,
        label: data[catKey].systems[sysKey].title,
        typologies: data[catKey].systems[sysKey].tipologias.map((t: any) => ({
          id: t.title.toLowerCase().replace(/ /g, '-'),
          label: t.title
        }))
      }))
    }));
  });
  
  isFormValid = computed(() => {
    const systemsSelected = Object.values(this.selectedSystems()).some(typologies => 
      Object.values(typologies).some(isSelected => isSelected)
    );
    const form = this.formData();
    return form.buildingName.trim() !== '' && form.address.trim() !== '' && form.inspectionDate.trim() !== '' && systemsSelected;
  });

  updateFormData(field: 'buildingName' | 'address' | 'inspectionDate', value: string) {
    this.formData.update(current => ({ ...current, [field]: value }));
  }
  
  handleSystemChange(systemId: string, typologyId: string, isChecked: boolean) {
    this.selectedSystems.update(current => {
      const updated = { ...current };
      if (!updated[systemId]) {
        updated[systemId] = {};
      }
      updated[systemId][typologyId] = isChecked;
      return updated;
    });
  }

  async generateChecklist() {
    if (!this.isFormValid()) {
      this.toastService.show('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }
    
    this.loading.set(true);
    this.checklistResult.set(null);

    const selectedLabels: string[] = [];
    const currentSelection = this.selectedSystems();
    this.systemOptions().forEach(category => {
      category.systems.forEach(system => {
        if (currentSelection[system.id]) {
          system.typologies.forEach(typology => {
            if (currentSelection[system.id][typology.id]) {
              selectedLabels.push(`${system.label}: ${typology.label}`);
            }
          });
        }
      });
    });

    const prompt = `Como um engenheiro de manutenção predial, crie um checklist de vistoria detalhado para os seguintes sistemas e tipologias: ${selectedLabels.join(', ')}. A resposta deve ser APENAS o código de uma tabela HTML (\`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\`) com as colunas: "Item a Verificar", "Status (C/NC/NA)" e "Observações". A coluna "Status" e "Observações" devem estar vazias para preenchimento manual. Agrupe os itens por sistema usando uma linha \`<tr>\` com uma única \`<td>\` com \`colspan="3"\` e estilo para o título do sistema. Não inclua nenhum texto introdutório, conclusões, comentários, markdown \`\`\`html ou qualquer texto fora da tag <table>.`;
    
    try {
      const result = await this.geminiService.generateText(prompt);
      const tableMatch = result.match(/<table[\s\S]*?<\/table>/i);
      const sanitizedResult = tableMatch ? tableMatch[0] : '<table><tr><td>Erro ao gerar o checklist. Tente novamente.</td></tr></table>';
      this.checklistResult.set(sanitizedResult);
      this.toastService.show('Checklist gerado com sucesso!', 'success');
    } catch (err: any) {
      this.toastService.show(err.message || 'Erro ao gerar checklist.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  generatePDF(): void {
    const buildingInfo = this.formData();
    const content = this.checklistResult();
    const profile = this.userProfile();
    
    if (!content || !profile || !profile.letterhead) {
      this.toastService.show('Não foi possível gerar o PDF. Dados do perfil ou do checklist estão faltando.', 'error');
      return;
    }
    const letterhead = profile.letterhead;

    const formattedDate = buildingInfo.inspectionDate 
      ? new Date(buildingInfo.inspectionDate + 'T00:00:00').toLocaleDateString('pt-BR') 
      : 'Não informada';

    const headerHtml = `
      <div class="page-header">
        <div class="header-content ${letterhead.logoPosition === 'right' ? 'logo-right' : ''}">
          ${letterhead.logo ? `<img src="${letterhead.logo}" class="logo" alt="Logo">` : ''}
          <div class="header-text" style="text-align: ${letterhead.headerTextAlign}; font-family: ${letterhead.headerFontFamily}; font-size: ${letterhead.headerFontSize}; color: ${letterhead.headerTextColor};">
            ${letterhead.headerText.replace(/\n/g, '<br>')}
          </div>
        </div>
      </div>`;
    
    const footerHtml = `
      <div class="page-footer" style="text-align: ${letterhead.footerTextAlign}; font-family: ${letterhead.footerFontFamily}; font-size: ${letterhead.footerFontSize}; color: ${letterhead.footerTextColor};">
        ${letterhead.footerText.replace(/\n/g, '<br>')}
      </div>`;

    const signature = `
      <div class="signature">
        <p>_________________________________________</p>
        <p><strong>${profile.fullName}</strong></p>
        <p>${profile.profession}</p>
        ${profile.professionalRegistry ? `<p>Registro: ${profile.professionalRegistry}</p>`: ''}
        ${profile.registrationId ? `<p>Matrícula: ${profile.registrationId}</p>`: ''}
        ${profile.role ? `<p>Função: ${profile.role}</p>`: ''}
      </div>
    `;

    const htmlContent = `
      <html>
        <head>
          <title>Checklist de Vistoria - ${buildingInfo.buildingName}</title>
          <style>
            @page { 
              size: A4; 
              margin: 3cm 2cm 2cm 2cm; /* Top, Sides, Bottom */
            }
            body { 
              margin: 0;
              padding: 0;
              font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              color: #333;
            }
            .page-header, .page-footer {
              position: fixed;
              left: 0;
              right: 0;
              padding-left: 2cm;
              padding-right: 2cm;
              box-sizing: border-box;
              line-height: 1.4;
            }
            .page-header {
              top: -3cm;
              height: 3cm;
              padding-top: 1cm;
              padding-bottom: 0.5cm;
              border-bottom: 1px solid #ddd;
            }
            .header-content {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .header-content.logo-right { flex-direction: row-reverse; }
            .logo { max-height: 1.5cm; max-width: 5cm; flex-shrink: 0; }
            .header-content:not(.logo-right) .logo { margin-right: 1cm; }
            .header-content.logo-right .logo { margin-left: 1cm; }
            .header-text { flex-grow: 1; white-space: pre-wrap; }

            .page-footer {
              bottom: -2cm;
              height: 2cm;
              padding-bottom: 1cm;
              padding-top: 0.5cm;
              border-top: 1px solid #ddd;
            }
            main { page-break-before: auto; }
            h1 { font-size: 20pt; text-align: center; margin-bottom: 1.5cm; font-weight: bold; color: #333;}
            .signature { margin-top: 80px; text-align: center; page-break-inside: avoid;}
            .signature p { text-align: center; margin: 2px 0; }
            .content { margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 20px; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f0f0f0; color: #333; font-weight: bold; }
            td[colspan="3"] { background-color: #e0e0e0; font-weight: bold; }
            .info-header { margin-bottom: 20px; text-align: center; font-size: 11pt; }
            .info-header p { margin: 4px 0; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${footerHtml}
          <main>
            <h1>Checklist de Inspeção Predial</h1>
            <div class="info-header">
                <p><strong>Edificação:</strong> ${buildingInfo.buildingName}</p>
                <p><strong>Endereço:</strong> ${buildingInfo.address}</p>
                <p><strong>Data da Vistoria:</strong> ${formattedDate}</p>
            </div>
            <div class="content">${content}</div>
            <div style="margin-top: 40px;">
                <p><strong>Responsável pela Vistoria:</strong></p>
                <br><br>
                <p>_________________________________________</p>
                <p><strong>${profile.fullName}</strong></p>
            </div>
          </main>
        </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      setTimeout(() => newWindow.print(), 500);
    } else {
      this.toastService.show('Não foi possível abrir a janela de impressão. Desative o bloqueador de pop-ups.', 'error');
    }
  }

  onClose() {
    this.closeModal.emit();
    this.reset();
  }

  reset() {
    this.loading.set(false);
    this.checklistResult.set(null);
    this.formData.set({ buildingName: '', address: '', inspectionDate: '' });
    this.selectedSystems.set({});
  }
}
