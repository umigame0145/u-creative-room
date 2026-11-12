"""Dummy article assets. Requires Python 3, Pillow 13 and FFmpeg/ffprobe.
Run from repository root: python3 scripts/generate-article-examples.py
No network or user data. CSV records muxed video packet timestamps, not invented rows.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features
import subprocess, json, csv, tempfile
out = Path('u-t-on/common/examples')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
def label(im, xy, text): ImageDraw.Draw(im).text(xy, text, font=font, fill='#19383c')
# One RGBA source: small text, fine lines, gradient and transparent margins.
im = Image.new('RGBA', (640,360))
d = ImageDraw.Draw(im)
d.rectangle((20,20,619,339),fill='white')
label(im,(32,32),'DUMMY / Sorano Sample / 012345')
for x in range(40,600):
    d.line((x,100,x,260),fill=(x%256,100,(600-x)%256,255))
for y in range(280,320,3): d.line((40,y,600,y),fill='#19383c',width=1)
im.save(out/'format-source.png')
white = Image.new('RGB',im.size,'white'); white.paste(im,mask=im.getchannel('A'))
white.save(out/'format-q75.jpg',quality=75,subsampling=2,optimize=False)
im.save(out/'format-q75.webp',quality=75,method=6)
rows=[]
for name in ['format-source.png','format-q75.jpg','format-q75.webp']:
    decoded=Image.open(out/name).convert('RGBA')
    decoded.crop((24,28,344,92)).resize((960,192),Image.Resampling.NEAREST).save(out/(name+'-zoom.png'))
    bg=Image.new('RGBA',im.size,'#65b8d0'); bg.alpha_composite(decoded); bg.convert('RGB').save(out/(name+'-background.png'))
    assert decoded.getpixel((0,0))[3] == (255 if name.endswith('.jpg') else 0)
    rows.append({'file':name,'bytes':(out/name).stat().st_size})
# Fictional support request: organize, remove identity before composing, then package.
clean=[]
for i, title in enumerate(['01 / Select item','02 / Save complete'],1):
    raw=Image.new('RGB',(640,360),'#f5f8f6'); label(raw,(24,24),'DUMMY help / Sorano Sample')
    label(raw,(24,100),title); label(raw,(24,180),'State: '+('selected' if i==1 else 'saved'))
    raw.save(out/f'workflow-{i}-input.png')
    safe=raw.copy(); ImageDraw.Draw(safe).rectangle((0,0,639,79),fill='#19383c')
    safe.save(out/f'workflow-{i}-redacted.png'); clean.append(safe)
joined=Image.new('RGB',(640,720),'white')
for i,safe in enumerate(clean): joined.paste(safe,(0,i*360))
joined.save(out/'workflow-joined.png')
# A4 150ppi, 10mm margin; Pillow reference output, not the site PDF engine.
pages=[]
for safe in clean:
    page=Image.new('RGB',(1240,1754),'white'); resized=safe.resize((1122,631),Image.Resampling.LANCZOS); page.paste(resized,(59,561)); pages.append(page)
pages[0].save(out/'workflow.pdf',save_all=True,append_images=pages[1:],resolution=150)
# Same 12 dummy frames, CFR=10fps vs VFR=0.1s then 0.2s. ffprobe supplies CSV.
with tempfile.TemporaryDirectory() as temp:
    t=Path(temp)
    for i in range(12):
        frame=Image.new('RGB',(320,180),'#f5f8f6'); label(frame,(20,60),f'DUMMY frame {i+1:02}'); frame.save(t/f'{i:02}.png')
    for mode,expr in [('cfr','N*100'),('vfr','if(lt(N,6),N*100,600+(N-6)*200)')]:
        dest=out/f'timing-{mode}.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-framerate','10','-i',str(t/'%02d.png'),'-vf',f"settb=1/1000,setpts='{expr}'",'-fps_mode','vfr','-c:v','libx264','-bf','0','-pix_fmt','yuv420p',str(dest)],check=True)
        data=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts_time,duration_time','-of','json',str(dest)]))['packets']
        times=[float(f['pts_time']) for f in data]
        assert len(times)==12
        deltas=[round(b-a,6) for a,b in zip(times,times[1:])]
        assert set(deltas)==({0.1} if mode=='cfr' else {0.1,0.2})
        with (out/f'timing-{mode}.csv').open('w',newline='') as f:
            w=csv.writer(f); w.writerow(['frame','pts_seconds','next_pts_delta_seconds','packet_duration_seconds'])
            for i,(stamp,frame) in enumerate(zip(times,data)):
                w.writerow([i+1,f'{stamp:.6f}',f'{deltas[i]:.6f}' if i<len(deltas) else '',frame.get('duration_time','')])
manifest={'images':rows,'Pillow':__import__('PIL').__version__,'libjpeg':features.version('jpg'),'libwebp':features.version('webp'),'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0]}
(out/'article-measurements.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
