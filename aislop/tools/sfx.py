#!/usr/bin/env python3
"""Sound-effects stem for the film.

Every sound is synthesized here (no samples, no licensing), then placed at
  * scene transitions            (type -> sound, e.g. glitch -> digital burst, whip -> whoosh)
  * animation onsets              (tools/sfx_scan.mjs: pop-ins -> pops, cursor clicks -> clicks, text rises -> soft ticks)
  * hand-picked story beats       (CUES below: stamps, the shattering gem, the error buzz, drones under the scary parts ...)

  python3 tools/sfx.py [--onsets out/sfx/onsets.json] [--out out/film/aislop_se.wav]

The result is a 48 kHz stereo WAV the length of the film, peaking around -3 dBFS, meant to sit under the narration.
"""
import argparse, json, subprocess, sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
RNG = np.random.default_rng(20260924)


# ------------------------------------------------------------------ building blocks
def T(d):
    return np.arange(max(1, int(round(d * SR)))) / SR

def noise(n):
    return RNG.standard_normal(n)

def sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output='sos')

def bp(x, lo, hi, order=2):
    hi = min(hi, SR / 2 * 0.95)
    return signal.sosfilt(sos('bandpass', [lo, hi], order), x)

def lp(x, f, order=2):
    return signal.sosfilt(sos('lowpass', min(f, SR / 2 * 0.95), order), x)

def hp(x, f, order=2):
    return signal.sosfilt(sos('highpass', f, order), x)

def fade(x, a=0.002, r=0.01):
    n = len(x); x = x.copy()
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na > 0: x[:na] *= np.linspace(0, 1, na)
    if nr > 0: x[-nr:] *= np.linspace(1, 0, nr)
    return x

def chirp_phase(f):
    return 2 * np.pi * np.cumsum(f) / SR

def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1.0
    return x * (peak / m)

def stereo(x, pan=0.0, width=0.0):
    """equal-power pan; width adds a slightly delayed, decorrelated copy to the far side"""
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    L, R = x * np.cos(a), x * np.sin(a)
    if width > 0:
        d = int(0.011 * SR)
        y = np.concatenate([np.zeros(d), x])[:len(x)] * width
        L, R = L + y * np.sin(a), R + y * np.cos(a)
    return np.stack([L, R], 1)

def pan_sweep(x, p0, p1):
    p = np.linspace(p0, p1, len(x))
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)

def _ir(d=1.6, damp=3500, seed=3):
    r = np.random.default_rng(seed)
    t = T(d)
    e = np.exp(-t / (d / 6.5))
    L = lp(r.standard_normal(len(t)) * e, damp)
    R = lp(r.standard_normal(len(t)) * e, damp)
    pre = np.zeros((int(0.014 * SR), 2))
    ir = np.concatenate([pre, np.stack([L, R], 1)])
    return ir / np.sqrt(np.sum(ir ** 2) / 2)

IR_ROOM = _ir(0.9, 5000, 1)
IR_HALL = _ir(2.6, 3000, 2)

def verb(x, wet=0.25, ir=None):
    """x: stereo array -> x with a convolution reverb tail appended"""
    ir = IR_ROOM if ir is None else ir
    n = len(x) + len(ir) - 1
    y = np.zeros((n, 2))
    y[:len(x)] += x * (1 - wet * 0.5)
    for c in (0, 1):
        y[:, c] += signal.fftconvolve(x[:, c], ir[:, c]) * wet * 0.35
    return y

def bands_sweep(n, f0, f1, nb=10, q=0.5):
    """noise through a bank of band-passes whose gains follow a moving centre frequency (a cheap swept filter)"""
    x = noise(n)
    centers = np.geomspace(120, 12000, nb)
    fc = np.geomspace(f0, f1, n)
    out = np.zeros(n)
    for c in centers:
        y = bp(x, c / 1.35, c * 1.35, 2)
        g = np.exp(-0.5 * (np.log(fc / c) / q) ** 2)
        out += y * g
    return out


# ------------------------------------------------------------------ the sounds (each returns a stereo array)
def s_pop(pitch=1.0, pan=0.0):
    t = T(0.13)
    f = 380 * pitch * (1 + 1.7 * (1 - np.exp(-t / 0.016)))
    x = np.sin(chirp_phase(f)) * np.exp(-t / 0.042)
    x += hp(noise(len(t)), 2500) * np.exp(-t / 0.0022) * 0.25
    return verb(stereo(fade(norm(x), 0.001, 0.02), pan, 0.2), 0.12)

def s_tick(pitch=1.0, pan=0.0):
    t = T(0.05)
    x = np.sin(2 * np.pi * 2100 * pitch * t) * np.exp(-t / 0.009) + bp(noise(len(t)), 3000, 9000) * np.exp(-t / 0.003) * 0.5
    return stereo(fade(norm(x), 0.0005, 0.01), pan, 0.1)

def s_click(pan=0.0):
    t = T(0.06)
    x = bp(noise(len(t)), 1800, 7000) * np.exp(-t / 0.0028)
    x += np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.008) * 0.25
    t2 = T(0.03)
    y = bp(noise(len(t2)), 2000, 8000) * np.exp(-t2 / 0.002) * 0.45
    out = np.zeros(len(t) + int(0.045 * SR)); out[:len(t)] += x; out[int(0.045 * SR):int(0.045 * SR) + len(t2)] += y
    return verb(stereo(norm(out), pan), 0.1)

