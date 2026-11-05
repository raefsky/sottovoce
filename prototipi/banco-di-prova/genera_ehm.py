# Monta l'audio di prova per la ricerca degli "ehm": frasi, "ehm" e "mmm" in mezzo, una pausa muta e un respiro.
# Scrive ehm_prova.wav, parole_ehm.json (tempi delle parole, come li darebbe Whisper, senza gli ehm)
# e verita_ehm.json (dove stanno davvero gli ehm, la pausa e il respiro).
import sys, json, numpy as np, soundfile as sf
from scipy.signal import lfilter, butter
D = sys.argv[1]; SR = 48000; rng = np.random.default_rng(3)
frasi = [l.strip() for l in open(f"{D}/frasi.txt", encoding="utf-8") if l.strip()]
def load(n): x, sr = sf.read(f"{D}/{n}.wav"); assert sr == SR; return x
seq = [("p", 1), ("g", .12), ("e", "ehm1"), ("g", .1), ("p", 2), ("g", .3), ("p", 3), ("pausa", .9), ("p", 4), ("g", .1), ("e", "ehm2"),
       ("p", 5), ("g", .2), ("p", 6), ("respiro", .35), ("p", 7), ("g", .15), ("e", "mmm"), ("g", .1), ("p", 8), ("g", .5), ("e", "ehm3"), ("g", .1), ("p", 9)]
out, t, words, truth = [], 0.3, [], []
out.append(np.zeros(int(.3 * SR)))
for kind, v in seq:
    if kind in ("g", "pausa"):
        out.append(np.zeros(int(v * SR)))
        if kind == "pausa": truth.append({"tipo": "pausa", "a": t, "b": t + v})
        t += v
    elif kind == "respiro":
        n = int(v * SR); env = np.sin(np.linspace(0, np.pi, n)) ** 2
        b = lfilter(*butter(2, [400 / (SR / 2), 3000 / (SR / 2)], 'band'), rng.standard_normal(n)) * env * 0.04
        out.append(b); truth.append({"tipo": "respiro", "a": t, "b": t + v}); t += v
    elif kind == "e":
        x = load(v) * 0.8; out.append(x); truth.append({"tipo": "ehm", "a": t, "b": t + len(x) / SR}); t += len(x) / SR
    else:
        x = load(f"p{v}"); d = len(x) / SR; ws = frasi[v - 1].split(); tot = sum(len(w) + 1 for w in ws); acc = 0
        for w in ws:
            a = t + d * acc / tot; acc += len(w) + 1
            words.append({"w": w, "a": round(a, 3), "b": round(t + d * acc / tot, 3)})
        out.append(x); t += d
out.append(np.zeros(int(.5 * SR)))
y = np.concatenate(out); y = y + rng.standard_normal(len(y)) * 10 ** (-55 / 20)
y = y / max(1, np.max(np.abs(y)) / 0.9)
sf.write(f"{D}/ehm_prova.wav", y.astype(np.float32), SR, subtype="PCM_16")
json.dump(words, open(f"{D}/parole_ehm.json", "w"), ensure_ascii=False)
json.dump(truth, open(f"{D}/verita_ehm.json", "w"), ensure_ascii=False, indent=1)
print(round(len(y) / SR, 1), "s,", len(words), "parole,", truth)
