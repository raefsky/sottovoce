# Crea le versioni di prova a partire da pulita.wav (48 kHz mono)
import sys, numpy as np, soundfile as sf
from scipy.signal import lfilter, butter, fftconvolve
B = sys.argv[1]
rng = np.random.default_rng(7)
x, sr = sf.read(f"{B}/pulita.wav"); x = x.astype(np.float64)
n = len(x)
def rms(v): return np.sqrt(np.mean(v**2) + 1e-20)
def speech_rms(v):
    f = 480; e = np.array([rms(v[i:i+f]) for i in range(0, len(v)-f, f)])
    return np.sqrt(np.mean(e[e > np.percentile(e, 50)]**2))
def mix(noise, snr_db):
    g = speech_rms(x) / rms(noise) / (10**(snr_db/20)); return x + noise * g, noise * g
def pink(m):
    w = rng.standard_normal(m); b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]; a = [1, -2.494956002, 2.017265875, -0.522189400]
    return lfilter(b, a, w)
# 1. ventola: rumore rosa + ronzio a 50 Hz con armoniche + rombo grave
t = np.arange(n) / sr
fan = pink(n) + 0.5 * lfilter(*butter(2, 200/(sr/2)), rng.standard_normal(n)) * 3
hum = sum(0.3/(k) * np.sin(2*np.pi*50*k*t) for k in range(1, 5))
noisy1, _ = mix(fan + hum * rms(fan) * 0.8, 8)
# 2. ambiente variabile: voci lontane (babble) + click di tastiera
babble = np.zeros(n)
v, _ = sf.read(f"{B}/babble_src.wav")
for k in range(5):
    off = rng.integers(0, len(v)); seg = np.roll(v, off)[:n]
    if len(seg) < n: seg = np.pad(seg, (0, n-len(seg)))
    babble += seg * rng.uniform(0.6, 1.0)
babble = lfilter(*butter(2, [300/(sr/2), 3500/(sr/2)], 'band'), babble)
keys = np.zeros(n)
pos = 0
while pos < n - 2000:
    pos += int(rng.uniform(0.08, 0.35) * sr)
    if rng.random() < 0.25: pos += int(rng.uniform(0.5, 1.5) * sr)
    if pos >= n - 2000: break
    L = int(sr * 0.012); burst = rng.standard_normal(L) * np.exp(-np.arange(L) / (sr * 0.002))
    keys[pos:pos+L] += lfilter(*butter(2, 2000/(sr/2), 'high'), burst) * rng.uniform(0.5, 1.2)
bab_g = speech_rms(x) / rms(babble) / 10**(12/20)
key_g = speech_rms(x) / np.max(np.abs(keys)) * 0.5
noisy2 = x + babble * bab_g + keys * key_g
# 3. stanza che rimbomba: risposta all'impulso sintetica, RT60 0,7 s
rt = 0.7; L = int(sr * 1.2); tt = np.arange(L) / sr
ir = rng.standard_normal(L) * np.exp(-6.91 * tt / rt); ir[:int(0.004*sr)] = 0; ir[0] = 1.0
ir = lfilter(*butter(1, 4000/(sr/2)), ir)
wet = fftconvolve(x, ir)[:n]
reverb = wet / rms(wet) * rms(x)
noisy3 = reverb + pink(n) * speech_rms(x) / 10**(35/20) / rms(pink(n))
for name, y in [("rumore_ventola", noisy1), ("rumore_variabile", noisy2), ("stanza_eco", noisy3)]:
    y = y / max(1.0, np.max(np.abs(y)) / 0.95)
    sf.write(f"{B}/{name}.wav", y.astype(np.float32), sr, subtype="PCM_16")
    print(name, round(len(y)/sr, 1), "s")