def s_swish(d=0.28, f0=900, f1=6000, p0=-0.5, p1=0.5):
    n = int(d * SR)
    x = bands_sweep(n, f0, f1, 10, 0.45)
    u = np.linspace(0, 1, n)
    e = np.where(u < 0.7, (u / 0.7) ** 2.2, np.exp(-(u - 0.7) / 0.08))
    return verb(pan_sweep(fade(norm(x * e), 0.002, 0.02), p0, p1), 0.15)

def s_whoosh(d=0.6, f0=180, f1=2600, p0=-0.7, p1=0.7, peak=0.62):
    n = int(d * SR)
    x = bands_sweep(n, f0, f1, 12, 0.55)
    u = np.linspace(0, 1, n)
    e = np.where(u < peak, (u / peak) ** 2.5, np.exp(-(u - peak) / 0.12))
    rum = lp(noise(n), 160) * e * 0.8
    return verb(pan_sweep(fade(norm(x * e + rum), 0.003, 0.03), p0, p1), 0.2)

def s_whump():
    t = T(0.7)
    f = 40 + 45 * np.exp(-t / 0.12)
    x = np.sin(chirp_phase(f)) * np.exp(-t / 0.22) * (1 - np.exp(-t / 0.012))
    x += lp(noise(len(t)), 280) * np.exp(-t / 0.08) * 0.5
    return verb(stereo(fade(norm(x), 0.004, 0.05), 0, 0.3), 0.18)

def s_glitch(d=0.35, seed=0):
    r = np.random.default_rng(1000 + seed)
    n = int(d * SR)
    out = np.zeros((n, 2))
    i = 0
    while i < n:
        seg = int(r.uniform(0.012, 0.045) * SR)
        seg = min(seg, n - i)
        t = np.arange(seg) / SR
        k = r.random()
        if k < 0.3:   # square blip
            f = r.choice([220, 330, 440, 660, 880, 1320, 1760, 2640]) * r.uniform(0.98, 1.02)
            y = np.sign(np.sin(2 * np.pi * f * t)) * 0.6
        elif k < 0.6:  # crushed noise
            y = noise(seg); hold = r.integers(4, 24); y = np.repeat(y[::hold], hold)[:seg]; y = np.round(y * 3) / 3 * 0.8
        elif k < 0.8:  # stutter: repeat a tiny grain
            g = noise(int(0.006 * SR)) * 0.9; y = np.tile(g, seg // len(g) + 1)[:seg]
        else:
            y = np.zeros(seg)
        y = fade(y, 0.001, 0.002)
        out[i:i + seg] += stereo(y, r.uniform(-0.7, 0.7))
        i += seg
    for c in (0, 1): out[:, c] = lp(hp(out[:, c], 180), 7000)
    u = np.linspace(0, 1, n)[:, None]
    return norm(out * (1 - u ** 3))

def s_pixel(seed=0):
    notes = [1046.5, 1318.5, 1568.0, 2093.0] if seed % 2 == 0 else [2093.0, 1568.0, 1318.5, 1046.5]
    parts = []
    for f in notes:
        t = T(0.035)
        parts.append(np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t / 0.05))
    x = lp(np.concatenate(parts), 7000)
    return stereo(fade(norm(x) * 0.8, 0.001, 0.01), 0, 0.2)

def s_goo():
    t = T(0.55)
    f = 70 + 90 * np.exp(-t / 0.18) + 6 * np.sin(2 * np.pi * 11 * t)
    x = np.sin(chirp_phase(f)) * np.exp(-t / 0.25)
    n = len(t)
    squelch = bands_sweep(n, 1600, 260, 10, 0.35) * np.exp(-t / 0.14)
    x = x * 0.7 + squelch * 1.6
    return verb(stereo(fade(norm(x), 0.004, 0.05), 0, 0.3), 0.2)

def s_impact(size=1.0, bright=1.0):
    t = T(1.4 * size)
    f = 38 + 30 * np.exp(-t / 0.08)
    sub = np.sin(chirp_phase(f)) * np.exp(-t / (0.45 * size))
    body = np.tanh(np.sin(chirp_phase(95 + 80 * np.exp(-t / 0.03))) * 2.5) * np.exp(-t / 0.11)
    punch = bp(noise(len(t)), 150, 1600) * np.exp(-t / 0.06)
    crack = hp(noise(len(t)), 3500) * np.exp(-t / 0.009) * 0.6 * bright
    x = sub * 0.8 + body * 0.55 + punch * 2.2 + crack
    return verb(stereo(fade(norm(np.tanh(x * 1.6)), 0.001, 0.08), 0, 0.4), 0.35, IR_HALL)

def s_stamp(pan=0.0):
    t = T(0.35)
    f = 55 + 70 * np.exp(-t / 0.03)
    x = np.tanh(np.sin(chirp_phase(f)) * 2) * np.exp(-t / 0.06) * 0.7
    x += bp(noise(len(t)), 250, 1800) * np.exp(-t / 0.022) * 2.6
    x += bp(noise(len(t)), 2500, 6000) * np.exp(-t / 0.004) * 0.8
    return verb(stereo(fade(norm(np.tanh(x * 1.4)), 0.0005, 0.04), pan, 0.2), 0.18)

