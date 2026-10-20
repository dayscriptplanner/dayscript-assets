#!/usr/bin/env python3
"""DayScript 'cross it off' TikTok — 1080x1920, ~11 s, no filming.
A handwritten-style to-do list types itself in, each line gets crossed off with a
copper stroke, then the smile line lands and the end card shows the CTA.
Usage: python3 vid_crossoff.py <card#>  (smile line from card_gen.SMILES)
"""
import sys, os, math, subprocess
from PIL import Image, ImageDraw, ImageFont
from card_gen import SMILES

W, H, FPS = 1080, 1920, 30
CREAM = (247, 243, 234); INK = (38, 50, 75); COPPER = (181, 113, 61); GRAY = (138, 133, 120)
PFI = 'ttf/Playfair-Italic.ttf'; KAB = 'ttf/Karla-Bold.ttf'
TODOS = ["answer the three emails", "20 minutes on the thing", "call nonna back", "water, not just coffee"]

def ease(t): return 0 if t <= 0 else 1 if t >= 1 else (1 - math.cos(t * math.pi)) / 2

def frame_base():
    img = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(img)
    d.rectangle([60, 60, W-60, H-60], outline=COPPER, width=3)
    d.rectangle([76, 76, W-76, H-76], outline=COPPER, width=1)
    cx, cy = W//2, 330
    for r, w in ((88, 5), (60, 5)):
        d.arc([cx-r, cy-r, cx+r, cy+r], start=195, end=345, fill=COPPER, width=w)
    d.ellipse([cx-26, cy-38, cx+26, cy+14], fill=COPPER)
    kb = ImageFont.truetype(KAB, 26)
    d.text((W//2, 440), 'T O D A Y', font=kb, fill=COPPER, anchor='mm')
    d.line([W//2-40, 470, W//2+40, 470], fill=COPPER, width=2)
    return img, d

def render(i, out):
    smile = SMILES[i-1]
    fl = ImageFont.truetype(PFI, 54); fs = ImageFont.truetype(PFI, 62); kb = ImageFont.truetype(KAB, 30); kb2 = ImageFont.truetype(KAB, 24)
    os.makedirs('frames', exist_ok=True)
    for f in os.listdir('frames'): os.remove('frames/'+f)
    # timeline (seconds)
    t_type = [(0.4 + k*1.0, 0.7) for k in range(4)]      # line k types in over 0.7s
    t_cross = [(4.6 + k*0.55, 0.35) for k in range(4)]  # cross-off strokes
    t_smile = (7.2, 0.9); t_cta = (9.0, 0.6); total = 11.0
    n = int(total * FPS)
    for fi in range(n):
        t = fi / FPS
        img, d = frame_base()
        y0 = 600
        for k, todo in enumerate(TODOS):
            y = y0 + k*130
            # checkbox
            d.rectangle([150, y-22, 194, y+22], outline=INK, width=3)
            s, dur = t_type[k]; p = ease((t - s)/dur)
            shown = todo[:int(len(todo)*p)]
            if shown: d.text((230, y), shown, font=fl, fill=INK, anchor='lm')
            s, dur = t_cross[k]; p = ease((t - s)/dur)
            if p > 0:
                w = d.textlength(todo, font=fl)
                d.line([230, y+4, 230 + w*p, y+4], fill=COPPER, width=7)
                if p >= 1:
                    d.line([158, y, 170, y+14], fill=COPPER, width=5); d.line([170, y+14, 188, y-12], fill=COPPER, width=5)
        s, dur = t_smile; p = ease((t - s)/dur)
        if p > 0:
            # wrap smile line
            words, lines, cur = smile.split(), [], ''
            for w_ in words:
                tt = (cur+' '+w_).strip()
                if d.textlength(tt, font=fs) <= 820: cur = tt
                else: lines.append(cur); cur = w_
            lines.append(cur)
            y = 1240 + int((1-p)*30)
            col = tuple(int(CREAM[j] + (INK[j]-CREAM[j])*p) for j in range(3))
            for l in lines:
                d.text((W//2, y), l, font=fs, fill=col, anchor='mm'); y += 88
            d.line([W//2-70, y+10, W//2+70, y+10], fill=COPPER, width=3)
        s, dur = t_cta; p = ease((t - s)/dur)
        if p > 0:
            col = tuple(int(CREAM[j] + (COPPER[j]-CREAM[j])*p) for j in range(3))
            colg = tuple(int(CREAM[j] + (GRAY[j]-CREAM[j])*p) for j in range(3))
            d.text((W//2, H-300), 'D A Y S C R I P T', font=kb, fill=col, anchor='mm')
            d.text((W//2, H-250), 'the 2026-27 planner · link in bio', font=kb2, fill=colg, anchor='mm')
        img.save(f'frames/f{fi:04d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', 'frames/f%04d.png',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out], check=True)
    return out

if __name__ == '__main__':
    i = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    os.makedirs('video', exist_ok=True)
    print(render(i, f'video/dayscript-crossoff-{i:02d}.mp4'))
