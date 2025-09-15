// src/models/user-profile.model.ts

export interface LetterheadSettings {
  logo: string | null; // base64
  logoPosition: 'left' | 'right';
  
  headerText: string;
  headerFontFamily: string;
  headerFontSize: string; // e.g., '10pt'
  headerTextColor: string; // hex color
  headerTextAlign: 'left' | 'center' | 'right';

  footerText: string;
  footerFontFamily: string;
  footerFontSize: string;
  footerTextColor: string;
  footerTextAlign: 'left' | 'center' | 'right';
}

export interface UserProfile {
  fullName: string;
  profession: 'Arquiteto e Urbanista' | 'Engenheiro Eletricista' | 'Engenheiro Civil' | 'Técnico em Edificações' | 'Assistente Técnico' | 'Engenheiro Mecânico' | '';
  professionalRegistry: string;
  registrationId: string;
  role: string;
  publicAgencyName: string;
  publicAgencyAddress: string;
  publicAgencyCNPJ: string;
  letterhead: LetterheadSettings | null;
}