def s_riser(d=1.5):
    n = int(d * SR)
    u = np.linspace(0, 1, n)
    x = bands_sweep(n, 300, 7000, 12, 0.5) * u ** 2.4
    f = 180 * 2 ** (u * 2.6)
    x += np.sin(chirp_phase(f + 4 * np.sin(2 * np.pi * 7 * u * d))) * u ** 2 * 0.35
    return pan_sweep(fade(norm(x), 0.05, 0.004), -0.3, 0.3)

def s_swell(d=1.2):
    """reversed reverb-like swell that ends exactly at its event time (place with end-alignment)"""
    n = int(d * SR)
    x = lp(noise(n), 5000) * np.exp(-np.linspace(0, 1, n)[::-1] / 0.18)
    x = hp(x, 300)
    return stereo(fade(norm(x), 0.05, 0.003), 0, 0.5)

def s_drone(d=5.0, f=55.0, bright=500):
    t = T(d)
    x = sum(signal.sawtooth(2 * np.pi * f * m * t + ph) * a for m, ph, a in ((1, 0, 1), (1.006, 1.3, 0.8), (2.003, 2.1, 0.35), (0.5, 0.4, 0.5)))
    cut = bright * (1 + 0.5 * np.sin(2 * np.pi * 0.23 * t))
    # a slowly moving low-pass, approximated by crossfading two fixed filters
    a, b = lp(x, bright * 0.5, 2), lp(x, bright * 1.5, 2)
    w = (cut - bright * 0.5) / bright
    x = a * (1 - w) + b * w
    x *= 1 + 0.15 * np.sin(2 * np.pi * 0.7 * t)
    e = np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.8)
    return verb(stereo(norm(x * e), 0, 0.6), 0.3, IR_HALL)

def s_shatter():
    d = 1.4
    n = int(d * SR)
    out = np.zeros((n, 2))
    t = T(0.012)
    out[:len(t)] += stereo(hp(noise(len(t)), 2500) * np.exp(-t / 0.004), 0)
    for k in range(70):
        t0 = RNG.exponential(0.16)
        if t0 > d - 0.2: continue
        f = RNG.uniform(2300, 9500); tau = RNG.uniform(0.015, 0.11)
        tt = T(tau * 6)
        y = np.sin(2 * np.pi * f * tt + RNG.uniform(0, 6)) * np.exp(-tt / tau) * RNG.uniform(0.2, 1.0)
        y += hp(noise(len(tt)), 5000) * np.exp(-tt / 0.004) * 0.3
        i = int(t0 * SR)
        m = min(len(y), n - i)
        out[i:i + m] += stereo(y[:m], RNG.uniform(-0.9, 0.9))
    tl = T(0.4)
    out[:len(tl)] += stereo(np.sin(chirp_phase(60 + 60 * np.exp(-tl / 0.05))) * np.exp(-tl / 0.12) * 1.2, 0)
    return verb(norm(out), 0.3, IR_HALL)

def s_crackle(d=0.9):
    n = int(d * SR)
    x = np.zeros(n)
    tt, gap = 0.0, 0.14
    while tt < d - 0.02:
        t = T(0.012)
        y = bp(noise(len(t)), 1500, 7000) * np.exp(-t / 0.0025) * (0.3 + 0.7 * tt / d)
        i = int(tt * SR); m = min(len(y), n - i); x[i:i + m] += y[:m]
        tt += gap * RNG.uniform(0.6, 1.3); gap = max(0.018, gap * 0.82)
    return verb(stereo(norm(x), 0, 0.3), 0.15)

def s_coin(pitch=1.0, pan=0.0):
    t = T(0.5)
    x = sum(np.sin(2 * np.pi * f * pitch * t) * np.exp(-t / tau) * a for f, tau, a in ((2900, 0.16, 1), (4370, 0.11, 0.7), (6150, 0.07, 0.45)))
    x += hp(noise(len(t)), 4000) * np.exp(-t / 0.003) * 0.3
    return verb(stereo(fade(norm(x), 0.0005, 0.05), pan, 0.2), 0.15)

def s_cash():
    out = np.zeros((int(1.3 * SR), 2))
    t = T(0.08)
    hit = bp(noise(len(t)), 2500, 9000) * np.exp(-t / 0.012)
    out[:len(t)] += stereo(hit, -0.1)
    t = T(1.1)
    bell = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / tau) * a for f, tau, a in ((2093, 0.5, 1), (2637 * 1.01, 0.35, 0.6), (3136, 0.3, 0.5), (4186 * 1.003, 0.2, 0.35), (5274, 0.12, 0.25)))
    i = int(0.075 * SR)
    out[i:i + len(t)] += stereo(bell, 0.15, 0.3)
    return verb(norm(out), 0.2)

def s_printer(d=1.5):
    t = T(d)
    gate = (np.sin(2 * np.pi * 95 * t) > 0.2).astype(float)
    x = bp(noise(len(t)), 900, 4200) * gate * 0.7 + lp(signal.sawtooth(2 * np.pi * 118 * t), 600) * 0.25
    e = np.minimum(1, t / 0.04) * np.minimum(1, (d - t) / 0.08)
    return verb(stereo(norm(x * e), 0.2, 0.2), 0.1)

