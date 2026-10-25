import type { SpotifyImport } from '../types';

/** Parse un CSV (guillemets, virgules ou points-virgules). */
function parseCsv(text: string) {
  const sep = (text.split('\n')[0].match(/;/g)?.length || 0) > (text.split('\n')[0].match(/,/g)?.length || 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Lit un export Exportify (ou tout CSV avec des colonnes titre / artiste). */
export function csvToImport(text: string, fileName: string): SpotifyImport {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('Fichier CSV vide');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const find = (re: RegExp) => head.findIndex((h) => re.test(h));
  const ti = find(/^(track name|track|title|titre|name|nom)$/) >= 0 ? find(/^(track name|track|title|titre|name|nom)$/) : find(/track|title|titre/);
  const ai = find(/artist/);
  const di = find(/duration|durée/);
  if (ti < 0 || ai < 0) throw new Error('Colonnes « titre » et « artiste » introuvables dans le CSV');
  const tracks = rows
    .slice(1)
    .map((r) => {
      const raw = Number(r[di] || 0);
      return {
        title: (r[ti] || '').trim(),
        artist: (r[ai] || '').replace(/\\,/g, ',').replace(/;/g, ', ').trim(),
        duration: raw > 10000 ? Math.round(raw / 1000) : Math.round(raw),
      };
    })
    .filter((t) => t.title);
  return {
    kind: 'playlist',
    id: fileName,
    name: fileName.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim() || 'Playlist importée',
    owner: '',
    cover: '',
    tracks,
    via: 'csv',
  };
}
