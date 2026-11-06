/* ========================= Esportazione ========================= */
// Etichetta ID3 versione 2.3 (la più compatibile): titolo, autore, album, anno, traccia, commento, copertina
function id3Tag(meta) {
  const frames = [], te = new TextEncoder();
  const utf16 = s => { const b = new Uint8Array(2 + s.length * 2); b[0] = 0xFF; b[1] = 0xFE; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[2 + 2 * i] = c & 255; b[3 + 2 * i] = c >> 8; } return b; };
  const cat = arrs => { const n = arrs.reduce((a, b) => a + b.length, 0), o = new Uint8Array(n); let p = 0; arrs.forEach(a => { o.set(a, p); p += a.length; }); return o; };
  const frame = (id, body) => { const h = new Uint8Array(10); for (let i = 0; i < 4; i++) h[i] = id.charCodeAt(i); const n = body.length; h[4] = n >>> 24; h[5] = (n >>> 16) & 255; h[6] = (n >>> 8) & 255; h[7] = n & 255; frames.push(h, body); };
  const text = (id, v) => { if (v != null && String(v).trim()) frame(id, cat([new Uint8Array([1]), utf16(String(v).trim())])); };
  text('TIT2', meta.title); text('TPE1', meta.artist); text('TALB', meta.album); text('TYER', meta.year); text('TRCK', meta.track);
  text('TSSE', APP_NAME + ', codifica lamejs');
  if (meta.comment && meta.comment.trim()) frame('COMM', cat([new Uint8Array([1]), te.encode('ita'), utf16(''), new Uint8Array([0, 0]), utf16(meta.comment.trim())]));
  if (meta.cover && meta.cover.length) frame('APIC', cat([new Uint8Array([0]), te.encode('image/jpeg'), new Uint8Array([0, 3, 0]), meta.cover]));
  const pad = 256, body = cat(frames.concat([new Uint8Array(pad)])), n = body.length;
  const hdr = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, (n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
  return cat([hdr, body]);
}
async function encodeMp3(chs, sr, kbps, onProg) {
  if (typeof lamejs === 'undefined') throw new Error('Il codificatore MP3 non è disponibile.');
  const nc = chs.length, enc = new lamejs.Mp3Encoder(nc, sr, kbps), n = chs[0].length, bs = 1152 * 20;
  const bufs = chs.map(() => new Int16Array(bs)), out = [];
  let seed = 4321; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0, c = 0; i < n; i += bs, c++) {
    const m = Math.min(bs, n - i);
    for (let ch = 0; ch < nc; ch++) { const src = chs[ch], dst = bufs[ch]; for (let j = 0; j < m; j++) { let q = Math.round(clamp(src[i + j], -1, 1) * 32767 + rnd() - rnd()); dst[j] = q < -32768 ? -32768 : q > 32767 ? 32767 : q; } }
    const d = nc === 1 ? enc.encodeBuffer(bufs[0].subarray(0, m)) : enc.encodeBuffer(bufs[0].subarray(0, m), bufs[1].subarray(0, m));
    if (d.length) out.push(new Uint8Array(d));
    if ((c & 15) === 0) { onProg(i / n); await yieldUI(); }
  }
  const f = enc.flush(); if (f.length) out.push(new Uint8Array(f));
  return out;
}
// Volume finale e limitatore sui picchi veri. Restituisce la curva di guadagno complessiva applicata a chs,
// così le tracce separate ricevono esattamente lo stesso trattamento del mix.
async function masterChain(chs, sr) {
  const n = chs[0].length, C = new Float32Array(n).fill(1);
  const mul = g => { for (const c of chs) for (let i = 0; i < n; i++) c[i] *= g; for (let i = 0; i < n; i++) C[i] *= g; };
  busy(true, 'Misura del volume…', 0.36); await yieldUI();
  const before = lufs(chs, true, sr);
  if (P.expNorm && before > -90) mul(dbToGain(P.expTarget - before));
  await limitTruePeak(chs, P.expCeil, progress('Controllo dei picchi…', 0.4, 0.5));
  for (let i = 0; i < n; i++) C[i] *= chs.limitGain[i];
  // il limitatore toglie un po' di volume: si corregge e si limita di nuovo, fino a due volte
  for (let pass = 0; P.expNorm && pass < 2; pass++) {
    const l = lufs(chs, true, sr), d = P.expTarget - l;
    if (l < -90 || Math.abs(d) < 0.05) break;
    mul(dbToGain(d));
    await limitTruePeak(chs, P.expCeil, progress('Rifinitura del volume…', 0.5 + pass * 0.05, 0.55 + pass * 0.05));
    for (let i = 0; i < n; i++) C[i] *= chs.limitGain[i];
  }
  return C;
}

