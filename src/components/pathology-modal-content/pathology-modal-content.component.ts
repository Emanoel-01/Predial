import { Component, ChangeDetectionStrategy, input, signal, computed, inject } from '@angular/core';
import { Pathology } from '../../models/pathology.model';
import { UserProfile } from '../../models/user-profile.model';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-pathology-modal-content',
  templateUrl: './pathology-modal-content.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class PathologyModalContentComponent {
  pathology = input.required<Pathology>();
  userProfile = input.required<UserProfile | null>();

  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);

  actionPlan = signal<string | null>(null);
  budget = signal<string | null>(null);
  loadingPlan = signal(false);
  loadingBudget = signal(false);

  async generateActionPlan() {
    this.loadingPlan.set(true);
    this.actionPlan.set(null);
    this.budget.set(null);

    const p = this.pathology();
    const prompt = `Crie um plano de ação detalhado em HTML para corrigir a patologia "${p.title}", cujos sintomas são "${p.sintomas}". O plano deve incluir: 1. Etapas de preparação da área. 2. Procedimentos de correção. 3. Materiais recomendados. 4. Cuidados de segurança. Use headings (h4) e listas (ol, li).`;

    try {
      const result = await this.geminiService.generateText(prompt);
      const sanitizedResult = result.replace(/```(html)?/gi, '').trim();
      this.actionPlan.set(sanitizedResult);
      this.toastService.show('Plano de Ação gerado com sucesso!', 'success');
    } catch (error: any) {
      this.toastService.show(error.message || 'Erro ao gerar plano de ação.', 'error');
    } finally {
      this.loadingPlan.set(false);
    }
  }

  async generatePreliminaryBudget() {
    if (!this.actionPlan()) return;
    this.loadingBudget.set(true);
    this.budget.set(null);

    const p = this.pathology();
    const plan = this.actionPlan();
    const prompt = `Com base no plano de ação para a patologia "${p.title}": "${plan}", crie um orçamento preliminar simplificado em formato de tabela HTML (\`<table>\`). A resposta deve ser APENAS o código da tabela. A tabela deve ter as colunas "Item", "Unidade", "Quantidade (Estimada)", "Custo Unitário (Estimado)" e "Custo Total (Estimado)". Inclua itens para material, mão de obra e equipamentos. Adicione uma nota de rodapé informando que os valores são estimativas e devem ser confirmados com cotações de mercado.`;

    try {
      const result = await this.geminiService.generateText(prompt);
      const tableMatch = result.match(/<table[\s\S]*?<\/table>/i);
      const sanitizedResult = tableMatch ? tableMatch[0] : '<p>Erro ao gerar o orçamento. Tente novamente.</p>';
      this.budget.set(sanitizedResult);
      this.toastService.show('Orçamento gerado com sucesso!', 'success');
    } catch (error: any) {
      this.toastService.show(error.message || 'Erro ao gerar orçamento.', 'error');
    } finally {
      this.loadingBudget.set(false);
    }
  }
  
  generateReportPDF() {
    if (!this.actionPlan()) {
      this.toastService.show('É necessário gerar o Plano de Ação primeiro.', 'error');
      return;
    }

    let reportContent = `<h2>Plano de Ação</h2>${this.actionPlan()!}`;

    if (this.budget()) {
      reportContent += `<div style="page-break-before: always;"></div><h2>Orçamento Estimativo</h2>${this.budget()}`;
    }

    this.generatePDF(`Relatório de Patologia - ${this.pathology().title}`, reportContent);
  }

  generatePDF(title: string, content: string | null) {
    if (!content) return;
    const p = this.pathology();
    const profile = this.userProfile();

    if (!profile || !profile.letterhead) {
      this.toastService.show('Não foi possível gerar o PDF. Dados do perfil estão faltando.', 'error');
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
          <title>${title}</title>
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
            h1, h2, h3, h4, h5 { color: #333333; page-break-after: avoid; }
            h1 { font-size: 20pt; text-align: center; margin-bottom: 1.5cm; font-weight: bold; }
            h2 { font-size: 16pt; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            p, li { text-align: justify; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 20px; page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; color: #333333; font-weight: bold; }
            .info-section { margin-bottom: 25px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; background-color: #f8fafc; page-break-inside: avoid; }
            .info-section h2 { margin-top: 0; border-bottom: none; }
            .signature { margin-top: 80px; text-align: center; page-break-inside: avoid; }
            .signature p { text-align: center; margin: 2px 0; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${footerHtml}
          <main>
            <h1>${title}</h1>
            <div class="info-section">
              <h2>Diagnóstico da Patologia</h2>
              <p><strong>Patologia:</strong> ${p.title}</p>
              <p><strong>Sintomas Observados:</strong> ${p.sintomas}</p>
              <p><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
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
}
