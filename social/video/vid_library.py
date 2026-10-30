#!/usr/bin/env python3
"""DayScript TikTok library generator — 1080x1920 @30fps, 13–16 s, no filming, WITH audio.

Usage: python3 vid_library.py <smile line #> [<line #> ...]
  → video/dayscript-tok-NN.mp4   (NN = smile line number, 1-based, from card_gen.SMILES)

Template rotates by line number mod 3:
  0 → "cross it off"      : POV hook, a to-do list types itself and gets crossed off, smile line, CTA
  1 → "smile-line reveal" : a dated 'today' page, the line is handwritten in (Caveat), then set in type
  2 → "the method in one breath": plot / weather / margin — the DayScript method in three beats
Audio: an original soft lo-fi pad + plucks synthesized here (no licensing), pen ticks on cross-offs.
Fonts in ttf/ (Playfair-Italic, Playfair-SemiBoldItalic, Karla-Bold, Karla-Regular, Caveat).
"""
import sys, os, math, subprocess, struct, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from card_gen import SMILES

W, H, FPS = 1080, 1920, 30
CREAM=(247,243,234); INK=(38,50,75); COPPER=(181,113,61); GRAY=(138,133,120); RULE=(214,208,194); SAGE=(223,230,220)
PFI='ttf/Playfair-Italic.ttf'; PFSI='ttf/Playfair-SemiBoldItalic.ttf'; KAB='ttf/Karla-Bold.ttf'; KA='ttf/Karla-Regular.ttf'; HAND='ttf/Caveat.ttf'
_F={}
def font(p,s):
    k=(p,s)
    if k not in _F: _F[k]=ImageFont.truetype(p,s)
    return _F[k]