def s_error():
    out = []
    for f in (170, 162):
        t = T(0.12)
        y = np.tanh(np.sign(np.sin(2 * np.pi * f * t)) * 0.8 + np.sin(2 * np.pi * f * 2 * t) * 0.3)
        out += [lp(y, 2400) * np.minimum(1, t / 0.004) * np.minimum(1, (0.12 - t) / 0.01), np.zeros(int(0.05 * SR))]
    return verb(stereo(norm(np.concatenate(out)), 0, 0.2), 0.12)

def s_ding(f0=1568.0):
    out = np.zeros(int(1.2 * SR))
    for k, f in enumerate((f0, f0 * 4 / 3)):
        t = T(1.0)
        y = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.35)
        i = int(k * 0.09 * SR); out[i:i + len(t)] += y
    return verb(stereo(norm(fade(out, 0.002, 0.05)), 0, 0.3), 0.2)

def s_chime(f=880.0):
    t = T(2.4)
    x = sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t / tau) * a for m, tau, a in ((1, 0.9, 1), (2.76, 0.35, 0.4), (5.4, 0.15, 0.2), (2.0, 0.6, 0.25)))
    return verb(stereo(fade(norm(x), 0.002, 0.2), 0, 0.5), 0.4, IR_HALL)

def s_gavel():
    out = np.zeros(int(0.9 * SR))
    for k in range(2):
        t = T(0.3)
        y = sum(bp(noise(len(t)), f / 1.04, f * 1.04, 2) * np.exp(-t / tau) * g for f, tau, g in ((420, 0.07, 3.0), (760, 0.05, 2.6), (1150, 0.035, 2.0), (2300, 0.015, 1.2)))
        y += np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.03) * 0.25
        i = int(k * 0.26 * SR); out[i:i + len(t)] += y * (1 if k else 0.7)
    return verb(stereo(norm(out), 0, 0.2), 0.3, IR_HALL)

def s_type(n=6, span=0.6):
    d = span + 0.1
    out = np.zeros(int(d * SR))
    for k in range(n):
        t0 = span * k / max(1, n - 1) + RNG.uniform(-0.02, 0.02)
        t = T(0.04)
        y = bp(noise(len(t)), 1500, 6000) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 320 * t) * np.exp(-t / 0.008) * 0.5
        i = max(0, int(t0 * SR)); m = min(len(y), len(out) - i); out[i:i + m] += y[:m] * RNG.uniform(0.6, 1)
    return verb(stereo(norm(out), 0.1, 0.1), 0.1)

def s_chip(kind='coin'):
    def sq(f, d, decay=0.2):
        t = T(d)
        return np.sign(np.sin(chirp_phase(f if np.ndim(f) else np.full(len(t), f)))) * np.exp(-t / decay)
    if kind == 'coin':
        x = np.concatenate([sq(987.8, 0.06, 1), sq(1318.5, 0.22, 0.12)])
    elif kind == 'jump':
        t = T(0.16); x = np.sign(np.sin(chirp_phase(np.geomspace(380, 950, len(t))))) * np.exp(-t / 0.1)
    elif kind == 'hit':
        t = T(0.18); x = np.round(noise(len(t)) * 2) / 2 * np.exp(-t / 0.05) + np.sign(np.sin(chirp_phase(np.geomspace(260, 70, len(t))))) * np.exp(-t / 0.08)
    else:  # beep
        x = sq(1760, 0.08, 0.06)
    return stereo(lp(fade(norm(x) * 0.7, 0.001, 0.01), 7500), 0, 0.2)

def s_scan():
    t = T(0.22)
    f = 900 * 2 ** (t / 0.22)
    x = np.sin(chirp_phase(f)) * (np.sin(2 * np.pi * 40 * t) > 0) * np.minimum(1, (0.22 - t) / 0.02)
    return verb(stereo(lp(norm(x), 5000) * 0.8, 0, 0.3), 0.15)

def s_boom():
    """deep, dark hit for the frightening lines"""
    t = T(3.0)
    f = 32 + 20 * np.exp(-t / 0.2)
    x = np.sin(chirp_phase(f)) * np.exp(-t / 0.9) + lp(noise(len(t)), 220) * np.exp(-t / 0.35) * 0.5
    x += bp(noise(len(t)), 150, 700) * np.exp(-t / 0.25) * 1.4 + np.tanh(np.sin(chirp_phase(f * 3)) * 2) * np.exp(-t / 0.3) * 0.25
    return verb(stereo(fade(norm(np.tanh(x * 1.3)), 0.004, 0.2), 0, 0.5), 0.45, IR_HALL)

def s_boing():
    t = T(0.45)
    f = 220 * (1 + 0.5 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.15)) * (1 + 0.8 * np.exp(-t / 0.05))
    x = np.sin(chirp_phase(f)) * np.exp(-t / 0.16)
    return verb(stereo(fade(norm(x), 0.002, 0.04), 0, 0.2), 0.12)

def s_factory(d=12.0):
    t = T(d)
    hum = sum(np.sin(2 * np.pi * 50 * m * t) * a for m, a in ((1, 1), (2, 0.5), (3, 0.25))) * 0.35
    air = lp(noise(len(t)), 900) * 0.25
    x = hum + air
    beat = 0.5
    k = 0
    while k * beat < d - 0.3:
        tt = T(0.25)
        clank = sum(bp(noise(len(tt)), f / 1.05, f * 1.05) * np.exp(-tt / tau) for f, tau in ((520, 0.05), (1340, 0.03), (2900, 0.02))) * (1.1 if k % 4 == 0 else 0.6)
        i = int(k * beat * SR); m = min(len(tt), len(x) - i); x[i:i + m] += clank[:m]
        k += 1
    e = np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 1.0)
    return verb(stereo(norm(x * e), 0, 0.5), 0.3, IR_HALL)

