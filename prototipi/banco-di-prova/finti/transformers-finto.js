// Sostituto finto di @huggingface/transformers, solo per il banco di prova: nessun modello, nessuna rete.
// pipeline() restituisce una funzione che "trascrive" il testo di prova (con due "ehm" aggiunti) seguendo il tempo
// dei pezzi che riceve. Per provare i ripieghi della pagina:
// - i modelli "large" non danno i tempi per parola (come certi modelli veri);
// - i modelli "small" non esistono in q8 (la pagina deve passare a fp32).
export const env = { backends: { onnx: {} } };
const TESTO = window.__TESTO_FINTO || '';
export async function pipeline(task, id, opts = {}) {
  if (task !== 'automatic-speech-recognition') throw new Error('compito inatteso ' + task);
  if (/small/.test(id) && opts.dtype === 'q8') throw new Error('file onnx/encoder_model_quantized.onnx non trovato (finto)');
  const cb = opts.progress_callback || (() => {});
  for (const f of ['onnx/encoder_model.onnx', 'onnx/decoder_model_merged.onnx']) {
    for (let k = 0; k <= 4; k++) { cb({ status: 'progress', file: f, loaded: k * 5e6, total: 2e7 }); await new Promise(r => setTimeout(r, 5)); }
    cb({ status: 'done', file: f });
  }
  // con window.__PAROLE_FINTE la pagina di prova dà i tempi esatti delle parole (come Whisper, senza gli "ehm")
  let timeline, T1;
  if (window.__PAROLE_FINTE) { timeline = window.__PAROLE_FINTE; T1 = timeline[timeline.length - 1].b; }
  else {
    const ws = TESTO.split(/\s+/).filter(Boolean);
    ws.splice(10, 0, 'ehm,'); ws.splice(60, 0, 'ehm,');
    const T0 = 0.5, step = (54.5 - T0) / ws.length; T1 = 54.5;
    timeline = ws.map((w, i) => ({ w, a: T0 + i * step, b: T0 + i * step + step * 0.8 }));
  }
  let cursor = 0;
  const pipe = async (x, o = {}) => {
    if (o.language !== 'italian') throw new Error('lingua attesa: italian');
    // il tempo assoluto si ricava dai pezzi già restituiti: un errore non fa avanzare, come un modello senza memoria
    if (cursor > T1) cursor = 0;   // una nuova trascrizione dello stesso file riparte dall'inizio
    const a = cursor, b = cursor + x.length / 16000;
    const mine = timeline.filter(t => t.a >= a && t.a < b);
    await new Promise(r => setTimeout(r, 30));
    if (o.return_timestamps === 'word' && /large/.test(id)) throw new Error('Model generation config has no `alignment_heads`, token-level timestamps not available.');
    cursor = b;
    if (o.return_timestamps === 'word') {
      return { text: mine.map(t => ' ' + t.w).join(''), chunks: mine.map(t => ({ text: ' ' + t.w, timestamp: [t.a - a, t.b - a] })) };
    }
    // tempi per frase: una frase ogni punto
    const chunks = []; let cur = null;
    mine.forEach(t => { if (!cur) { cur = { text: '', timestamp: [t.a - a, t.b - a] }; chunks.push(cur); } cur.text += ' ' + t.w; cur.timestamp[1] = t.b - a; if (/[.?!]$/.test(t.w)) cur = null; });
    return { text: mine.map(t => ' ' + t.w).join(''), chunks };
  };
  return pipe;
}
