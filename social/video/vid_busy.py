#!/usr/bin/env python3
"""DayScript TikTok — "the planner that keeps up" (PDF now · app in December).
1080x1920 @30fps, ~22 s. Real planner pages (rendered from build_pdf.py sample) inside an
iPad frame; handwriting appears via Caveat; app teaser; end card. No filming.
"""
import os, math, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
CREAM=(247,243,234); INK=(38,50,75); COPPER=(181,113,61); GRAY=(138,133,120); SAGE=(223,230,220); BEZEL=(34,34,38)
PFI='ttf/Playfair-Italic.ttf'; PFSI='ttf/Playfair-SemiBoldItalic.ttf'; KAB='ttf/Karla-Bold.ttf'; KA='ttf/Karla-Regular.ttf'; HAND='ttf/Caveat.ttf'
PAGES={n: Image.open(f'pages/{n}.png').convert('RGB') for n in ['cover','month','week','day']}

def ease(t): return 0 if t<=0 else 1 if t>=1 else (1-math.cos(t*math.pi))/2
def lerp(a,b,p): return tuple(int(a[i]+(b[i]-a[i])*p) for i in range(3))
def font(p,s): return ImageFont.truetype(p,s)

def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t=(cur+' '+w).strip()
        if d.textlength(t,font=f)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines

def center_text(d, text, f, y, fill, maxw=900, lh=1.3):
    for l in wrap(d,text,f,maxw):
        d.text((W//2,y),l,font=f,fill=fill,anchor='mm'); y+=int(f.size*lh)
    return y

# iPad geometry: page 612x792 → shown at 840x1087 inside bezel
PAD_W, PAD_H = 900, 1150; PAD_X, PAD_Y = (W-PAD_W)//2, 420
PG_W, PG_H = 840, 1087; PG_X, PG_Y = PAD_X+30, PAD_Y+31

def page_img(name): return PAGES[name].resize((PG_W,PG_H), Image.LANCZOS)

def draw_ipad(img, page, slide=None):
    """page: PIL image sized PG_W x PG_H. slide: (next_page, progress) for a left slide."""
    d=ImageDraw.Draw(img)
    d.rounded_rectangle([PAD_X-6,PAD_Y-6,PAD_X+PAD_W+6,PAD_Y+PAD_H+6],radius=64,fill=(0,0,0))
    d.rounded_rectangle([PAD_X,PAD_Y,PAD_X+PAD_W,PAD_Y+PAD_H],radius=58,fill=BEZEL)
    screen=Image.new('RGB',(PG_W,PG_H),CREAM)
    if slide:
        nxt,p=slide; off=int(PG_W*ease(p))
        screen.paste(page,(-off,0)); screen.paste(nxt,(PG_W-off,0))
    else: screen.paste(page,(0,0))
    mask=Image.new('L',(PG_W,PG_H),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,PG_W,PG_H],radius=28,fill=255)
    img.paste(screen,(PG_X,PG_Y),mask)

# page-space coordinates (612x792 pts) → screen px
SX=PG_W/612; SY=PG_H/792
def pt(x,y_pdf): return (PG_X+x*SX, PG_Y+(792-y_pdf)*SY)

def hand(d, text, x, y, size, p, fill=INK):
    """handwriting reveal: characters appear left→right with slight baseline wobble"""
    f=font(HAND,size); n=int(len(text)*p+0.999) if p<1 else len(text)
    shown=text[:n]
    d.text((x,y),shown,font=f,fill=fill,anchor='lm')

def caption(d, text, y, p, size=46, fill=INK, f=None):
    if p<=0: return
    f=f or font(PFSI,size); col=lerp(CREAM,fill,ease(p))
    center_text(d,text,f,y+int((1-ease(p))*18),col)

def tap_ripple(d, cx, cy, p):
    if p<=0 or p>=1: return
    r=int(14+60*p); a=int(255*(1-p))
    d.ellipse([cx-r,cy-r,cx+r,cy+r],outline=lerp(CREAM,COPPER,1-p),width=5)

TOTAL=22.5
def render(out):
    os.makedirs('frames',exist_ok=True)
    for f_ in os.listdir('frames'): os.remove('frames/'+f_)
    month=page_img('month'); day=page_img('day'); week=page_img('week')
    n=int(TOTAL*FPS)
    for fi in range(n):
        t=fi/FPS
        img=Image.new('RGB',(W,H),CREAM); d=ImageDraw.Draw(img)
        # frame
        d.rectangle([40,40,W-40,H-40],outline=COPPER,width=3); d.rectangle([54,54,W-54,H-54],outline=COPPER,width=1)
        d.text((W//2,110),'D A Y S C R I P T',font=font(KAB,26),fill=COPPER,anchor='mm')

        # ---- Scene 1: hook 0–3.2s
        if t<3.2:
            p=ease(t/0.6)
            f=font(PFSI,70); col=lerp(CREAM,INK,p)
            y=center_text(d,'POV: you finally found a planner that keeps up with a busy woman’s day.',f,700,col,maxw=880,lh=1.25)
            if t>1.0:
                p2=ease((t-1.0)/0.5); d.line([W//2-80,y+30,W//2-80+int(160*p2),y+30],fill=COPPER,width=4)
            if t>1.5:
                caption(d,'dated. hyperlinked. on your iPad.',y+110,(t-1.5)/0.5,size=36,fill=GRAY,f=font(KA,36))
            img.save(f'frames/f{fi:04d}.png'); continue

        # ---- Scene 2: month → tap → day  (3.2–8.5)
        if t<8.5:
            s=t-3.2
            fade=ease(s/0.4)
            # tap on the 20 (col 1 (tue), row 3) : x0 = 54+14+1*68 ; y0 = cal_top-34-3*34 ; cal_top=748-118
            tx,ty=pt(54+14+1*68+6, 748-118-34-3*34+4)
            if s<1.9: draw_ipad(img,month)
            elif s<2.5: draw_ipad(img,month,slide=(day,(s-1.9)/0.6))
            else: draw_ipad(img,day)
            d=ImageDraw.Draw(img)
            if 1.2<s<1.9: tap_ripple(d,tx,ty,(s-1.2)/0.7)
            caption(d,'tap any date. it just goes there.',250,s/0.5,size=52)
            if s>2.7: caption(d,'518 pages that already know what day it is.',1660,(s-2.7)/0.5,size=38,fill=GRAY,f=font(KA,38))
            # handwriting on day page after landing
            if s>3.2:
                items=[('pickup 3:15',0.0),('send proposal',0.9),('call mom',1.8),('buy milk. actually.',2.7)]
                for k,(txt,st) in enumerate(items):
                    p=(s-3.2-st)/0.8
                    if p>0:
                        x,y=pt(54+292+24+16, 748-132-k*50+2)
                        hand(d,txt,x,y,44,min(1,p))
                # cross-offs
                for k,st in enumerate([4.2,4.5]):
                    p=(s-st)/0.3
                    if p>0:
                        x,y=pt(54+292+24+16, 748-132-k*50+2); w=d.textlength(['pickup 3:15','send proposal'][k],font=font(HAND,44))
                        d.line([x,y+2,x+int(w*ease(min(1,p))),y+2],fill=COPPER,width=4)
            img.save(f'frames/f{fi:04d}.png'); continue

        # ---- Scene 3: week page, win of the week (8.5–13)
        if t<13.0:
            s=t-8.5
            if s<0.5: draw_ipad(img,day,slide=(week,s/0.5))
            else: draw_ipad(img,week)
            d=ImageDraw.Draw(img)
            caption(d,'the week, in one glance.',250,(s-0.3)/0.5,size=52)
            if s>1.0:
                # morning/afternoon/night cells: gx=54+86, col_w=(486-86)/3 ; rows start top=748-56-12
                col_w=(486-86)/3; gx=54+86; top=748-56-12
                scribbles=[(0,0,'daycare'),(0,1,'standup'),(1,0,'gym?'),(1,2,'date night'),(2,1,'dentist'),(3,0,'proposal due')]
                for k,(row,col,txt) in enumerate(scribbles):
                    p=(s-1.0-k*0.35)/0.5
                    if p>0:
                        x,y=pt(gx+col*col_w+8, top-row*52-26); hand(d,txt,x,y,42,min(1,p))
            if s>3.1:
                # win of the week line: label at (54+320, by) where by = yy-6, yy = top-7*52
                top=748-56-12; by=top-7*52-6
                x,y=pt(54+320+4, by-14); hand(d,'survived tuesday.',x,y,38,min(1,(s-3.1)/1.0),fill=COPPER)
                caption(d,'a win on the week you won it.',1660,(s-3.1)/0.5,size=38,fill=GRAY,f=font(KA,38))
            img.save(f'frames/f{fi:04d}.png'); continue

        # ---- Scene 4: December app teaser (13–19)
        if t<19.0:
            s=t-13.0
            fade=ease(s/0.5)
            d.text((W//2,250),'coming december',font=font(KAB,30),fill=lerp(CREAM,COPPER,fade),anchor='mm')
            center_text(d,'the DayScript app',font(PFSI,78),340,lerp(CREAM,INK,fade))
            # phone
            PW_,PH_=520,1040; px,py=(W-PW_)//2,560
            d.rounded_rectangle([px-5,py-5,px+PW_+5,py+PH_+5],radius=70,fill=(0,0,0))
            d.rounded_rectangle([px,py,px+PW_,py+PH_],radius=64,fill=BEZEL)
            scr=day.resize((PW_-28,int((PW_-28)*PG_H/PG_W)),Image.LANCZOS)
            mask=Image.new('L',scr.size,0); ImageDraw.Draw(mask).rounded_rectangle([0,0,scr.size[0],scr.size[1]],radius=40,fill=255)
            inner=Image.new('RGB',(PW_-28,PH_-28),CREAM); inner.paste(scr,(0,0))
            m2=Image.new('L',inner.size,0); ImageDraw.Draw(m2).rounded_rectangle([0,0,inner.size[0],inner.size[1]],radius=48,fill=255)
            img.paste(inner,(px+14,py+14),m2); d=ImageDraw.Draw(img)
            # notification bubbles sliding in
            notes=[(1.0,'3:05 pm','school pickup in 10 — you’ve got this.'),(2.4,'7:30 am','today’s plot: the proposal. everything else is weather.'),(3.8,'9:00 pm','one line for the margin? a word is enough.')]
            for k,(st,when,msg) in enumerate(notes):
                p=ease((s-st)/0.5)
                if p<=0: continue
                bx=px+24; by=py+90+k*150+int((1-p)*40)
                d.rounded_rectangle([bx,by,bx+PW_-48,by+120],radius=24,fill=lerp(CREAM,(255,255,255),p),outline=lerp(CREAM,(220,214,200),p),width=2)
                d.ellipse([bx+18,by+18,bx+54,by+54],fill=lerp(CREAM,COPPER,p))
                d.text((bx+68,by+36),'DayScript · '+when,font=font(KAB,20),fill=lerp(CREAM,GRAY,p),anchor='lm')
                for i_,l in enumerate(wrap(d,msg,font(KA,24),PW_-110)[:2]):
                    d.text((bx+68,by+70+i_*28),l,font=font(KA,24),fill=lerp(CREAM,INK,p),anchor='lm')
            if s>4.6:
                caption(d,'syncs to your phone. reminds you, so you don’t have to remember.',1680,(s-4.6)/0.5,size=38,fill=INK,f=font(PFI,40))
            img.save(f'frames/f{fi:04d}.png'); continue

        # ---- Scene 5: end card (19–22.5)
        s=t-19.0; p=ease(s/0.6)
        cx,cy=W//2,620
        for r,wd in ((110,6),(76,6)):
            d.arc([cx-r,cy-r,cx+r,cy+r],start=195,end=345,fill=lerp(CREAM,COPPER,p),width=wd)
        d.ellipse([cx-32,cy-46,cx+32,cy+18],fill=lerp(CREAM,COPPER,p))
        center_text(d,'your day, in your own script.',font(PFSI,64),860,lerp(CREAM,INK,p))
        if s>0.6:
            p2=ease((s-0.6)/0.5)
            d.text((W//2,1060),'the 2026–27 planner · on Etsy now',font=font(KAB,32),fill=lerp(CREAM,COPPER,p2),anchor='mm')
            d.text((W//2,1120),'the app · december · waitlist in bio',font=font(KAB,32),fill=lerp(CREAM,GRAY,p2),anchor='mm')
        if s>1.3:
            p3=ease((s-1.3)/0.6)
            center_text(d,'made for the woman who runs everything — and still forgets the milk.',font(PFI,40),1380,lerp(CREAM,INK,p3),maxw=820)
        d.text((W//2,H-140),'@dayscriptplanner',font=font(KAB,26),fill=GRAY,anchor='mm')
        img.save(f'frames/f{fi:04d}.png')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(FPS),'-i','frames/f%04d.png','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',out],check=True)
    return out

if __name__=='__main__':
    os.makedirs('video',exist_ok=True); print(render('video/dayscript-keeps-up.mp4'))
