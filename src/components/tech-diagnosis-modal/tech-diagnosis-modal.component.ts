import { Component, ChangeDetectionStrategy, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { UserProfile } from '../../models/user-profile.model';

@Component({
  selector: 'app-tech-diagnosis-modal',
  templateUrl: './tech-diagnosis-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class TechDiagnosisModalComponent {
  isOpen = input.required<boolean>();
  userProfile = input.required<UserProfile | null>();
  closeModal = output<void>();

  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);

  symptomDescription = signal('');
  diagnosticSuggestions = signal<string | null>(null);
  correctionPlan = signal<string | null>(null);
  
  loadingSuggestions = signal(false);
  loadingCorrection = signal(false);

  async getDiagnosticSuggestions() {
    if (!this.symptomDescription().trim()) {
      this.toastService.show('Por favor, descreva os sintomas observados.', 'error');
      return;
    }
    
    this.loadingSuggestions.set(true);
    this.diagnosticSuggestions.set(null);
    this.correctionPlan.set(null);

    const prompt = `Com base nos seguintes sintomas em uma edificação: "${this.symptomDescription()}", gere uma análise técnica em HTML. A análise deve conter: 1. Uma lista de possíveis causas prováveis. 2. As tecnologias de diagnóstico 4.0 mais indicadas para investigar o problema, explicando o porquê de cada одна. Use headings (h4, h5) e listas (ul, li).`;
    
    try {
      const result = await this.geminiService.generateText(prompt);
      const sanitizedResult = result.replace(/```(html)?/gi, '').trim();
      this.diagnosticSuggestions.set(sanitizedResult);
      this.toastService.show('Análise de diagnóstico gerada!', 'success');
    } catch (err: any) {
      this.toastService.show(err.message || 'Erro ao gerar diagnóstico.', 'error');
    } finally {
      this.loadingSuggestions.set(false);
    }
  }

  async getCorrectionPlan() {
    if (!this.diagnosticSuggestions()) {
      this.toastService.show('Gere a análise de diagnóstico primeiro.', 'info');
      return;
    }

    this.loadingCorrection.set(true);
    this.correctionPlan.set(null);

    const prompt = `Com base na seguinte descrição de sintomas: "${this.symptomDescription()}" e na análise de diagnóstico: "${this.diagnosticSuggestions()}", crie um plano de ação e correção em HTML. O plano deve detalhar os passos recomendados para a correção da patologia, incluindo materiais e técnicas a serem empregadas. Use headings (h4, h5) e listas (ul, li).`;

    try {
      const result = await this.geminiService.generateText(prompt);
      const sanitizedResult = result.replace(/```(html)?/gi, '').trim();
      this.correctionPlan.set(sanitizedResult);
      this.toastService.show('Plano de correção gerado!', 'success');
    } catch (err: any) {
      this.toastService.show(err.message || 'Erro ao gerar plano de correção.', 'error');
    } finally {
      this.loadingCorrection.set(false);
    }
  }

  generatePDF(): void {
    const suggestions = this.diagnosticSuggestions();
    const plan = this.correctionPlan();
    const profile = this.userProfile();

    if (!suggestions || !profile || !profile.letterhead) {
       this.toastService.show('Não foi possível gerar o PDF. Dados do perfil ou do diagnóstico estão faltando.', 'error');
      return;
    }
    const letterhead = profile.letterhead;
    
    const content = suggestions + (plan ? `<div style="page-break-before: always;"></div>${plan}` : '');

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
          <title>Relatório de Diagnóstico e Correção</title>
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
            h1, h2, h3, h4, h5 { page-break-after: avoid; color: #1e3a8a; }
            .info-section, .signature { page-break-inside: avoid; }
            h1 { font-size: 20pt; text-align: center; margin-bottom: 1.5cm; font-weight: bold; }
            h2 { font-size: 16pt; border-bottom: 1px solid #93c5fd; padding-bottom: 5px; }
            .info-section { 
              margin-bottom: 25px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; background-color: #f8fafc;
            }
            .info-section p { margin: 5px 0; }
            .signature { margin-top: 80px; text-align: center; }
            .signature p { text-align: center; margin: 2px 0; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${footerHtml}
          <main>
            <h1>Relatório de Diagnóstico e Correção</h1>
            <div class="info-section">
               <p><strong>Sintomas Observados:</strong> ${this.symptomDescription()}</p>
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
    this.symptomDescription.set('');
    this.diagnosticSuggestions.set(null);
    this.correctionPlan.set(null);
    this.loadingSuggestions.set(false);
    this.loadingCorrection.set(false);
  }
}