/* ---------- tracce separate ---------- */
// Un WAV per traccia (voce, musica, effetti), stessa durata, allineati dall'inizio: sommati danno il mix esportato.
async function doStems() {
  const lay = layout(); if (!lay.total) return;
  if (S.playing) stopPlayback();
  let [a, b] = [0, lay.total];
  if (P.expSelOnly) { if (!S.sel) { toast('Hai scelto di esportare solo la selezione, ma non c’è nessuna selezione.'); return; } [a, b] = S.sel; }
  const which = (P.expWhich === 'proc' && S.procActive) ? 'proc' : 'orig', n = b - a;
  const kinds = [];
  if (S.vlen) kinds.push(['voice', 'voce']); if (S.musicId) kinds.push(['music', 'musica']); if (S.fx.length) kinds.push(['fx', 'effetti']);
  try {
    if (P.vadMode === 'ai' && S.musicId) await ensureVad();
    const curves = S.musicId ? musicCurves(which) : null, parts = {}, step = SR * 10;
    kinds.forEach(([k]) => { parts[k] = [new Float32Array(n), new Float32Array(n)]; });
    for (let t = 0; t < n; t += step) {
      const m = Math.min(step, n - t);
      for (const [k] of kinds) { const [l, r] = renderMix(a + t, m, which, curves, k); parts[k][0].set(l, t); parts[k][1].set(r, t); }
      busy(true, 'Preparazione delle tracce…', 0.3 * t / n); await yieldUI();
    }
    const sr = +P.expSr;
    if (sr !== SR) { busy(true, 'Conversione a ' + fmtNum(sr / 1000, 1) + ' kHz…', 0.32); await yieldUI(); for (const [k] of kinds) parts[k] = await resampleChs(parts[k], SR, sr); }
    // il mix è la somma delle tracce: su di esso si calcolano volume finale e limitatore
    const len = parts[kinds[0][0]][0].length, mix = [new Float32Array(len), new Float32Array(len)];
    for (const [k] of kinds) for (let c = 0; c < 2; c++) { const s = parts[k][c], d = mix[c]; for (let i = 0; i < len; i++) d[i] += s[i]; }
    const C = await masterChain(mix, sr);
    busy(true, 'Scrittura dei file…', 0.8); await yieldUI();
    const base = fileBase('voce'), entries = [];
    for (const [k, nome] of kinds) {
      const chs = k === 'voice' ? [parts[k][0]] : parts[k];       // la voce è mono, musica ed effetti stereo
      for (const ch of chs) for (let i = 0; i < len; i++) ch[i] *= C[i];
      const ab = encodeWav(chs, +P.expBits, sr, { title: (META.title ? META.title + ', ' : '') + nome, artist: META.artist, album: META.album, year: META.year });
      entries.push({ name: base + '_' + nome + '.wav', data: new Uint8Array(ab), nome, ch: chs.length });
    }
    busy(false);
    showStems(entries, base, len / sr);
  } catch (e) {
    busy(false);
    $('#exportStatus').textContent = 'Tracce separate non riuscite' + (e && e.message ? ': ' + e.message : '.');
    toast('Tracce separate non riuscite. Se il capitolo è molto lungo, prova con “Solo la selezione”.');
  }
}
function showStems(entries, base, dur) {
  const list = $('#stemsList'); list.innerHTML = '';
  $('#stemsInfo').textContent = 'Ogni file dura ' + fmtDur(dur) + ' e parte dallo stesso istante: importali dall’inizio in Audacity e sono già allineati. Sommati danno il mix, con lo stesso volume finale.';
  entries.forEach(en => {
    const li = document.createElement('li');
    const t = document.createElement('span'); t.className = 't'; t.textContent = en.name + ' (' + (en.ch === 1 ? 'mono' : 'stereo') + ', ' + fmtBytes(en.data.length) + ')';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn small'; btn.textContent = 'Scarica';
    btn.setAttribute('aria-label', 'Scarica la traccia ' + en.nome + ', ' + en.name);
    btn.addEventListener('click', () => { downloadBlob(en.name, new Blob([en.data], { type: 'audio/wav' })); btn.textContent = 'Scaricato'; });
    li.append(t, btn); list.appendChild(li);
  });
  const z = $('#stemsZip'); z.hidden = entries.length < 2;
  z.onclick = () => { downloadBlob(base + '_tracce.zip', makeZip(entries.map(e => ({ name: e.name, data: e.data })))); toast('Zip scaricato: dentro trovi ' + entries.length + ' file WAV.'); };
  $('#stemsDlg').showModal();
  $('#exportStatus').textContent = 'Tracce separate pronte: scaricale dalla finestra, una alla volta o in uno zip.';
}