def s_ocean(d=10.0):
    t = T(d)
    x = lp(noise(len(t)), 600) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.16 * t) ** 2) + lp(noise(len(t)), 150) * 0.6
    e = np.minimum(1, t / 1.5) * np.minimum(1, (d - t) / 2.0)
    return stereo(norm(x * e), 0, 0.8)

def s_strike():
    """a line struck through: swish + low tap"""
    a = s_swish(0.18, 1500, 7000, -0.4, 0.4)
    b = s_stamp()
    out = np.zeros((max(len(a), len(b) + int(0.12 * SR)), 2))
    out[:len(a)] += a * 0.8
    out[int(0.12 * SR):int(0.12 * SR) + len(b)] += b * 0.6
    return out

SOUNDS = {
    'pop': s_pop, 'tick': s_tick, 'click': s_click, 'swish': s_swish, 'whoosh': s_whoosh, 'whump': s_whump,
    'glitch': s_glitch, 'pixel': s_pixel, 'goo': s_goo, 'impact': s_impact, 'stamp': s_stamp, 'riser': s_riser,
    'swell': s_swell, 'drone': s_drone, 'shatter': s_shatter, 'crackle': s_crackle, 'coin': s_coin, 'cash': s_cash,
    'printer': s_printer, 'error': s_error, 'ding': s_ding, 'chime': s_chime, 'gavel': s_gavel, 'type': s_type,
    'chip': s_chip, 'scan': s_scan, 'boom': s_boom, 'boing': s_boing, 'factory': s_factory, 'ocean': s_ocean,
    'strike': s_strike,
}
# sounds whose event time marks their END (they lead into a moment)
END_ALIGNED = {'swell', 'riser'}


# ------------------------------------------------------------------ transitions and hand-picked beats
TRANS = {  # transition type -> (sound, gain, kwargs); the sound is centred on the transition midpoint
    'glitch': ('glitch', 0.42, {}), 'dip': ('whump', 0.5, {}), 'slice': ('swish', 0.4, {'d': 0.26}),
    'whip': ('whoosh', 0.5, {'d': 0.42, 'f0': 400, 'f1': 5000}), 'wipe': ('swish', 0.36, {'d': 0.4, 'f0': 600, 'f1': 4000}),
    'zoom': ('whoosh', 0.5, {'d': 0.55}), 'pixel': ('pixel', 0.28, {}), 'goo': ('goo', 0.6, {}), 'flash': ('impact', 0.45, {'size': 0.7}),
    'dissolve': ('swish', 0.12, {'d': 0.8, 'f0': 300, 'f1': 1200}), 'fade': (None, 0, {}), 'cut': (None, 0, {}),
}

# onsets that mean something specific in their scene: (scene, onset kind, (cue id, phrase, from, to) or None, sound, gain, kwargs)
OVERRIDES = [
    ('S40', 'pulse', None, 'stamp', 0.55, {}),                         # 収益化 / 禁止 stamps on the policy sheets
    ('S48', 'outBack', (84, '五冊', -0.4, 1.4), 'stamp', 0.42, {}),    # 削除 x5 on Jane Friedman's books
    ('S57', 'pulse', None, 'click', 0.35, {}),                          # Ctrl+C / Ctrl+V
    ('S89', 'pulse', None, None, 0, {}),                                # sticker thumps (curated stamps cover them)
    ('S96', 'pulse', None, 'tick', 0.06, {'pitch': 1.35}),              # the generate button spewing a card every 0.16 s
    ('S02', 'pulse', None, 'swish', 0.1, {'d': 0.16, 'f0': 1500, 'f1': 7000}),  # cards flipping over
]

