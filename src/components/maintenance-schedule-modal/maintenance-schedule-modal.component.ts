import { Component, ChangeDetectionStrategy, input, output, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { DataService } from '../../services/data.service';
import { UserProfile } from '../../models/user-profile.model';

interface Suggestion {
  typology: string;
  periodicity: string;
  justification: string;
}

@Component({
  selector: 'app-maintenance-schedule-modal',
  templateUrl: './maintenance-schedule-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class MaintenanceScheduleModalComponent {
  isOpen = input.required<boolean>();
  userProfile = input.required<UserProfile | null>();
  closeModal = output<void>();

  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private dataService = inject(DataService);

  loading = signal(false);
  scheduleResult = signal<string | null>(null);
  loadingSuggestions = signal(false);
  suggestionsResult = signal<string | null>(null);

  formData = signal({ buildingName: '', address: '' });
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
    return this.formData().buildingName.trim() !== '' && this.formData().address.trim() !== '' && systemsSelected;
  });

  areSystemsSelected = computed(() => {
    return Object.values(this.selectedSystems()).some(typologies =>
      Object.values(typologies).some(isSelected => isSelected)
    );
  });

  parsedSuggestions = computed(() => {
    const result = this.suggestionsResult();
    if (!result) return [];
    
    try {
      const startIndex = result.indexOf('[');
      const endIndex = result.lastIndexOf(']');
      if (startIndex === -1 || endIndex === -1) {
        console.warn('Nenhum array JSON encontrado na resposta da IA.');
        return [];
      }
      const jsonString = result.substring(startIndex, endIndex + 1);
      const parsedData: unknown = JSON.parse(jsonString);

      if (!Array.isArray(parsedData)) {
        console.error('Os dados analisados não são um array:', parsedData);
        return [];
      }

      // Valida se cada objeto no array possui as propriedades necessárias.
      const suggestions = parsedData.filter((item: any): item is Suggestion => 
        item &&
        typeof item.typology === 'string' &&
        typeof item.periodicity === 'string' &&
        typeof item.justification === 'string'
      );
      
      if (suggestions.length !== parsedData.length) {
        console.warn('Alguns itens no array JSON analisado não correspondem à interface Suggestion.');
      }

      return suggestions;
    } catch (error) {
      console.error('Falha ao analisar o JSON de sugestões:', error, 'Resposta bruta:', result);
      return [];
    }
  });

  updateFormData(field: 'buildingName' | 'address', value: string) {
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

  async generatePeriodicitySuggestions() {
    if (!this.areSystemsSelected()) {
      this.toastService.show('Por favor, selecione pelo menos um sistema.', 'error');
      return;
    }

    this.loadingSuggestions.set(true);
    this.suggestionsResult.set(null);

    const selectedTypologiesData: string[] = [];
    const allData = this.dataService.getData();
    const currentSelection = this.selectedSystems();

    this.systemOptions().forEach(category => {
      category.systems.forEach(system => {
        if (currentSelection[system.id]) {
          system.typologies.forEach(typology => {
            if (currentSelection[system.id][typology.id]) {
              const schedules = allData[category.id].systems[system.id].maintenance_schedules[typology.label];
              if (schedules) {
                let typologyInfo = `Tipologia: ${typology.label}\n`;
                typologyInfo += schedules.map(s => `  - Atividade: ${s.activity}, Periodicidade: ${s.periodicity}`).join('\n');
                selectedTypologiesData.push(typologyInfo);
              }
            }
          });
        }
      });
    });
    
    if (selectedTypologiesData.length === 0) {
      this.toastService.show('Não há dados de manutenção para as tipologias selecionadas.', 'info');
      this.loadingSuggestions.set(false);
      return;
    }

    const prompt = `Como um especialista em engenharia de manutenção predial, analise os seguintes planos de manutenção para as tipologias selecionadas. Para cada tipologia, sugira uma periodicidade consolidada e ideal para la manutenção geral, justificando brevemente sua resposta com base nas atividades mais frequentes e críticas. A resposta deve ser um array JSON, onde cada objeto contém as chaves "typology" (string), "periodicity" (string), e "justification" (string). Forneça APENAS o array JSON, sem nenhum texto adicional, comentários ou formatação markdown (sem \`\`\`json). Exemplo de formato de resposta: [{"typology": "Nome da Tipologia", "periodicity": "Periodicidade Sugerida", "justification": "Justificativa."}]
\n\nDados:\n\n${selectedTypologiesData.join('\n\n')}`;
    
    try {
      const result = await this.geminiService.generateText(prompt);
      this.suggestionsResult.set(result);
      this.toastService.show('Sugestões geradas com sucesso!', 'success');
    } catch (err: any) {
      this.toastService.show(err.message || 'Erro ao gerar sugestões.', 'error');
    } finally {
      this.loadingSuggestions.set(false);
    }
  }

  async generateMaintenanceSchedule() {
    if (!this.isFormValid()) {
      this.toastService.show('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    this.loading.set(true);
    this.scheduleResult.set(null);

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

    const prompt = `Crie um plano de manutenção (preventiva e preditiva) para os sistemas: "${selectedLabels.join(', ')}". A resposta deve ser APENAS o código de uma tabela HTML (\`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\`) com as colunas: "Sistema", "Atividade", "Periodicidade" e "Recomendações". Agrupe as atividades por sistema. Não inclua nenhum texto introdutório, conclusões, comentários, markdown \`\`\`html ou qualquer texto fora da tag <table>.`;

    try {
      const result = await this.geminiService.generateText(prompt);
      const tableMatch = result.match(/<table[\s\S]*?<\/table>/i);
      const sanitizedResult = tableMatch ? tableMatch[0] : '<table><tr><td>Erro ao gerar a tabela. Tente novamente.</td></tr></table>';
      this.scheduleResult.set(sanitizedResult);
      this.toastService.show('Cronograma gerado com sucesso!', 'success');
    } catch (err: any) {
      this.toastService.show(err.message || 'Erro ao gerar cronograma.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  generatePDF(): void {
    const content = this.scheduleResult();
    const profile = this.userProfile();
    const buildingInfo = this.formData();

    if (!content || !profile || !profile.letterhead) {
      this.toastService.show('Não foi possível gerar o PDF. Dados do perfil ou do cronograma estão faltando.', 'error');
      return;
    }
    const letterhead = profile.letterhead;

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
          <title>Cronograma de Manutenção - ${buildingInfo.buildingName}</title>
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
            h1 { font-size: 20pt; text-align: center; margin-bottom: 1.5cm; font-weight: bold; color: #1e3a8a; page-break-after: avoid; }
            table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 20px; page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #dbeafe; color: #1e3a8a; font-weight: bold; }
            .info-section { margin: 25px 0; border: 1px solid #ccc; padding: 15px; border-radius: 8px; background-color: #f8fafc; page-break-inside: avoid; }
            .info-section p { margin: 5px 0; }
            .signature { margin-top: 80px; text-align: center; page-break-inside: avoid; }
            .signature p { text-align: center; margin: 2px 0; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${footerHtml}
          <main>
            <h1>Cronograma de Manutenção Predial</h1>
            <div class="info-section">
              <p><strong>Edifício:</strong> ${buildingInfo.buildingName}</p>
              <p><strong>Endereço:</strong> ${buildingInfo.address}</p>
              <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            ${content}
            ${signature}
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
      this.toastService.show('Não foi possível abrir a janela de impressão.', 'error');
    }
  }

  onClose() {
    this.closeModal.emit();
    this.reset();
  }

  reset() {
    this.loading.set(false);
    this.scheduleResult.set(null);
    this.formData.set({ buildingName: '', address: '' });
    this.selectedSystems.set({});
    this.suggestionsResult.set(null);
    this.loadingSuggestions.set(false);
  }
}
