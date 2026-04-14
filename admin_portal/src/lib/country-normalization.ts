export function normalizeCountry(input: string | undefined | null): string {
  if (!input) return "";
  
  const normalized = input.trim().toLowerCase();
  
  if (['almanya', 'deutschland', 'germany', 'de', 'allemagne'].includes(normalized)) return 'Deutschland';
  if (['türkiye', 'turkey', 'tr', 'turkei', 'türkei'].includes(normalized)) return 'Türkiye';
  if (['hollanda', 'nederland', 'netherlands', 'nl', 'holland', 'pays-bas'].includes(normalized)) return 'Nederland';
  if (['belçika', 'belgië', 'belgique', 'belgien', 'belgium', 'be'].includes(normalized)) return 'België'; // We use België as standard
  if (['fransa', 'france', 'fr', 'frankreich'].includes(normalized)) return 'France';
  if (['avusturya', 'österreich', 'austria', 'at', 'autriche'].includes(normalized)) return 'Österreich';
  if (['isviçre', 'schweiz', 'suisse', 'switzerland', 'ch', 'svizzera'].includes(normalized)) return 'Schweiz';
  if (['bulgaristan', 'bulgaria', 'bg', 'българия', 'bulgarien'].includes(normalized)) return 'Bulgaria';
  if (['sırbistan', 'serbia', 'rs', 'srbija', 'србија', 'serbien', 'serbie'].includes(normalized)) return 'Serbia';
  if (['norveç', 'norway', 'norge', 'no', 'norwegen', 'norvège'].includes(normalized)) return 'Norge';
  if (['italya', 'italia', 'italy', 'it', 'italien', 'italie'].includes(normalized)) return 'Italia';
  if (['ispanya', 'españa', 'spain', 'es', 'spanien', 'espagne'].includes(normalized)) return 'España';

  // Capitalize first letter as fallback for any other country
  return input.charAt(0).toUpperCase() + input.slice(1);
}