# (sentence id, phrase or None, offset seconds, sound, gain, kwargs)
CUES = [
    # 00 open
    (0, 'あなた', -0.1, 'drone', 0.16, {'d': 9.0, 'f': 49.0, 'bright': 380}),
    (0, '本当に', -0.15, 'impact', 0.3, {'size': 0.6, 'bright': 0.3}),
    (2, '限りません', -0.1, 'glitch', 0.22, {'d': 0.2, 'seed': 5}),
    (4, 'アルゴリズム', -1.4, 'whoosh', 0.42, {'d': 1.3, 'f0': 3000, 'f1': 200, 'p0': 0.3, 'p1': -0.3}),
    # 01 definition
    (5, 'これが', -0.2, 'swell', 0.5, {'d': 1.0}),
    (5, 'これが', -0.2, 'impact', 0.55, {'size': 1.1}),
    (7, '二千二十五', 1.0, 'stamp', 0.5, {}),
    (7, '二千二十五', 1.05, 'chime', 0.18, {'f': 1318.5}),
    (10, '六本', -0.85, 'boing', 0.3, {}),
    (14, '瞬間', -0.15, 'stamp', 0.4, {}),
    (16, '責任者', -0.2, 'boom', 0.35, {}),
    # 02 scale
    (17, 'そして', -0.1, 'impact', 0.45, {'size': 0.9}),
    (19, '十', -0.4, 'ding', 0.3, {}),
    (22, '三分の一', -0.4, 'stamp', 0.45, {}),
    (23, '人間の文章', -0.6, 'ocean', 0.18, {'d': 11.5}),
    # 03 news
    (25, '三千七百', -0.2, 'impact', 0.35, {'size': 0.6}),
    (28, 'AIが一日', -0.3, 'type', 0.3, {'n': 14, 'span': 2.2}),
    (31, '広告費', -0.2, 'coin', 0.35, {}),
    # 04 looks
    (35, '私は', -0.3, 'ding', 0.3, {'f0': 1318.5}),
    (40, '丁寧', -0.3, 'strike', 0.3, {}),
    (41, '酔っ払い', -0.2, 'boing', 0.35, {}),
    (42, 'スーツ', -0.2, 'click', 0.4, {}),
    # 05 video
    (46, '二十', -0.2, 'stamp', 0.35, {}),
    (50, '二万ドル', -0.3, 'cash', 0.45, {}),
    (51, '内容は', -0.5, 'factory', 0.2, {'d': 13.0}),
    (55, '工場', -0.1, 'impact', 0.6, {'size': 1.2}),
    # 06 economics
    (58, '撮り直す', -0.3, 'error', 0.22, {}),
    (61, '当たれば', -0.3, 'chip', 0.35, {'kind': 'coin'}),
    (64, '三秒', -0.3, 'tick', 0.4, {}),
    (67, '床を', -0.3, 'whump', 0.4, {}),
    (71, '工場', -0.3, 'scan', 0.35, {}),
    # 07 music
    (73, '五十', -0.3, 'impact', 0.4, {'size': 0.8}),
    (74, '半分', -0.2, 'stamp', 0.45, {}),
    (76, '八十五', -0.3, 'error', 0.25, {}),
    (77, 'ゲーム', -0.4, 'chip', 0.4, {'kind': 'coin'}),
    (78, '削除', -0.2, 'whump', 0.45, {}),
    (81, '誰も聴いていない', -0.4, 'drone', 0.16, {'d': 10.0, 'f': 41.2, 'bright': 300}),
    # 08 books
    (88, '簡単', -0.15, 'pop', 0.5, {'pitch': 0.7}),
    (89, '激減', -0.4, 'whoosh', 0.4, {'d': 0.9, 'f0': 3000, 'f1': 250}),
    (90, '狂気', -0.3, 'boom', 0.3, {}),
    (93, '毒キノコ', -0.3, 'error', 0.25, {}),
    (94, '危険', -0.2, 'boom', 0.35, {}),
    # 09 court
    (97, 'そして', -0.3, 'whump', 0.35, {}),
    (98, '千三百九十五', -0.2, 'gavel', 0.5, {}),
    (101, 'そんな裁判はない', -0.2, 'error', 0.35, {}),
    (104, '事件番号', -0.6, 'type', 0.35, {'n': 16, 'span': 1.4}),
    (106, 'フォントサイズ', -0.2, 'click', 0.4, {}),
    # 10 science
    (108, '存在しない引用', -0.3, 'stamp', 0.4, {}),
    (110, '急増', -0.4, 'riser', 0.3, {'d': 0.8}),
    (115, '幽霊', -0.8, 'drone', 0.18, {'d': 8.0, 'f': 58.3, 'bright': 700}),
    (116, '本物', -0.2, 'impact', 0.4, {'size': 0.8}),
    # 11 model collapse
    (117, 'そして', 0.1, 'impact', 0.55, {'size': 1.2}),
    (117, 'そして', 0.1, 'drone', 0.22, {'d': 4.5, 'f': 43.65, 'bright': 380}),
    (120, '食べる', -0.2, 'goo', 0.3, {}),
    (122, '食べる', -0.2, 'goo', 0.3, {}),
    (124, 'モデル崩壊', -0.4, 'drone', 0.18, {'d': 12.0, 'f': 43.65, 'bright': 420}),
    (125, 'ジャックラビット', -0.2, 'boing', 0.4, {}),
    (127, '笑える', -0.1, 'pop', 0.35, {'pitch': 1.2}),
    (128, '怖い', -0.2, 'boom', 0.5, {}),
    (133, '世界そのもの', -0.4, 'drone', 0.18, {'d': 9.0, 'f': 36.7, 'bright': 350}),
    # 12 doubt
    (135, '本物まで', -0.2, 'boom', 0.35, {}),
    (137, '十三', -0.5, 'stamp', 0.4, {}),
    (138, '四十', -0.3, 'error', 0.3, {}),
    (140, 'AIでしょ', -0.3, 'glitch', 0.2, {'d': 0.25, 'seed': 9}),
    (146, 'AI以前', -0.2, 'swish', 0.3, {}),
    (147, 'AI以後', -0.2, 'swish', 0.3, {}),
    # 13 verification cost
    (149, '確認コスト', -0.2, 'impact', 0.45, {'size': 0.9}),
    (152, '十分', -0.3, 'tick', 0.35, {}),
    (153, '一時間', -0.3, 'tick', 0.35, {}),
    (154, '百円', -0.3, 'coin', 0.35, {}),
    (155, '自動化', -0.3, 'type', 0.3, {'n': 22, 'span': 1.8}),
    (156, 'ここが', -0.1, 'impact', 0.6, {'size': 1.2}),
    (156, 'ここが', -0.1, 'swell', 0.4, {'d': 1.2}),
    (158, '食べて', -0.3, 'goo', 0.3, {}),
    (163, '勝ち', -0.2, 'stamp', 0.4, {}),
    (166, '連打', -0.4, 'type', 0.4, {'n': 18, 'span': 1.2}),
    # 14 trust
    (168, '価値が上がる', -0.3, 'chime', 0.3, {'f': 1046.5}),
    (175, 'プレミアム', -0.4, 'chime', 0.35, {'f': 784.0}),
    (178, '信頼', -0.3, 'chime', 0.4, {'f': 659.3}),
    (178, '信頼', -0.3, 'swell', 0.3, {'d': 1.0}),
    (187, '確認', -0.3, 'scan', 0.3, {}),
    (188, '検証', -0.15, 'impact', 0.5, {'size': 1.0}),
    # 15 epilogue
    (189, '人間が作りました', -0.1, 'stamp', 0.4, {}),
    (189, '無添加', -0.15, 'stamp', 0.3, {'pan': 0.4}),
    (189, '手作り', -0.15, 'stamp', 0.3, {'pan': -0.4}),
    (189, 'マーケティング', -0.4, 'whoosh', 0.35, {'d': 1.2, 'f0': 2500, 'f1': 300}),
    (189, 'マーケティング', 0.3, 'pop', 0.45, {'pitch': 0.8}),
    (190, '月額', -0.3, 'cash', 0.45, {}),
    (191, 'そこまで', -0.1, 'printer', 0.3, {'d': 1.5}),
    (191, '客', -0.1, 'swish', 0.3, {'d': 0.4}),
    (192, 'ありません', -0.4, 'strike', 0.4, {}),
    (193, 'むしろ', -0.0, 'pop', 0.45, {'pitch': 0.75}),
    (194, 'そこそこ', -0.2, 'chip', 0.3, {'kind': 'beep'}),
    (194, 'ものすごい量', -0.4, 'riser', 0.35, {'d': 1.2}),
    (195, '百万', 0.05, 'impact', 0.45, {'size': 0.9}),
    (196, '怖い', -0.5, 'boom', 0.6, {}),
    (196, '怖い', -0.5, 'drone', 0.3, {'d': 2.6, 'f': 41.2, 'bright': 600}),
    (197, 'ちょっと', -0.1, 'boing', 0.35, {}),
    (198, '情報を捨てる', 0.15, 'stamp', 0.5, {}),
    (198, '情報を捨てる', 0.2, 'whump', 0.3, {}),
    (200, '判断する能力', -0.4, 'ding', 0.3, {'f0': 1174.7}),
    (202, '同じ値段', 0.0, 'stamp', 0.45, {}),
    (203, 'ゼロ', -0.85, 'crackle', 0.45, {'d': 0.9}),
    (203, 'ゼロ', 0.05, 'shatter', 0.7, {}),
    (203, 'ゼロ', 0.05, 'impact', 0.4, {'size': 0.8, 'bright': 0.3}),
    (204, 'ボタン', -0.1, 'click', 0.55, {}),
    (204, '簡単ではありません', 0.2, 'error', 0.4, {}),
    (204, '簡単ではありません', 0.4, 'boom', 0.45, {}),
]