def ease(t): return 0.0 if t<=0 else 1.0 if t>=1 else (1-math.cos(t*math.pi))/2
def lerp(a,b,p): return tuple(int(a[i]+(b[i]-a[i])*p) for i in range(3))
def wrap(d,text,f,maxw):
    words,lines,cur=text.split(),[],''
    for w in words:
        t=(cur+' '+w).strip()
        if d.textlength(t,font=f)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def center_text(d,text,f,y,fill,maxw=880,lh=1.3):
    for l in wrap(d,text,f,maxw):
        d.text((W//2,y),l,font=f,fill=fill,anchor='mm'); y+=int(f.size*lh)
    return y
def fit_font(d,text,path,start,maxw,maxlines):
    s=start
    while True:
        f=font(path,s); ls=wrap(d,text,f,maxw)
        if len(ls)<=maxlines and all(d.textlength(l,font=f)<=maxw for l in ls): return f,ls
        s-=4

def base(mark_y=330, label=None):
    img=Image.new('RGB',(W,H),CREAM); d=ImageDraw.Draw(img)
    d.rectangle([60,60,W-60,H-60],outline=COPPER,width=3); d.rectangle([76,76,W-76,H-76],outline=COPPER,width=1)
    cx,cy=W//2,mark_y
    for r,w in ((88,5),(60,5)): d.arc([cx-r,cy-r,cx+r,cy+r],start=195,end=345,fill=COPPER,width=w)
    d.ellipse([cx-26,cy-38,cx+26,cy+14],fill=COPPER)
    if label:
        d.text((W//2,mark_y+110),label,font=font(KAB,26),fill=COPPER,anchor='mm')
        d.line([W//2-40,mark_y+140,W//2+40,mark_y+140],fill=COPPER,width=2)
    return img,d

def fade_text(d,text,path,size,y,p,fill=INK,maxw=880,lh=1.3,rise=24):
    if p<=0: return y
    p=ease(p); return center_text(d,text,font(path,size),y+int((1-p)*rise),lerp(CREAM,fill,p),maxw,lh)

def footer(d,p,cta='the 2026-27 planner · link in bio'):
    if p<=0: return
    p=ease(p)
    d.text((W//2,H-300),'D A Y S C R I P T',font=font(KAB,30),fill=lerp(CREAM,COPPER,p),anchor='mm')
    d.text((W//2,H-250),cta,font=font(KAB,24),fill=lerp(CREAM,GRAY,p),anchor='mm')
    d.text((W//2,H-200),'@dayscriptplanner',font=font(KAB,22),fill=lerp(CREAM,GRAY,p),anchor='mm')

def hand(d,text,x,y,size,p,fill=INK,anchor='lm'):
    f=font(HAND,size); n=len(text) if p>=1 else int(len(text)*max(0,p)+0.999)
    if n>0: d.text((x,y),text[:n],font=f,fill=fill,anchor=anchor)

# ---------------------------------------------------------------- template A: cross it off
TODO_SETS=[
 ["answer the three emails","20 minutes on the thing","call nonna back","water, not just coffee"],
 ["pickup at 3:15","send the proposal","move the body (gym counts)","buy milk. actually."],
 ["inbox to zero-ish","one hard phone call","fold the laundry mountain","read ten pages"],
]
def tmpl_crossoff(i,smile):
    todos=TODO_SETS[i%len(TODO_SETS)]
    hook='POV: the to-do list that actually gets done.'
    T=15.0; events=[]
    t_hook=(0.0,0.6); t_list0=2.2
    t_type=[(t_list0+k*0.9,0.7) for k in range(4)]
    t_cross=[(6.6+k*0.6,0.35) for k in range(4)]
    for s,_ in t_cross: events.append(('tick',s))
    t_smile=(9.6,0.9); t_cta=(12.0,0.6)
    def frame(t):
        img,d=base(330,'T O D A Y' if t>=t_list0-0.3 else None)
        if t<t_list0+0.3:
            fade_text(d,hook,PFSI,64,760 if t<t_list0-0.3 else 200,(t-t_hook[0])/t_hook[1] if t<t_list0-0.3 else 1,maxw=860,lh=1.25)
        y0=600
        for k,todo in enumerate(todos):
            y=y0+k*130; s,dur=t_type[k]; p=ease((t-s)/dur)
            if p<=0: continue
            d.rectangle([150,y-22,194,y+22],outline=INK,width=3)
            shown=todo[:int(len(todo)*p+0.999)] if p<1 else todo
            d.text((230,y),shown,font=font(PFI,54),fill=INK,anchor='lm')
            s,dur=t_cross[k]; q=ease((t-s)/dur)
            if q>0:
                w=d.textlength(todo,font=font(PFI,54)); d.line([230,y+4,230+w*q,y+4],fill=COPPER,width=7)
                if q>=1: d.line([158,y,170,y+14],fill=COPPER,width=5); d.line([170,y+14,188,y-12],fill=COPPER,width=5)
        s,dur=t_smile; p=(t-s)/dur
        if p>0:
            f,ls=fit_font(d,smile,PFI,62,820,3); y=1240+int((1-ease(p))*30); col=lerp(CREAM,INK,ease(p))
            for l in ls: d.text((W//2,y),l,font=f,fill=col,anchor='mm'); y+=int(f.size*1.42)
            d.line([W//2-70,y+10,W//2+70,y+10],fill=lerp(CREAM,COPPER,ease(p)),width=3)
        footer(d,(t-t_cta[0])/t_cta[1])
        return img
    return T,frame,events

# ---------------------------------------------------------------- template B: smile-line reveal
DATES=['tuesday, nov 3','thursday, nov 5','monday, nov 9','wednesday, nov 11']
def tmpl_reveal(i,smile):
    T=13.0; events=[('scratch',1.6)]
    date=DATES[i%len(DATES)]
    def frame(t):
        img,d=base(260)
        # page header
        fade_text(d,date,KAB,28,430,t/0.4,fill=COPPER)
        fade_text(d,'one line for the margin:',KA,34,490,(t-0.4)/0.4,fill=GRAY)
        # ruled lines
        for k in range(5):
            yy=640+k*120; a=ease((t-0.6-k*0.08)/0.3)
            if a>0: d.line([140,yy,W-140,yy],fill=lerp(CREAM,RULE,a),width=2)
        # handwriting reveal across rules
        if t>1.6:
            f=font(HAND,88); ls=wrap(d,smile,f,780)
            total=sum(len(l) for l in ls); shown=int(total*min(1,(t-1.6)/3.6)+0.999)
            for k,l in enumerate(ls):
                n=min(len(l),max(0,shown)); shown-=len(l)
                if n>0: d.text((150,640+k*120-22),l[:n],font=f,fill=INK,anchor='ls')
            # pen dot
            if t<5.2:
                cx=150+d.textlength(ls[min(len(ls)-1, int(len(ls)*min(1,(t-1.6)/3.6)))][:1],font=f)
        # set type version lands below
        p=(t-6.2)/0.8
        f,ls=fit_font(d,smile,PFI,60,860,2); y=1300
        if p>0:
            col=lerp(CREAM,INK,ease(p))
            for l in ls: d.text((W//2,y),l,font=f,fill=col,anchor='mm'); y+=int(f.size*1.42)
            d.line([W//2-70,y+10,W//2+70,y+10],fill=lerp(CREAM,COPPER,ease(p)),width=3)
        else: y+=int(f.size*1.42)*len(ls)
        fade_text(d,'48 of these. one per day. dated, hyperlinked, on your iPad.',KA,30,y+75,(t-7.6)/0.6,fill=GRAY,maxw=900)
        footer(d,(t-9.8)/0.6)
        return img
    return T,frame,events

# ---------------------------------------------------------------- template C: the method in one breath
def tmpl_method(i,smile):
    T=16.0; events=[('tick',4.6),('tick',8.2),('scratch',10.2)]
    def frame(t):
        img,d=base(250)
        fade_text(d,'the whole DayScript method, in one breath:',PFSI,56,430,t/0.6,maxw=860,lh=1.25)
        # beat 1: the plot
        s=t-1.4
        if s>0:
            fade_text(d,'1 · the plot',KAB,30,660,s/0.4,fill=COPPER)
            fade_text(d,'one thing that would make today a good day.',PFI,40,720,(s-0.2)/0.5,maxw=920)
            # circled item
            q=ease((t-3.2)/0.6)
            if q>0:
                hand(d,'finish the proposal',W//2,840,66,min(1,(t-3.2)/1.2),anchor='mm')
            r=ease((t-4.6)/0.5)
            if r>0:
                bw=d.textlength('finish the proposal',font=font(HAND,66))
                d.arc([W//2-bw/2-40,800,W//2+bw/2+40,882],start=0,end=int(360*r),fill=COPPER,width=5)
        # beat 2: the weather
        s=t-5.6
        if s>0:
            fade_text(d,'2 · the weather',KAB,30,960,s/0.4,fill=COPPER)
            fade_text(d,'everything else. it happens around the plot, not instead of it.',PFI,40,1020,(s-0.2)/0.5,maxw=920)
            q=(t-7.2)
            for k,w in enumerate(['emails','pickup','dentist','groceries','that call']):
                p=ease((q-k*0.18)/0.4)
                if p>0: d.text((200+k*170,1160),w,font=font(HAND,40),fill=lerp(CREAM,GRAY,p),anchor='mm')
        # beat 3: the margin
        s=t-8.6
        if s>0:
            fade_text(d,'3 · the margin',KAB,30,1270,s/0.4,fill=COPPER)
            fade_text(d,'one line about how it went. a word is enough.',PFI,40,1330,(s-0.2)/0.5,maxw=920)
            if t>10.2:
                f,ls=fit_font(d,smile,HAND,64,860,2); y=1440
                total=sum(len(l) for l in ls); shown=int(total*min(1,(t-10.2)/2.6)+0.999)
                for l in ls:
                    n=min(len(l),max(0,shown)); shown-=len(l)
                    if n>0: d.text((W//2,y),l[:n],font=f,fill=INK,anchor='mm')
                    y+=86
        footer(d,(t-13.2)/0.6,'planner now on etsy · the app in december · link in bio')
        return img
    return T,frame,events

TEMPLATES=[tmpl_crossoff,tmpl_reveal,tmpl_method]

# ---------------------------------------------------------------- audio
SR=44100
def synth_audio(T,events,seed):
    rng=np.random.default_rng(seed); n=int(T*SR); t=np.arange(n)/SR; out=np.zeros(n)
    # chord loop (lo-fi, slow): Fmaj7 Am7 Dm7 Gsus — soft pad + plucks, 68 bpm, 2 bars per chord
    chords=[[174.61,220.0,261.63,329.63],[220.0,261.63,329.63,392.0],[146.83,174.61,220.0,261.63],[196.0,261.63,293.66,392.0]]
    bar=60/68*4; seg=bar*2
    def env(x,a,r): return np.clip(x/a,0,1)*np.exp(-np.clip(x,0,None)/r)
    for ci in range(int(T/seg)+2):
        t0=ci*seg; ch=chords[ci%4]
        m=(t>=t0)&(t<t0+seg+1.5); tt=t[m]-t0
        e=np.clip(tt/1.2,0,1)*np.clip((seg+1.5-tt)/1.5,0,1)
        for f in ch:
            out[m]+=0.045*e*(np.sin(2*np.pi*f*tt)+0.35*np.sin(2*np.pi*f*2*tt+0.3))*(1+0.05*np.sin(2*np.pi*0.3*tt))
        # plucks: gentle arpeggio on 8ths
        for k in range(int(seg/(bar/8))):
            ts=t0+k*bar/8
            if rng.random()<0.55: continue
            f=ch[(k*3)%4]*2; mm=(t>=ts)&(t<ts+1.2); x=t[mm]-ts
            out[mm]+=0.09*env(x,0.004,0.28)*np.sin(2*np.pi*f*x)*(1+0.3*np.exp(-x*8))
        # soft kick on beats 1 and 3
        for k in range(int(seg/bar)*2):
            ts=t0+k*bar/2; mm=(t>=ts)&(t<ts+0.25); x=t[mm]-ts
            out[mm]+=0.16*np.exp(-x*18)*np.sin(2*np.pi*(55+40*np.exp(-x*30))*x)
    # vinyl hush
    out+=0.006*rng.standard_normal(n)
    # events: pen tick / scratch
    for kind,ts in events:
        if kind=='tick':
            mm=(t>=ts)&(t<ts+0.08); x=t[mm]-ts; out[mm]+=0.25*np.exp(-x*90)*rng.standard_normal(mm.sum())*np.sin(2*np.pi*1800*x)
        else:
            mm=(t>=ts)&(t<ts+0.9); x=t[mm]-ts; out[mm]+=0.06*np.exp(-x*3)*rng.standard_normal(mm.sum())*(0.5+0.5*np.sin(2*np.pi*7*x))
    # one-pole low-pass for warmth
    y=np.zeros(n); a=0.22
    acc=0.0
    for i in range(n):
        acc+=a*(out[i]-acc); y[i]=acc
    # fades + normalize
    fade=int(0.8*SR); y[:fade]*=np.linspace(0,1,fade); y[-fade:]*=np.linspace(1,0,fade)
    y=y/max(1e-6,np.abs(y).max())*0.7
    return (y*32767).astype(np.int16)

def write_wav(path,pcm):
    with wave.open(path,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def render(line_no):
    smile=SMILES[line_no-1]; tmpl=TEMPLATES[line_no%3]
    T,frame,events=tmpl(line_no,smile)
    os.makedirs('video',exist_ok=True); out=f'video/dayscript-tok-{line_no:02d}.mp4'
    wav=f'video/_a{line_no:02d}.wav'; write_wav(wav,synth_audio(T,events,line_no))
    ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-framerate',str(FPS),'-i','-',
        '-i',wav,'-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',out],stdin=subprocess.PIPE)
    for fi in range(int(T*FPS)):
        ff.stdin.write(frame(fi/FPS).tobytes())
    ff.stdin.close(); ff.wait(); os.remove(wav)
    if ff.returncode: raise SystemExit('ffmpeg failed')
    return out,tmpl.__name__,T

if __name__=='__main__':
    for a in sys.argv[1:]:
        print(render(int(a)))
