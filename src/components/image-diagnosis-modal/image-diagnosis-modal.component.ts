import { Component, ChangeDetectionStrategy, input, output, signal, ViewChild, ElementRef, inject, computed } from '@angular/core';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { UserProfile } from '../../models/user-profile.model';
import { DataService } from '../../services/data.service';
import { Pathology } from '../../models/pathology.model';

@Component({
  selector: 'app-image-diagnosis-modal',
  templateUrl: './image-diagnosis-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageDiagnosisModalComponent {
  isOpen = input.required<boolean>();
  userProfile = input.required<UserProfile | null>();
  closeModal = output<void>();

  @ViewChild('videoElement') videoElement: ElementRef<HTMLVideoElement> | undefined;

  images = signal<{ preview: string; base64: string; mimeType: string }[]>([]);
  diagnosisResult = signal<string | null>(null);

  isCameraOpen = signal(false);
  cameraError = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private toastService = inject(ToastService);
  private dataService = inject(DataService);
  private allData = this.dataService.getData();
  
  readonly MAX_IMAGES = 5;

  // Signals for dropdowns
  categories = signal(Object.keys(this.allData).map(key => ({ key, title: this.allData[key].title })));
  selectedCategoryKey = signal('');

  systems = computed(() => {
    const catKey = this.selectedCategoryKey();
    if (!catKey || !this.allData[catKey]) return [];
    const systemsData = this.allData[catKey].systems;
    return Object.keys(systemsData).map(key => ({ key, title: systemsData[key].title }));
  });
  selectedSystemKey = signal('');

  typologies = computed(() => {
    const catKey = this.selectedCategoryKey();
    const sysKey = this.selectedSystemKey();
    if (!catKey || !sysKey || !this.allData[catKey]?.systems[sysKey]) return [];
    return this.allData[catKey].systems[sysKey].tipologias.map((t: { title: string }) => ({ title: t.title }));
  });
  selectedTypologyTitle = signal('');
  
  isDiagnosisReady = computed(() => this.images().length > 0 && !!this.selectedTypologyTitle());

  allPathologies = signal<Pathology[]>([]);
  relatedPathologies = signal<Pathology[]>([]);

  constructor(public geminiService: GeminiService) {
    this.allPathologies.set(this.extractAllPathologies());
  }

  private extractAllPathologies(): Pathology[] {
    const pathologies: Pathology[] = [];
    const data = this.dataService.getData();
    for (const categoryKey in data) {
        const category = data[categoryKey];
        for (const systemKey in category.systems) {
            const system = category.systems[systemKey];
            if (system.patologias) {
                pathologies.push(...system.patologias);
            }
        }
    }
    return pathologies;
  }
  
  onCategoryChange(event: Event) {
    const newValue = (event.target as HTMLSelectElement).value;
    this.selectedCategoryKey.set(newValue);
    this.selectedSystemKey.set('');
    this.selectedTypologyTitle.set('');
  }

  onSystemChange(event: Event) {
    const newValue = (event.target as HTMLSelectElement).value;
    this.selectedSystemKey.set(newValue);
    this.selectedTypologyTitle.set('');
  }
  
  onTypologyChange(event: Event) {
    const newValue = (event.target as HTMLSelectElement).value;
    this.selectedTypologyTitle.set(newValue);
  }

  onClose() {
    this.closeModal.emit();
    this.reset();
  }
  
  onFileSelected(event: Event): void {
    this.cameraError.set(null);
    this.isCameraOpen.set(false);
    
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files) {
      const remainingSlots = this.MAX_IMAGES - this.images().length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      if (files.length > remainingSlots) {
        this.toastService.show(`Você pode adicionar mais ${remainingSlots} imagem(ns). As demais foram ignoradas.`, 'info');
      }

      for (const file of filesToProcess) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const newImage = {
            preview: result,
            base64: result.split(',')[1],
            mimeType: file.type
          };
          this.images.update(current => [...current, newImage]);
        };
        reader.readAsDataURL(file);
      }
      // Reset file input to allow selecting the same file again
      input.value = '';
    }
  }

  removeImage(indexToRemove: number): void {
    this.images.update(currentImages => currentImages.filter((_, index) => index !== indexToRemove));
  }

  async runDiagnosis() {
    const currentImages = this.images();
    if (currentImages.length > 0) {
      this.diagnosisResult.set(null);
      this.relatedPathologies.set([]);
      
      const cat = this.allData[this.selectedCategoryKey()].title;
      const sys = this.allData[this.selectedCategoryKey()].systems[this.selectedSystemKey()].title;
      const typo = this.selectedTypologyTitle();
      
      const prompt = `Analise a(s) imagem(ns) a seguir de um componente de edificação. O componente analisado pertence à categoria "${cat}", sistema "${sys}", e é uma tipologia de "${typo}". Identifique possíveis patologias (como fissuras, infiltrações, corrosão, etc.), descreva suas possíveis causas, os riscos associados e sugira os próximos passos para diagnóstico e reparo. Formate a resposta de forma clara e organizada em tópicos com HTML (use headings h4, lists ul/li, bold strong).`;
      
      try {
        const imageData = currentImages.map(img => ({ base64: img.base64, mimeType: img.mimeType }));
        const result = await this.geminiService.generateTextWithImages(prompt, imageData);
        const sanitizedResult = result.replace(/```(html)?/gi, '').trim();
        this.diagnosisResult.set(sanitizedResult);
        this.findRelatedPathologies(sanitizedResult);
        this.toastService.show('Diagnóstico gerado com sucesso!', 'success');
      } catch (err: any) {
        this.toastService.show(err.message || 'Erro ao gerar diagnóstico por imagem.', 'error');
      }
    }
  }

  private findRelatedPathologies(htmlContent: string) {
    const pathologies = this.allPathologies();
    const uniquePathologies = new Map<string, Pathology>();

    const textContent = htmlContent.replace(/<[^>]*>/g, ' ');

    for (const pathology of pathologies) {
        const regex = new RegExp(`\\b${pathology.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(textContent)) {
            if (!uniquePathologies.has(pathology.title)) {
                uniquePathologies.set(pathology.title, pathology);
            }
        }
    }

    this.relatedPathologies.set(Array.from(uniquePathologies.values()));
  }

  generatePDF(): void {
    const content = this.diagnosisResult();
    const currentImages = this.images();
    const profile = this.userProfile();

    if (!content || currentImages.length === 0 || !profile || !profile.letterhead) {
      this.toastService.show('Não foi possível gerar o PDF. Dados do perfil ou do diagnóstico estão faltando.', 'error');
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
    
    const imagesHtml = currentImages.map(img => `
      <div class="image-container">
        <img src="${img.preview}" alt="Imagem Analisada">
      </div>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Relatório de Diagnóstico por Imagem</title>
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
            h1, h2, h3, h4, h5 { page-break-after: avoid; color: #333; }
            h1 { font-size: 20pt; text-align: center; margin-bottom: 1.5cm; font-weight: bold; }
            h2 { font-size: 16pt; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 40px; }
            .info-section { 
              margin-bottom: 25px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; background-color: #f8fafc;
              page-break-inside: avoid;
            }
            .info-section p { margin: 5px 0; }
            .signature { margin-top: 80px; text-align: center; page-break-inside: avoid; }
            .signature p { text-align: center; margin: 2px 0; }
            .image-container { text-align: center; margin: 20px 0; page-break-inside: avoid; }
            .image-container img { max-width: 100%; max-height: 15cm; border-radius: 8px; border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${footerHtml}
          <main>
            <h1>Relatório de Diagnóstico por Imagem</h1>
            <div class="info-section">
               <p><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>

            <h2>Imagens Analisadas</h2>
            ${imagesHtml}

            <div style="page-break-before: always;"></div>
            <h2>Análise da Inteligência Artificial</h2>
            <div class="content">${content}</div>
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
      this.toastService.show('Não foi possível abrir a janela de impressão. Desative o bloqueador de pop-ups.', 'error');
    }
  }

  reset(): void {
    this.closeCamera();
    this.images.set([]);
    this.diagnosisResult.set(null);
    this.cameraError.set(null);
    this.relatedPathologies.set([]);
    this.selectedCategoryKey.set('');
    this.selectedSystemKey.set('');
    this.selectedTypologyTitle.set('');
  }

  async openCamera() {
    this.cameraError.set(null);

    if (this.images().length >= this.MAX_IMAGES) {
      this.toastService.show(`Você atingiu o limite de ${this.MAX_IMAGES} imagens.`, 'info');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('A câmera não é suportada por este navegador.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.isCameraOpen.set(true);
      setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
        }
      }, 0);
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.cameraError.set('Permissão para acessar a câmera foi negada.');
      } else {
        this.cameraError.set('Não foi possível acessar a câmera. Verifique se ela não está sendo usada por outro aplicativo.');
      }
    }
  }

  captureImage() {
    if (!this.videoElement || this.images().length >= this.MAX_IMAGES) return;

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      const newImage = {
        preview: dataUrl,
        base64: dataUrl.split(',')[1],
        mimeType: 'image/jpeg'
      };
      this.images.update(current => [...current, newImage]);
    }

    this.closeCamera();
  }

  closeCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.isCameraOpen.set(false);
    this.stream = null;
  }
}