# ------------------------------------------------------------------ assembly
def resolve_cues(queries):
    js = ("import fs from 'node:fs'; import { Cues } from './src/engine/cues.js';"
          "const c = new Cues(JSON.parse(fs.readFileSync('data/timeline.json','utf8')));"
          "const q = JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify(q.map(([i,s]) => c.at(i, s ?? undefined))));")
    out = subprocess.run(['node', '--input-type=module', '-e', js], input=json.dumps(queries), capture_output=True, text=True, check=True)
    if out.stderr.strip(): print(out.stderr.strip(), file=sys.stderr)
    return json.loads(out.stdout)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--onsets', default='out/sfx/onsets.json')
    ap.add_argument('--out', default='out/film/aislop_se.wav')
    ap.add_argument('--list', default='out/sfx/events.json')
    ap.add_argument('--level', type=float, default=-31.0, help='median short-term RMS of the active parts, dBFS (narration speaks at about -23)')
    a = ap.parse_args()
    scan = json.load(open(a.onsets))
    dur = scan['duration'] + 1.0
    mix = np.zeros((int(dur * SR) + SR * 4, 2))
    events = []

    # transitions, centred on the scene start
    for s in scan['scenes']:
        snd, g, kw = TRANS.get(s['trans'], (None, 0, {}))
        if snd and s['start'] > 0.5:
            events.append((s['start'], snd, g, dict(kw, **({'seed': int(s['start'] * 10)} if snd == 'glitch' else {})), 'center', 'trans:' + s['id']))

    # chapter cards: the "CHAPTER NN" line decodes with a little burst of keystrokes
    try:
        for c in json.load(open('out/film/chapters.json')):
            if c['n'] != '00': events.append((c['t0'] + 0.05, 'type', 0.16, {'n': 7, 'span': 0.45}, 'start', f"chapter:{c['n']}"))
    except FileNotFoundError:
        pass

    # hand-picked beats
    times = resolve_cues([[c[0], c[1]] for c in CUES])
    for c, t in zip(CUES, times):
        _, _, off, snd, g, kw = c
        events.append((t + off, snd, g, kw, 'end' if snd in END_ALIGNED else 'start', f'cue:{c[0]}:{c[1]}'))

    # animation onsets: pops for pop-ins, clicks for pulses, very soft ticks for text rises
    special = sorted(t for (t, *_rest) in events)
    def near(t, w):
        i = np.searchsorted(special, t)
        return any(abs(special[j] - t) < w for j in (i - 1, i) if 0 <= j < len(special))
    last = {'pop': -9, 'tick': -9, 'click': -9, 'stamp': -9}
    per_sec = {}
    ov_times = resolve_cues([[w[0], w[1]] for (_, _, w, *_r) in OVERRIDES if w])
    ov = []
    k = 0
    for (sc, kind, w, snd, g, kw) in OVERRIDES:
        win = None
        if w: win = (ov_times[k] + w[2], ov_times[k] + w[3]); k += 1
        ov.append((sc, kind, win, snd, g, kw))
    def override(o):
        for (sc, kind, win, snd, g, kw) in ov:
            if o['scene'] == sc and o['kind'] == kind and (win is None or win[0] <= o['T'] <= win[1]):
                return (snd, g, kw)
        return False
    for o in scan['onsets']:
        t, kind, d = o['T'], o['kind'], o['d']
        if t < 0.3: continue
        hit = override(o)
        if hit is not False:
            snd, g, kw = hit
            if snd: events.append((t, snd, g, kw, 'start', f'onset*:{o["scene"]}:{kind}'))
            continue
        if kind == 'outBack':
            snd, g, gap, kw = 'pop', 0.16 + 0.14 * min(1.0, d / 0.5), 0.07, {'pitch': float(np.clip(1.35 - d, 0.7, 1.3) * RNG.uniform(0.92, 1.08)), 'pan': float(RNG.uniform(-0.35, 0.35))}
        elif kind == 'pulse':
            snd, g, gap, kw = 'click', 0.3, 0.1, {'pan': float(RNG.uniform(-0.2, 0.2))}
        elif kind in ('outExpo', 'outBounce'):
            snd, g, gap, kw = 'tick', 0.08, 0.25, {'pitch': float(RNG.uniform(0.85, 1.15)), 'pan': float(RNG.uniform(-0.3, 0.3))}
        else:
            continue
        if t - last[snd] < gap or near(t, 0.12): continue
        sec = int(t * 2)
        per_sec[sec] = per_sec.get(sec, 0) + 1
        if per_sec[sec] > 3: continue
        last[snd] = t
        events.append((t, snd, g, kw, 'start', f'onset:{o["scene"]}:{kind}'))

    events.sort(key=lambda e: e[0])
    cache = {}
    for (t, snd, g, kw, align, why) in events:
        key = (snd, json.dumps(kw, sort_keys=True))
        if snd in ('pop', 'tick', 'click', 'glitch') or key not in cache:
            y = SOUNDS[snd](**kw)
            if snd not in ('pop', 'tick', 'click', 'glitch'): cache[key] = y
        else:
            y = cache[key]
        lead = 0.0
        if align == 'end': lead = len(y) / SR
        elif align == 'center':  # transitions: put the loudest part of the sound on the cut
            dd = kw.get('d', {'whoosh': 0.6, 'swish': 0.28, 'glitch': 0.35}.get(snd, 0))
            lead = {'whoosh': 0.62 * dd, 'swish': 0.7 * dd, 'glitch': 0.5 * dd, 'pixel': 0.07, 'goo': 0.15, 'whump': 0.05}.get(snd, 0.0)
        i = int(round((t - lead) * SR))
        if i < 0: y = y[-i:]; i = 0
        m = min(len(y), len(mix) - i)
        mix[i:i + m] += y[:m] * g

    mix = mix[:int(dur * SR)]
    # gentle bus limiting, then set the level against the narration (about -23 LUFS): the stem is meant to be
    # dropped in at 0 dB and sit roughly 7 LU under the voice
    peak = np.max(np.abs(mix)) or 1
    mix = np.tanh(mix / peak * 1.4) / np.tanh(1.4) * 0.7
    win = int(0.42 * SR)
    m = mix.mean(1) * np.sqrt(2)
    n = len(m) // win
    rms = 20 * np.log10(np.sqrt((m[:n * win].reshape(n, win) ** 2).mean(1)) + 1e-9)
    act = rms[rms > rms.max() - 45]
    med = float(np.median(act))
    gain = 10 ** ((a.level - med) / 20)
    mix *= min(gain, 0.97 / np.max(np.abs(mix)))
    print(f'median active RMS {med:.1f} dB -> {a.level:.1f} dB (x{gain:.2f}), peak {20 * np.log10(np.max(np.abs(mix))):.1f} dBFS')
    sf.write(a.out, mix.astype(np.float32), SR, subtype='PCM_24')
    json.dump([{'t': round(t, 3), 'sound': snd, 'gain': g, 'why': why} for (t, snd, g, kw, align, why) in events], open(a.list, 'w'), ensure_ascii=False, indent=0)
    kinds = {}
    for e in events: kinds[e[1]] = kinds.get(e[1], 0) + 1
    print(f'wrote {a.out}: {len(events)} events over {dur:.1f}s', kinds)

if __name__ == '__main__':
    main()
