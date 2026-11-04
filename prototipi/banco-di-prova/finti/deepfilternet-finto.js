// Sostituto finto di @lofcz/deepfilternet-web, solo per il banco di prova: stessa interfaccia, nessuna rete neurale.
// Restituisce l'ingresso a metà volume e in ritardo di 960 campioni, come il modello vero (da verificare nel browser),
// così si controllano allineamento e pareggio del volume del prototipo senza eseguire codice di terzi.
export const SAMPLE_RATE = 48000;
const DELAY = 960;
export class DeepFilter {
  constructor(atten) { this.frameLength = 480; this.sampleRate = SAMPLE_RATE; this.buf = new Float32Array(DELAY + 480); this.atten = atten; }
  static async create(options = {}) { return new DeepFilter(options.attenuationLimit ?? 100); }
  process(frame) {
    if (frame.length !== this.frameLength) throw new Error('DeepFilter expects 480 samples, got ' + frame.length);
    this.buf.copyWithin(0, 480); this.buf.set(frame, DELAY);
    const out = new Float32Array(480); for (let i = 0; i < 480; i++) out[i] = this.buf[i] * 0.5;
    return out;
  }
  setAttenuationLimit(db) { this.atten = db; }
  setPostFilterBeta() {}
  destroy() {}
}
