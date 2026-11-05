/* ========================= Controlli automatici ========================= */
// Si avviano dalla console del browser con: await studioTest()
// Lavorano su una copia dello stato e non toccano il progetto aperto.
async function studioTest() {
  const R = [], ok = (nome, cond, det) => R.push({ nome, ok: !!cond, dettaglio: det == null ? '' : String(det) });
  // 1. tempi
  ok('Tempo 59,96 s diventa 1:00,0', fmtTime(59.96) === '1:00,0', fmtTime(59.96));
  ok('Tempo con le ore', fmtTime(3725.04) === '1:02:05,0', fmtTime(3725.04));
  ok('Numeri con la virgola', fmtNum(-40.44, 1) === '-40,4', fmtNum(-40.44, 1));
  // 2. volume BS.1770: tono a 997 Hz a -20 dBFS, mono contato su due casse = -20 LUFS
  const sine = (f, a, sec, ph) => { const n = Math.round(sec * SR), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = a * Math.sin(2 * Math.PI * f * i / SR + (ph || 0)); return x; };
  const l = lufs(sine(997, 0.1, 5), true);
  ok('LUFS di un tono a -20 dBFS', Math.abs(l + 20) < 0.1, fmtNum(l, 2) + ' LUFS');
  const l2 = lufs([sine(997, 0.1, 5), sine(997, 0.1, 5)]);
  ok('LUFS stereo uguale al mono doppio', Math.abs(l2 - l) < 0.01, fmtNum(l2, 2));
  const kc = kCoeffs(48000);
  ok('Pesatura K a 48 kHz uguale alla norma', Math.abs(kc.b[0] - 1.53512485958697) < 1e-9 && Math.abs(kc.a[0] + 1.69065929318241) < 1e-9 && Math.abs(kc.h[0] + 1.99004745483398) < 1e-9, fmtNum(kc.b[0], 8));
  const s44 = (() => { const n = 44100 * 5, x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = 0.1 * Math.sin(2 * Math.PI * 997 * i / 44100); return x; })();
  const l44 = lufs(s44, true, 44100);
  ok('LUFS corretto anche a 44,1 kHz', Math.abs(l44 + 20) < 0.1, fmtNum(l44, 2) + ' LUFS');
  // 3. montaggio, annulla, ripeti (su uno stato temporaneo)
  const saved = { sources: S.sources, ops: S.ops, redo: S.redo, segs: S.segs, segT: S.segT, vlen: S.vlen, fx: S.fx, musicId: S.musicId, improved: S.improved, procActive: S.procActive, procKey: S.procKey, version: S.version };
  const savedAfter = window.__noAfter, savedEach = P.normEach; window.__noAfter = true; P.normEach = false;
  try {
    S.sources = new Map(); S.ops = []; S.redo = []; S.fx = []; S.musicId = null; S.improved = new Map(); S.procActive = false;
    const id = addSource('prova', 'voce', [sine(440, 0.5, 10, 0.3)]);
    const add = op => { S.ops.push(op); S.redo = []; replay(); };
    add({ type: 'insert', at: 0, clip: [{ src: id, s: 0, len: 10 * SR, f: [] }], label: 'prova' });
    ok('Inserimento: 10 s', S.vlen === 10 * SR, S.vlen / SR);
    add({ type: 'delete', a: 2 * SR + 123, b: 3 * SR + 777, label: 'elimina' });
    const expect = 10 * SR - (SR + 654);
    ok('Eliminazione accorcia della durata giusta', S.vlen === expect, S.vlen / SR);
    const y = renderVoice(0, S.vlen, false); let maxStep = 0;
    for (let i = 2 * SR + 123 - 2000; i < 2 * SR + 123 + 2000; i++) maxStep = Math.max(maxStep, Math.abs(y[i] - y[i - 1]));
    ok('Nessun clic sul taglio (salto massimo tra campioni)', maxStep < 0.06, fmtNum(maxStep, 4) + ' (un seno pulito arriva a 0,029)');
    S.redo.push(S.ops.pop()); replay();
    ok('Annulla riporta a 10 s', S.vlen === 10 * SR, S.vlen / SR);
    S.ops.push(S.redo.pop()); replay();
    ok('Ripeti rifà l’eliminazione', S.vlen === expect, S.vlen / SR);
    const before = renderVoice(0, S.vlen, false);
    add({ type: 'silence', a: SR, b: 2 * SR, label: 'silenzio' });
    const z = renderVoice(SR + 1000, SR - 2000, false); let mx = 0; z.forEach(v => { mx = Math.max(mx, Math.abs(v)); });
    ok('Silenzio al posto della selezione', mx === 0 && S.vlen === expect, 'max ' + mx);
    add({ type: 'fade', a: 5 * SR, b: 6 * SR, dir: 'out', label: 'dissolvenza' });
    const f0 = renderVoice(6 * SR - 50, 40, false); let fm = 0; f0.forEach(v => { fm = Math.max(fm, Math.abs(v)); });
    ok('Dissolvenza in uscita arriva a zero', fm < 0.001, fmtNum(fm, 5));
    const clip = sliceRange(S.segs, 7 * SR, 8 * SR);
    add({ type: 'insert', at: 0, clip, label: 'incolla' });
    ok('Incolla aggiunge 1 s', S.vlen === expect + SR, S.vlen / SR);
    while (S.ops.length > 2) S.redo.push(S.ops.pop()); replay();
    const back = renderVoice(0, S.vlen, false); let diff = 0; for (let i = 0; i < back.length; i += 7) diff = Math.max(diff, Math.abs(back[i] - before[i]));
    ok('L’originale resta intatto dopo annulla multipli', diff === 0, 'differenza ' + diff);
    // ritocchi di Correggi selezione: abbassa con rampe, ripara i click, più ritocchi annullati in un passo
    const rmsAt = (y, i) => { let e = 0; for (let k = i; k < i + 480; k++) e += y[k] * y[k]; return Math.sqrt(e / 480); };
    add({ type: 'dip', a: 4 * SR, b: 4.5 * SR, db: 12, label: 'respiro' });
    const dy = renderVoice(0, S.vlen, false), dr = rmsAt(dy, 4.2 * SR) / rmsAt(before, 4.2 * SR), s46 = Math.round(4.6 * SR);
    let dOut = 0; for (let i = s46; i < 5 * SR; i++) dOut = Math.max(dOut, Math.abs(dy[i] - before[i]));
    let dStep = 0; for (let i = 4 * SR - 100; i < 4 * SR + 2000; i++) dStep = Math.max(dStep, Math.abs(dy[i] - dy[i - 1]));
    ok('Abbassa: -12 dB dentro, rampe morbide, fuori identico', Math.abs(gainToDb(dr) + 12) < 0.2 && dOut === 0 && dStep < 0.06, fmtNum(gainToDb(dr), 2) + ' dB, salto ' + fmtNum(dStep, 4));
    const cs = sine(220, 0.2, 2); for (let i = 0; i < 6; i++) cs[SR + i] += 0.6 * (i % 2 ? -1 : 1);
    const id2 = addSource('click', 'voce', [cs]), at2 = S.vlen;
    add({ type: 'insert', at: at2, clip: [{ src: id2, s: 0, len: 2 * SR, f: [] }], label: 'click' });
    const raw2 = renderVoice(at2, 2 * SR, false);
    add({ type: 'fix', a: at2 + 0.8 * SR, b: at2 + 1.2 * SR, sens: 60, label: 'ripara' });
    const fx2 = renderVoice(at2, 2 * SR, false); let cpk = 0, same = true;
    for (let i = SR - 20; i < SR + 30; i++) cpk = Math.max(cpk, Math.abs(fx2[i]));
    for (let i = 0; i < Math.round(0.75 * SR); i++) if (fx2[i] !== raw2[i]) same = false;
    ok('Ripara click: il click sparisce, il resto è identico', cpk < 0.3 && same, 'picco ' + fmtNum(cpk, 3) + ' (prima ' + fmtNum(0.8, 1) + ')');
    const len3 = S.vlen;
    add({ type: 'multi', ops: [{ type: 'dip', a: SR / 2, b: SR, db: 10 }, { type: 'delete', a: 3 * SR, b: 4 * SR }], label: 'correzione' });
    const okLen = S.vlen === len3 - SR; S.redo.push(S.ops.pop()); replay();
    ok('Correzione di gruppo: si applica e si annulla in un passo', okLen && S.vlen === len3, S.vlen / SR);
  } finally {
    Object.assign(S, saved); window.__noAfter = savedAfter; P.normEach = savedEach; replay(); S.version = saved.version + 1;
  }
  // 4. limitatore sui picchi veri: un seno a un quarto della frequenza di campionamento ha i picchi tra i campioni
  const tp = sine(SR / 4, 1.4, 1, Math.PI / 4);
  ok('Picco vero misurato sopra quello dei campioni', truePeakDb(tp) > gainToDb(samplePeak(tp)) + 2, fmtNum(truePeakDb(tp), 2) + ' contro ' + fmtNum(gainToDb(samplePeak(tp)), 2));
  const sp = sine(1000, 0.3, 2); for (let i = SR; i < SR + 200; i++) sp[i] = 1.6 * Math.sin(2 * Math.PI * 9000 * i / SR);
  await limitTruePeak([sp], -1);
  ok('Limitatore: picco vero sotto -1 dBTP', truePeakDb(sp) <= -0.99, fmtNum(truePeakDb(sp), 2) + ' dBTP');
  // 5. etichette MP3
  const cover = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 0xFF, 0xD9]);
  const tag = id3Tag({ title: 'Capitolo è uno', artist: 'Roberto Lanza', album: 'Prova', year: '2026', track: '3', comment: 'Commento', cover });
  const txt = (id) => { let p = 10; while (p + 10 < tag.length) { const fid = String.fromCharCode(...tag.subarray(p, p + 4)), n = (tag[p + 4] << 24) | (tag[p + 5] << 16) | (tag[p + 6] << 8) | tag[p + 7]; if (!n) return null; if (fid === id) return tag.subarray(p + 10, p + 10 + n); p += 10 + n; } return null; };
  const tit = txt('TIT2'), dec = tit ? new TextDecoder('utf-16le').decode(tit.subarray(3)) : '';
  ok('ID3: intestazione versione 2.3', tag[0] === 0x49 && tag[1] === 0x44 && tag[2] === 0x33 && tag[3] === 3, '');
  ok('ID3: titolo con lettere accentate', dec === 'Capitolo è uno', dec);
  const apic = txt('APIC');
  ok('ID3: copertina inclusa', apic && apic[apic.length - 1] === 0xD9 && apic.length === 1 + 10 + 1 + 1 + 1 + cover.length, apic ? apic.length + ' byte' : 'manca');
  // 6. WAV e zip
  const w = sine(440, 0.5, 0.5); const wd = decodeWav(encodeWav([w], 24, SR, { title: 'prova' })); let we = 0; for (let i = 0; i < w.length; i++) we = Math.max(we, Math.abs(w[i] - wd.chs[0][i]));
  ok('WAV 24 bit: andata e ritorno', we < 2 / 8388607 && wd.sr === SR, 'errore ' + we.toExponential(1));
  const wf = decodeWav(wavFloat([w]).buffer); let fe = 0; for (let i = 0; i < w.length; i++) fe = Math.max(fe, Math.abs(w[i] - wf.chs[0][i]));
  ok('Originali nel progetto identici bit per bit', fe === 0, 'errore ' + fe);
  const zb = await makeZip([{ name: 'a.txt', data: new TextEncoder().encode('ciao') }, { name: 'b/c.bin', data: new Uint8Array([1, 2, 3]) }]).arrayBuffer(), zr = readZip(zb);
  ok('Zip del progetto: andata e ritorno', new TextDecoder().decode(zr['a.txt']) === 'ciao' && zr['b/c.bin'].join() === '1,2,3', Object.keys(zr).join(', '));
  // 7. RNNoise e MP3
  try {
    const noise = new Float32Array(SR * 2); let s = 7; for (let i = 0; i < noise.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; noise[i] = (s / 4294967296 - 0.5) * 0.05; }
    const out = await runRnnoise(noise, 1, () => { });
    // stesso rumore passato nel RNNoise compilato del banco di prova: -30,7 → -31,8 LUFS
    // (il modello toglie poco il rumore bianco sintetico; sul rumore vero della stanza scende di circa 30 dB)
    const e1 = lufs(noise, true), e2 = lufs(out, true);
    ok('RNNoise uguale a quello del banco di prova', Math.abs(e1 + 30.7) < 0.2 && Math.abs(e2 + 31.8) < 0.3, fmtNum(e1, 1) + ' → ' + fmtNum(e2, 1) + ' LUFS (atteso -30,7 → -31,8)');
  } catch (e) { ok('RNNoise uguale a quello del banco di prova', false, e.message); }
  // 9. anti-ronzio: 50 Hz e armoniche giù di almeno 25 dB, un tono a 1 kHz (la voce) praticamente intatto
  {
    const n = SR * 3, hum = new Float32Array(n), tone = sine(1000, 0.1, 3);
    for (let i = 0; i < n; i++) hum[i] = 0.02 * (Math.sin(2 * Math.PI * 50 * i / SR) + 0.6 * Math.sin(2 * Math.PI * 100 * i / SR) + 0.4 * Math.sin(2 * Math.PI * 150 * i / SR) + 0.2 * Math.sin(2 * Math.PI * 200 * i / SR));
    const filt = x => renderChain(x, (oc, src) => humBuild(oc, src, 50, 4, 30, 2)), tail = x => x.subarray(SR, n);
    const hOut = await filt(hum), tOut = await filt(tone);
    const hd = lufs(tail(hOut), true) - lufs(tail(hum), true), td = lufs(tail(tOut), true) - lufs(tail(tone), true);
    ok('Anti-ronzio: ronzio giù, voce intatta', hd < -25 && Math.abs(td) < 0.1, 'ronzio ' + fmtNum(hd, 1) + ' dB, tono a 1 kHz ' + fmtNum(td, 2) + ' dB');
    const mix = new Float32Array(n); for (let i = 0; i < n; i++) mix[i] = hum[i] * 0.2 + (i > SR && i < 2 * SR ? tone[i] : 0);
    const dh = detectHum(mix);
    ok('Rileva il ronzio a 50 Hz', dh && dh.found && dh.base === 50, dh ? dh.base + ' Hz, ' + dh.prom.map(v => fmtNum(v, 0)).join(' / ') + ' dB' : 'niente');
  }
  // 10. plosivi: un colpo a 60 Hz su una voce sintetica sopra i 150 Hz scende, il resto esce identico
  {
    const n = SR * 4, v = sine(400, 0.02, 4), y0 = new Float32Array(n), at = SR * 2;
    for (let i = 0; i < n; i++) y0[i] = v[i] + (i >= at && i < at + SR * 0.07 ? 0.3 * Math.sin(2 * Math.PI * 60 * (i - at) / SR) * Math.exp(-(i - at) / (0.018 * SR)) : 0);
    const y = dePlosive(y0, 150, 40, 12); let a = 0, b = 0, same = true;
    for (let i = 0; i < n; i++) { const p = y0[i] - v[i], q = y[i] - v[i]; if (i >= at && i < at + SR * 0.07) { a += q * q; b += p * p; } else if (i < at - SR * 0.2 && y[i] !== y0[i]) same = false; }
    const red = 10 * Math.log10(a / b);
    ok('Plosivi: colpo abbassato, voce prima del colpo identica', red < -6 && same, 'colpo ' + fmtNum(red, 1) + ' dB');
  }
  // 11. click di bocca: un click isolato su una voce sintetica viene ripulito, la voce lontana dal click esce identica
  {
    const n = SR * 3, v = sine(300, 0.1, 3), y0 = Float32Array.from(v), at = Math.round(SR * 1.5);
    for (let i = 0; i < 72; i++) y0[at + i] += 0.08 * Math.sin(2 * Math.PI * 5000 * i / SR) * Math.exp(-i / 20);
    const y = deClick(y0, 30); let a = 0, b = 0, same = true;
    for (let i = 0; i < n; i++) { if (i >= at && i < at + 96) { a += (y[i] - v[i]) ** 2; b += (y0[i] - v[i]) ** 2; } else if (Math.abs(i - at) > 480 && y[i] !== y0[i]) same = false; }
    ok('Click: riparato, il resto della voce identico', y.clicks === 1 && 10 * Math.log10(a / b) < -10 && same, y.clicks + ' click, ' + fmtNum(10 * Math.log10(a / b), 1) + ' dB');
  }
  // 12. respiri: soffio tra due frasi abbassato di 6 dB, le frasi intatte
  {
    const n = SR * 6, y0 = new Float32Array(n), vad = new Float32Array(n / 480); let s = 3;
    for (let i = 0; i < n; i++) { const t = i / SR, sp = t < 2 || t >= 4; s = (s * 1664525 + 1013904223) >>> 0; const w = s / 4294967296 - 0.5;
      y0[i] = sp ? 0.1 * Math.sin(2 * Math.PI * 200 * t) : (t > 2.8 && t < 3.2 ? 0.02 * w : 0.0005 * w); }
    for (let b = 0; b < vad.length; b++) vad[b] = (b < 200 || b >= 400) ? 1 : 0;
    const y = lowerBreaths(y0, vad, 6, 40), lv = (a, p, q) => { let e = 0; for (let i = Math.round(p * SR); i < Math.round(q * SR); i++) e += a[i] * a[i]; return 10 * Math.log10(e); };
    const br = lv(y, 2.85, 3.15) - lv(y0, 2.85, 3.15), sp = Math.abs(lv(y, 0.5, 1.9) - lv(y0, 0.5, 1.9));
    ok('Respiri: abbassati di 6 dB, frasi intatte', Math.abs(br + 6) < 0.3 && sp < 1e-6, 'respiro ' + fmtNum(br, 1) + ' dB');
  }
  // 13. livellatore lento: frasi a 12 dB di distanza si avvicinano, il rumore nelle pause non sale
  {
    const n = SR * 24, y0 = new Float32Array(n); let s = 9;
    for (let i = 0; i < n; i++) { const t = i / SR, ph = Math.floor(t / 3), on = t % 3 < 2.2; s = (s * 1664525 + 1013904223) >>> 0;
      y0[i] = (on ? (ph % 2 ? 0.025 : 0.1) * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t)) : 0) + 0.0003 * (s / 4294967296 - 0.5); }
    const y = levelSlow(y0, 0.5, 6, 10), seg = (a, k) => lufs(a.subarray(Math.round((k * 3 + 0.4) * SR), Math.round((k * 3 + 1.8) * SR)), true);
    const before = seg(y0, 4) - seg(y0, 5), after = seg(y, 4) - seg(y, 5);
    let e0 = 0, e1 = 0; for (let k = 1; k < 8; k++) for (let i = Math.round((k * 3 + 2.6) * SR); i < Math.round((k * 3 + 2.9) * SR); i++) { e0 += y0[i] * y0[i]; e1 += y[i] * y[i]; }
    const pause = 10 * Math.log10(e1 / e0);
    ok('Livellatore: frasi più vicine, pause non alzate', after < before - 4 && pause <= 0.05, 'distanza ' + fmtNum(before, 1) + ' → ' + fmtNum(after, 1) + ' dB, pause ' + fmtNum(pause, 2) + ' dB');
  }
  // 14. misura delle sibilanti: s sintetiche (rumore a 6-8 kHz) più forti danno un valore più alto
  {
    const mk = amp => { const n = SR * 8, y = new Float32Array(n); let s = 5; for (let i = 0; i < n; i++) { const t = i / SR; s = (s * 1664525 + 1013904223) >>> 0;
      y[i] = (t % 1 < 0.7 ? 0.1 * Math.sin(2 * Math.PI * 250 * t) : 0) + (t % 1 >= 0.7 && t % 1 < 0.8 ? amp * Math.sin(2 * Math.PI * 7000 * t) * (s / 4294967296) : 0); } return y; };
    const s1 = measureSib(mk(0.01)), s2 = measureSib(mk(0.05));
    ok('Sibilanti: s più forti, misura più alta', s1 != null && s2 > s1 + 10, fmtNum(s1, 1) + ' → ' + fmtNum(s2, 1) + ' dB');
  }
  // 15. più tagli in una sola operazione: stesso risultato dei tagli fatti uno alla volta, dall'ultimo al primo
  {
    const base = [{ src: 'a', s: 0, len: SR * 10, f: [] }], ranges = [[SR * 1, SR * 2], [SR * 4, SR * 4.5], [SR * 7, SR * 9]];
    const one = { segs: cloneSegs(base), fx: [] }; applyOp(one, { type: 'cuts', ranges });
    const many = { segs: cloneSegs(base), fx: [] }; for (const [a, b] of ranges.slice().reverse()) applyOp(many, { type: 'delete', a, b });
    ok('Accorcia i silenzi: tagli multipli come tagli singoli', JSON.stringify(one.segs) === JSON.stringify(many.segs) && segsLen(one.segs) === SR * 6.5, fmtNum(segsLen(one.segs) / SR, 1) + ' s');
  }
  // 16. effetti: taglio non distruttivo e ripetizione senza salti di volume alle giunture
  {
    const n = SR * 2, z = new Float32Array(n); let q = 21; for (let i = 0; i < n; i++) { q = (q * 1664525 + 1013904223) >>> 0; z[i] = (q / 4294967296 - 0.5) * 0.2; }
    S.sources.set('__tfx', { id: '__tfx', name: 't', kind: 'effetto', chs: [z], len: n });
    const e1 = { id: '__e1', src: '__tfx', at: 0, gainDb: 0, in: 0.5, out: 1.5 }, c1 = fxRender(e1);
    let same = fxSpan(e1) === SR; for (let i = 0; i < SR && same; i++) same = c1.L[i] === z[SR / 2 + i];
    const e2 = { id: '__e2', src: '__tfx', at: 0, gainDb: 0, in: 0.5, out: 1.5, len: 3.5, loop: true }, c2 = fxRender(e2);
    const rms = (a, p, q) => { let s = 0; for (let i = p; i < q; i++) s += a[i] * a[i]; return Math.sqrt(s / (q - p)); };
    const step = SR - Math.round(FX_XF * SR), joint = rms(c2.L, step - 2400, step + 2400), body = rms(c2.L, SR * 0.3, SR * 0.7), dj = 20 * Math.log10(joint / body);
    const sp2 = fxSpan(e2); S.sources.delete('__tfx'); FXR.delete('__e1'); FXR.delete('__e2');
    ok('Effetti: taglio esatto e ripetizione senza salti', same && sp2 === SR * 3.5 && Math.abs(dj) < 1.5, 'taglio ' + (same ? 'esatto' : 'diverso') + ', durata ' + fmtNum(sp2 / SR, 2) + ' s, giuntura ' + fmtNum(dj, 2) + ' dB');
  }
  // 17. dissolvenze degli effetti: da zero al volume pieno con la curva a S, e ridotte in proporzione se non ci stanno
  {
    const n = SR, z = new Float32Array(n).fill(0.5);
    S.sources.set('__tfd', { id: '__tfd', name: 't', kind: 'effetto', chs: [z], len: n });
    const e = { id: '__f1', src: '__tfd', at: 0, gainDb: 0, fadeIn: 0.1, fadeOut: 0.2 }, c = fxRender(e), fi = SR * 0.1, fo = SR * 0.2;
    const shape = Math.abs(c.L[fi / 2] - 0.25) < 0.01 && c.L[0] < 0.001 && Math.abs(c.L[fi] - 0.5) < 1e-6 && c.L[n - 1] < 0.001 && Math.abs(c.L[n - fo - 1] - 0.5) < 1e-6;
    const e2 = { id: '__f2', src: '__tfd', at: 0, gainDb: 0, fadeIn: 0.8, fadeOut: 0.8 }, f2 = fxFades(e2, n);
    S.sources.delete('__tfd'); FXR.delete('__f1'); FXR.delete('__f2');
    ok('Effetti: dissolvenze a S, ridotte se troppo lunghe', shape && f2[0] + f2[1] <= n && f2[0] === f2[1], 'metà entrata ' + fmtNum(c.L[fi / 2], 3) + ' (atteso 0,250)');
  }
  // 18. curva di volume degli effetti: segmenti lineari in dB, prima e dopo i punti vale il punto più vicino
  {
    const n = SR, z = new Float32Array(n).fill(0.5);
    S.sources.set('__tfe', { id: '__tfe', name: 't', kind: 'effetto', chs: [z], len: n });
    const e = { id: '__v1', src: '__tfe', at: 0, gainDb: 0, env: [[0.2, 0], [0.6, -20]] }, c = fxRender(e), db = i => 20 * Math.log10(c.L[i] / 0.5);
    const v = [db(SR * 0.1), db(SR * 0.4), db(SR * 0.8)];
    S.sources.delete('__tfe'); FXR.delete('__v1');
    ok('Effetti: curva di volume lineare in dB', Math.abs(v[0]) < 0.05 && Math.abs(v[1] + 10) < 0.1 && Math.abs(v[2] + 20) < 0.05, v.map(x => fmtNum(x, 1)).join(' / ') + ' dB (attesi 0 / -10 / -20)');
  }
  // 19. posizione stereo degli effetti: centro identico a prima, potenza costante, ignorata in mono
  {
    const c = fxPanGains(0), l = fxPanGains(-1), m = fxPanGains(0.3), pw = m[0] * m[0] + m[1] * m[1];
    FXMIX.mono = true; const mo = fxPanGains(-1); FXMIX.mono = false;
    ok('Effetti: posizione stereo a potenza costante', c[0] === 1 && c[1] === 1 && Math.abs(l[0] - Math.SQRT2) < 1e-12 && Math.abs(l[1]) < 1e-12 && Math.abs(pw - 2) < 1e-12 && mo[0] === 1 && mo[1] === 1, 'al 30 % a destra: ' + fmtNum(20 * Math.log10(m[0]), 1) + ' / ' + fmtNum(20 * Math.log10(m[1]), 1) + ' dB');
  }
  // 20. carattere degli effetti: velocità (altezza e durata), lontano (acuti tolti), riverbero (coda, sempre uguale)
  {
    const n = SR, tone = f => { const z = new Float32Array(n); for (let i = 0; i < n; i++) z[i] = 0.3 * Math.sin(2 * Math.PI * f * i / SR); return z; };
    const zc = x => { let c = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) c++; return c / 2 / (x.length / SR); };
    const rms = (x, p, q) => { let e = 0; for (let i = p; i < q; i++) e += x[i] * x[i]; return Math.sqrt(e / (q - p)); };
    S.sources.set('__t1', { id: '__t1', name: 't', kind: 'effetto', chs: [tone(500)], len: n });
    S.sources.set('__t2', { id: '__t2', name: 't', kind: 'effetto', chs: [tone(5000)], len: n });
    const r2 = fxRender({ id: '__c1', src: '__t1', at: 0, gainDb: 0, rate: 2 }), f2 = zc(r2.L);
    const lpLo = fxRender({ id: '__c2', src: '__t1', at: 0, gainDb: 0, lp: 1000 }), lpHi = fxRender({ id: '__c3', src: '__t2', at: 0, gainDb: 0, lp: 1000 });
    const dLo = 20 * Math.log10(rms(lpLo.L, SR / 2, n) / rms(tone(500), SR / 2, n)), dHi = 20 * Math.log10(rms(lpHi.L, SR / 2, n) / rms(tone(5000), SR / 2, n));
    const ev = { id: '__c4', src: '__t1', at: 0, gainDb: 0, rev: { type: 'large', mix: 0.3 } }, rv = fxRender(ev), sp = fxSpan(ev);
    FXR.delete('__c4'); const rv2 = fxRender(ev); let same = rv.L.length === rv2.L.length; for (let i = 0; i < rv.L.length && same; i++) same = rv.L[i] === rv2.L[i];
    const tail1 = rms(rv.L, n + SR * 0.1, n + SR * 0.4), tail2 = rms(rv.L, n + SR * 1.8, n + SR * 2.4);
    for (const k of ['__t1', '__t2']) S.sources.delete(k); for (const k of ['__c1', '__c2', '__c3', '__c4']) FXR.delete(k);
    ok('Effetti: velocità, lontano e riverbero', Math.abs(f2 - 1000) < 5 && r2.L.length === n / 2 && Math.abs(dLo) < 1 && dHi < -30 && sp === n + Math.round(FX_REV.large.t * SR) && same && tail1 > 0 && tail2 < tail1 / 10,
      'tono × 2: ' + fmtNum(f2, 0) + ' Hz; lontano: 500 Hz ' + fmtNum(dLo, 1) + ' dB, 5 kHz ' + fmtNum(dHi, 0) + ' dB; coda ' + fmtNum(20 * Math.log10(tail2 / tail1), 0) + ' dB');
  }
  // 21. effetti lunghi a blocchi: stesso risultato del calcolo intero, campione per campione, anche chiedendo i tratti in ordine sparso
  {
    const n = SR * 2, z = new Float32Array(n), z2 = new Float32Array(n); let q = 77;
    for (let i = 0; i < n; i++) { q = (q * 1664525 + 1013904223) >>> 0; z[i] = (q / 4294967296 - 0.5) * 0.3 * Math.sin(2 * Math.PI * 3 * i / SR); z2[i] = z[i] * 0.5 + 0.1 * Math.sin(2 * Math.PI * 440 * i / SR); }
    S.sources.set('__tl', { id: '__tl', name: 't', kind: 'effetto', chs: [z, z2], len: n });
    const e = { id: '__l1', src: '__tl', at: 0, gainDb: 0, in: 0.1, out: 1.8, loop: true, len: 23, rate: 0.9, fadeIn: 0.4, fadeOut: 1.1, env: [[2, 0], [15, -12]], rev: { type: 'large', mix: 0.4 }, lp: 3000 };
    const full = fxRender(e), N = full.L.length; let diff = 0;
    for (const [a, b] of [[N - 9000, N], [SR * 9 + 7, SR * 21], [0, SR * 10 + 3]]) { const r = fxLongRange(e, a, b); for (let i = 0; i < b - a; i++) if (r.L[i] !== full.L[a + i] || r.R[i] !== full.R[a + i]) diff++; }
    S.sources.delete('__tl'); FXR.delete('__l1'); FXB.delete('__l1');
    ok('Effetti lunghi: a blocchi identici al calcolo intero', diff === 0, diff + ' campioni diversi su ' + N);
  }
  // 8. riconoscimento della voce: probabilità tra 0 e 1, quasi zero sul silenzio; il gate segue la probabilità
  try {
    const v = await analyzeVad(new Float32Array(SR), () => { });
    ok('Riconoscimento voce: valori tra 0 e 1, zero sul silenzio', v.length === 100 && v.every(p => p >= 0 && p <= 1) && Math.max(...v) < 0.05, 'massimo ' + fmtNum(Math.max(...v), 3));
  } catch (e) { ok('Riconoscimento voce: valori tra 0 e 1, zero sul silenzio', false, e.message); }
  const gx = sine(220, 0.1, 4), nF = Math.ceil(gx.length / 480), half = new Float32Array(nF).fill(0); half.fill(1, 0, nF / 2);
  const gy = applyGate(gx, 10, 12, half, 0.5), rms = (x, a, b) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / (b - a)); };
  const keep = rms(gy, SR * 0.5, SR * 1.5) / rms(gx, SR * 0.5, SR * 1.5), cut = gainToDb(rms(gy, SR * 3, SR * 4) / rms(gx, SR * 3, SR * 4));
  ok('Gate intelligente: lascia la voce e abbassa il resto', Math.abs(keep - 1) < 1e-6 && cut < -11, 'voce ' + fmtNum(keep, 3) + ', resto ' + fmtNum(cut, 1) + ' dB');
  try {
    const parts = await encodeMp3([sine(440, 0.3, 1)], SR, 128, () => { });
    const n = parts.reduce((a, b) => a + b.length, 0);
    ok('MP3: codifica di 1 s', n > 10000 && parts[0][0] === 0xFF && (parts[0][1] & 0xE0) === 0xE0, n + ' byte');
  } catch (e) { ok('MP3: codifica di 1 s', false, e.message); }
  // Correggi selezione: una pausa lunga si accorcia a 0,6 s, un tratto di parole non si tocca
  const pp1 = selectionPlan({ a: SR, b: 3 * SR, speech: 0, clicks: 0, dur: 2, breath: [], noise: [] }), pp2 = selectionPlan({ a: 0, b: SR, speech: 0.8, clicks: 0, dur: 1, breath: [], noise: [] });
  ok('Correggi selezione: pausa lunga accorciata a 0,6 s, parole lasciate stare', pp1.ops.length === 1 && pp1.ops[0].type === 'delete' && pp1.ops[0].b - pp1.ops[0].a === 1.4 * SR && !pp2.ops.length, pp1.text + ' | ' + pp2.text);
  // de-esser: con "s" forti (7 kHz a scatti sopra un tono grave) abbassa gli acuti e lascia i gravi; mai un aumento
  const ds = sine(200, 0.3, 4), s7 = sine(7000, 0.25, 4), s55 = sine(5500, 0.25, 4); for (let i = 0; i < ds.length; i++) if ((i / SR) % 1 > 0.6) { ds[i] += s7[i]; }
  const dsy = deEss(ds, 20, 6), bandRms = (y, f) => { const lo = lowZeroPhase(y, f * 0.8), hi = lowZeroPhase(y, f * 1.25); let e = 0; for (let i = SR * 3.65; i < SR * 3.95; i++) { const v = hi[i] - lo[i]; e += v * v; } return Math.sqrt(e); };
  const dS = gainToDb(bandRms(dsy, 7000) / bandRms(ds, 7000)), dL = gainToDb(bandRms(dsy, 200) / bandRms(ds, 200));
  const ds2 = sine(200, 0.3, 4); for (let i = 0; i < ds2.length; i++) if ((i / SR) % 1 > 0.6) ds2[i] += s55[i];
  const d55 = gainToDb(bandRms(deEss(ds2, 20, 6), 5500) / bandRms(ds2, 5500));
  ok('De-esser: abbassa le s (7 e 5,5 kHz), non tocca i gravi', dS < -3 && d55 < -1 && Math.abs(dL) < 0.3, '7 kHz ' + fmtNum(dS, 1) + ' dB, 5,5 kHz ' + fmtNum(d55, 1) + ' dB, gravi ' + fmtNum(dL, 2) + ' dB');
  // Modalità Podcast: punteggio e consigli solo quando servono
  const pd = { clipRuns: 0, decayMs: 120, lufs: -24 }, pp = { snr: 48, sibDb: -15, decayMs: 150 };
  const p0 = podcastResult(pd, pp, {}), p1 = podcastResult(Object.assign({}, pd, { decayMs: 350 }), pp, {}), p2 = podcastResult(Object.assign({}, pd, { clipRuns: 3 }), pp, {});
  ok('Modalità Podcast: Ottimo senza consigli, Buono e Da migliorare con un consiglio', p0.label === 'Ottimo' && !p0.tips.length && p1.label === 'Buono' && p1.tips.length === 1 && p2.label === 'Da migliorare' && p2.tips.length === 1, [p0.label, p1.label, p2.label].join(', '));
  const pe = podcastResult(Object.assign({}, pd, { decayMs: 400 }), { snr: 55, sibDb: -15, decayMs: 200 }, { eco: true }), ps = podcastResult(pd, { snr: 55, sibDb: -11, decayMs: 150 }, {});
  ok('Modalità Podcast: rimbombo e sibilanti giudicati sul risultato', pe.rows.every(r => r[2]) && pe.tips.length === 1 && ps.rows.some(r => !r[2] && /Sibilanti/.test(r[0])) && ps.label === 'Buono', pe.rows.filter(r => !r[2]).map(r => r[0]).join(', ') + ' | ' + ps.label);
  ok('Modalità Podcast: differenze di volume tra frasi', speechSpread(sine(200, 0.3, 30)) < 1, fmtNum(speechSpread(sine(200, 0.3, 30)), 1) + ' dB');
  const bad = R.filter(r => !r.ok);
  console.table(R);
  return { superati: R.length - bad.length, totale: R.length, falliti: bad, risultati: R };
}
window.studioTest = studioTest;
window.__studio = { S, P, META, musicViewScale, STYLE_PV, stylePreview, VOICE_STYLES, improveKey, podcastResult, FXPK, FXB, fxBase, fxLongRange, fxIsLong, fxLayout, fxBox, voicePauseEdges, FXPV, duplicateFx, fxSpan, fxRender, FXR, SPEC, findSilences, measureSib, diagnose, levelSlow, deClick, lowerBreaths, analyzeVad, dePlosive, detectHum, humBuild, renderChain, musicCurves, voiceVad, ensureVad, vadReady, VAD, doStems, clearHistory, collapseHistory, REC, METER, actx: () => ACTX, pushOp, undo, redo, replay, layout, renderVoice, renderMix, lufs, truePeakDb, importVoice, importMusic, importFx, improveSources, doExport, saveProject, openProject, selectAll, setMode, togglePlay, decodeWav, readZip, id3Tag };

