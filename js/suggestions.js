import * as db from './db.js';

export async function getSuggestions(limit = 5) {
  const dispensa = await db.getAll('dispensa');
  const spesaItems = await db.getAll('spesa');
  const inLista = new Set(spesaItems.filter(i => !i.completato).map(i => i.nome.toLowerCase()));

  const suggestions = [];

  for (const item of dispensa) {
    if (inLista.has(item.nome.toLowerCase())) continue;

    if (item.quantita !== null && item.quantita <= 0) {
      suggestions.push({
        nome: item.nome,
        motivo: 'Terminato in dispensa',
        urgenza: 3,
        tipo: 'terminato'
      });
      continue;
    }

    if (item.quantita !== null && item.quantita > 0 && item.quantita <= 1) {
      suggestions.push({
        nome: item.nome,
        motivo: 'Quasi finito',
        urgenza: 2,
        tipo: 'scorta_bassa'
      });
      continue;
    }

    if (item.ultimoAcquisto && item.consumoMedio) {
      const lastBuy = new Date(item.ultimoAcquisto);
      const daysSince = Math.floor((Date.now() - lastBuy) / 86400000);
      if (daysSince >= item.consumoMedio * 0.8) {
        suggestions.push({
          nome: item.nome,
          motivo: `Lo compri ogni ~${item.consumoMedio}gg`,
          urgenza: 1,
          tipo: 'pattern'
        });
      }
    }
  }

  const completati = spesaItems
    .filter(i => i.completato && i.dataCompletato)
    .sort((a, b) => new Date(b.dataCompletato) - new Date(a.dataCompletato));

  const frequenze = {};
  for (const item of completati) {
    const nome = item.nome.toLowerCase();
    if (!frequenze[nome]) frequenze[nome] = { nome: item.nome, count: 0, lastBuy: item.dataCompletato };
    frequenze[nome].count++;
  }

  for (const [norm, data] of Object.entries(frequenze)) {
    if (inLista.has(norm)) continue;
    if (suggestions.find(s => s.nome.toLowerCase() === norm)) continue;
    if (data.count >= 3) {
      const daysSince = Math.floor((Date.now() - new Date(data.lastBuy)) / 86400000);
      if (daysSince >= 5) {
        suggestions.push({
          nome: data.nome,
          motivo: `Comprato ${data.count} volte, ultimo ${daysSince}gg fa`,
          urgenza: 0,
          tipo: 'frequente'
        });
      }
    }
  }

  return suggestions
    .sort((a, b) => b.urgenza - a.urgenza)
    .slice(0, limit);
}