// volume e picco vero dell'MP3 appena codificato, decodificandolo come farà il lettore
async function mp3Lufs(parts, nc, sr) {
  const total = parts.reduce((n, p) => n + p.length, 0), all = new Uint8Array(total); let o = 0; parts.forEach(p => { all.set(p, o); o += p.length; });
  const buf = await new OfflineAudioContext(nc, 1, sr).decodeAudioData(all.buffer);
  const chs = []; for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
  return { lufs: lufs(chs, true, sr), tp: truePeakDb(chs) };
}
async function renderForExport(a, b, which, onProg) {
  if (P.vadMode === 'ai' && S.musicId) await ensureVad();     // il ducking "Intelligente" deve essere pronto, come in ascolto
  const n = b - a, L = new Float32Array(n), R = new Float32Array(n), step = SR * 10, curves = S.musicId ? musicCurves(which) : null;
  for (let t = 0; t < n; t += step) {
    const m = Math.min(step, n - t), [l, r] = renderMix(a + t, m, which, curves);
    L.set(l, t); R.set(r, t);
    onProg(t / n); await yieldUI();
  }
  return [L, R];
}
async function doExport() {
  const lay = layout(); if (!lay.total) return;
  if (S.playing) stopPlayback();
  let [a, b] = [0, lay.total];
  if (P.expSelOnly) { if (!S.sel) { toast('Hai scelto di esportare solo la selezione, ma non c’è nessuna selezione.'); return; } [a, b] = S.sel; }
  const which = (P.expWhich === 'proc' && S.procActive) ? 'proc' : 'orig';
  if (S.fx.some(x => x.solo)) toast('Attenzione: c’è un effetto in solo, quindi nel file finiscono solo gli effetti in solo.');
  const t0 = performance.now();
  try {
    const hasStereo = !!S.musicId || S.fx.length > 0;
    const mono = P.expCh === 'mono' || (P.expCh === 'auto' && !hasStereo);
    // in mono la posizione stereo degli effetti non conta: ogni effetto esce come se fosse al centro, cioè come prima
    let chs; FXMIX.mono = mono;
    try { chs = await renderForExport(a, b, which, progress('Preparazione del mix…', 0, 0.3)); } finally { FXMIX.mono = false; }
    if (mono) { const [l, r] = chs; if (hasStereo) for (let i = 0; i < l.length; i++) l[i] = (l[i] + r[i]) / 2; chs = [l]; }
    const sr = +P.expSr;
    if (sr !== SR) { busy(true, 'Conversione a ' + fmtNum(sr / 1000, 1) + ' kHz…', 0.32); await yieldUI(); chs = await resampleChs(chs, SR, sr); }
    await masterChain(chs, sr);
    busy(true, 'Controllo del risultato…', 0.62); await yieldUI();
    let afterLufs = lufs(chs, true, sr), afterTp = truePeakDb(chs);
    const base = fileBase('voce');
    let blob, name;
    if (P.expFormat === 'mp3') {
      let parts = await encodeMp3(chs, sr, +P.expKbps, progress('Codifica dell’MP3…', 0.65, 0.8));
      // la codifica MP3 taglia gli acuti estremi e toglie qualche decimo di LUFS: si misura il file e, se serve, si ricodifica
      if (P.expNorm) {
        busy(true, 'Controllo del volume dell’MP3…', 0.81); await yieldUI();
        const dec = await mp3Lufs(parts, chs.length, sr);
        if (dec.lufs > -90 && Math.abs(P.expTarget - dec.lufs) > 0.1) {
          const g = dbToGain(P.expTarget - dec.lufs); for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g;
          await limitTruePeak(chs, P.expCeil - Math.max(0, dec.tp - P.expCeil), progress('Correzione del volume dell’MP3…', 0.82, 0.86));
          parts = await encodeMp3(chs, sr, +P.expKbps, progress('Nuova codifica dell’MP3…', 0.86, 0.97));
        }
        const fin = await mp3Lufs(parts, chs.length, sr); afterLufs = fin.lufs; afterTp = fin.tp;
      }
      blob = new Blob([id3Tag(META)].concat(parts), { type: 'audio/mpeg' }); name = base + '.mp3';
    } else {
      busy(true, 'Scrittura del WAV…', 0.8); await yieldUI();
      blob = new Blob([encodeWav(chs, +P.expBits, sr, { title: META.title, artist: META.artist, album: META.album, year: META.year, comment: META.comment })], { type: 'audio/wav' });
      name = base + '.wav';
    }
    busy(false);
    downloadBlob(name, blob); FLOW.exportedSig = projSig();   // percorso guidato: esportato questo stato del lavoro
    const rep = {
      name, size: blob.size, dur: chs[0].length / sr, lufs: afterLufs, tp: afterTp, ch: chs.length, sr,
      fmt: P.expFormat === 'mp3' ? 'MP3 ' + P.expKbps + ' kbps' : 'WAV ' + P.expBits + ' bit',
      which, sec: (performance.now() - t0) / 1000
    };
    S.lastExport = rep; renderReport(); flowUpdate();
    $('#exportStatus').textContent = 'Salvato “' + name + '” (' + fmtBytes(blob.size) + ') nella cartella dei download.';
    toast('File esportato: ' + name + '.');
  } catch (e) {
    busy(false);
    $('#exportStatus').textContent = 'Esportazione non riuscita' + (e && e.message ? ': ' + e.message : '.');
    toast('Esportazione non riuscita. Se il capitolo è molto lungo, prova a esportarne una parte con “Solo la selezione”.');
  }
}
/* ---------- misuratore del volume finale ---------- */
// Scala da -24 a -12 LUFS, zona verde da -17 a -15 (il riferimento per pubblicare un podcast è -16).
// La tacca piena è dove finirà il file (Volume finale); quella ambra è l'ultimo file esportato, misurato.
const LOUD_MIN = -24, LOUD_MAX = -12;
const loudPos = v => clamp((v - LOUD_MIN) / (LOUD_MAX - LOUD_MIN), 0, 1) * 100 + '%';
function exportMono() { const hasStereo = !!S.musicId || S.fx.length > 0; return P.expCh === 'mono' || (P.expCh === 'auto' && !hasStereo); }
function loudVerdict(t) {
  if (t >= -17 && t <= -15) return { ok: true, text: 'Giusto per pubblicare un podcast: il file suonerà allo stesso volume degli altri.' };
  if (t < -20) return { ok: false, text: 'Molto basso per un podcast: le app lo alzeranno, oppure suonerà più piano degli altri. Va bene solo se il file andrà ancora mixato.' };
  if (t < -17) return { ok: false, text: 'Più basso del riferimento per i podcast (-16): va bene se il file andrà ancora mixato o montato altrove.' };
  return { ok: false, text: 'Più forte del riferimento per i podcast (-16): per arrivarci il limitatore schiaccia i picchi e la voce perde naturalezza.' };
}
function updateLoud() {
  const box = $('#loudMeter'); if (!box) return;
  const norm = P.expNorm, t = P.expTarget, r = S.lastExport;
  $('#loudV').textContent = norm ? fmtNum(t, 1) + ' LUFS' : 'non regolato';
  const set = $('#loudSet'); set.hidden = !norm; set.style.left = loudPos(t);
  const v = norm ? loudVerdict(t) : null;
  box.dataset.ok = norm ? String(v.ok) : 'off';
  $('#loudNote').textContent = !norm
    ? 'Il file non viene portato a un volume preciso: il volume dipende dal mix. Attiva “Porta il file al volume finale” per arrivare a -16 LUFS.'
    : v.text + ' Picchi al massimo a ' + fmtNum(P.expCeil, 1) + ' dBTP.' + (exportMono() ? ' Il file sarà mono: il volume è misurato come lo sentirai su due casse.' : '');
  $('#loudBar').setAttribute('aria-label', 'Volume finale ' + (norm ? fmtNum(t, 1) + ' LUFS, ' + (v.ok ? 'nella zona giusta per i podcast' : 'fuori dalla zona giusta per i podcast, da -17 a -15') : 'non regolato'));
  const last = $('#loudLast'), ln = $('#loudLastNote');
  last.hidden = ln.hidden = !r;
  if (r) { last.style.left = loudPos(r.lufs); ln.textContent = 'Ultimo file, “' + r.name + '”: ' + fmtNum(r.lufs, 1) + ' LUFS, picco ' + fmtDb(r.tp, 1) + ' dBTP.'; }
}
function renderReport() {
  updateLoud();
  const r = S.lastExport, box = $('#reportBody'); if (!r) return;
  box.innerHTML = '';
  const grid = document.createElement('div'); grid.className = 'metrics';
  [['File', r.name], ['Formato', r.fmt + ', ' + (r.ch === 1 ? 'mono' : 'stereo') + ', ' + fmtNum(r.sr / 1000, 1) + ' kHz'], ['Durata', fmtDur(r.dur)], ['Dimensione', fmtBytes(r.size)],
   ['Volume', fmtNum(r.lufs, 1) + ' LUFS'], ['Picco vero', fmtDb(r.tp, 1) + ' dBTP'], ['Voce usata', r.which === 'proc' ? 'migliorata' : 'originale']].forEach(([k, v]) => {
    const c = document.createElement('div'); c.className = 'metric';
    const s1 = document.createElement('span'); s1.textContent = k; const b = document.createElement('b'); b.textContent = v; b.style.fontSize = '14px'; b.style.wordBreak = 'break-word';
    c.append(s1, b); grid.appendChild(c);
  });
  box.appendChild(grid);
  const n = document.createElement('p'); n.className = 'note';
  n.textContent = 'Il volume di un file mono è calcolato come se uscisse da due casse, come in Sottovoce. Creato in ' + fmtNum(r.sec, 1) + ' secondi.';
  box.appendChild(n);
}
async function pickCover(file) {
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file), max = 1400, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    META.cover = new Uint8Array(await blob.arrayBuffer());
    showCover(); scheduleSave();
    if (Math.abs(bmp.width - bmp.height) > 4) toast('Copertina caricata. Non è quadrata: alcune app la ritagliano.');
    else toast('Copertina caricata (' + cv.width + ' × ' + cv.height + ' pixel).');
  } catch { toast('Questa immagine non si può leggere. Prova con un JPEG o un PNG.'); }
}
function showCover() {
  const img = $('#coverImg'), ph = $('#coverPh');
  if (img.dataset.url) { URL.revokeObjectURL(img.dataset.url); delete img.dataset.url; }
  if (META.cover) { const u = URL.createObjectURL(new Blob([META.cover], { type: 'image/jpeg' })); img.src = u; img.dataset.url = u; img.hidden = false; ph.hidden = true; $('#btnCoverDel').hidden = false; }
  else { img.hidden = true; ph.hidden = false; $('#btnCoverDel').hidden = true; }
}

