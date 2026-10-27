"""Paint calm original canopy and grass textures from a Lightkeeper silhouette.

No extracted A Short Hike art is distributed. Its upward-facing leaf-card
construction was inspected as reference; shape/color artwork below is original.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'prototype/island/assets/foliage'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'prototype/island/.playtest/foliage-reference/lightkeeper-canopy-top.png'
SIZE = 512

source = Image.open(SOURCE).convert('RGBA')
mask = source.getchannel('A')
# Close the tiny polygon gaps, round the silhouette, and retain smooth AA.
mask = mask.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.MinFilter(11))
mask = mask.filter(ImageFilter.GaussianBlur(7))
mask = mask.point(lambda value: max(0, min(255, (value - 90) * 255 // 78)))
mask = mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
# Preserve the source canopy's broad mass while removing individual polygon
# corners. A low-frequency radial outline produces calm rounded leaf clusters.
box=mask.getbbox()
cx=(box[0]+box[2])/2;cy=(box[1]+box[3])/2
radii=[]
for sample in range(96):
    angle=sample/96*math.tau;last=0
    for radius in range(1,300):
        x=round(cx+math.cos(angle)*radius);y=round(cy+math.sin(angle)*radius)
        if 0<=x<SIZE and 0<=y<SIZE and mask.getpixel((x,y))>127:last=radius
    radii.append(last)
coefficients=[]
for frequency in range(7):
    coefficients.append((sum(radius*math.cos(frequency*i/96*math.tau) for i,radius in enumerate(radii))/96,
                         sum(radius*math.sin(frequency*i/96*math.tau) for i,radius in enumerate(radii))/96))
smooth=Image.new('L',(SIZE*4,SIZE*4))
points=[]
for sample in range(480):
    angle=sample/480*math.tau
    radius=coefficients[0][0]+sum(2*(a*math.cos(frequency*angle)+b*math.sin(frequency*angle)) for frequency,(a,b) in enumerate(coefficients[1:],1))
    points.append(((cx+math.cos(angle)*radius)*4,(cy+math.sin(angle)*radius)*4))
ImageDraw.Draw(smooth).polygon(points,fill=255)
mask=smooth.resize((SIZE,SIZE),Image.Resampling.LANCZOS)

def canopy(name, palette):
    image = Image.new('RGBA', (SIZE, SIZE), palette[0])
    # Large, authored lobes establish form without speckles or tiny polygons.
    for box, color in [
        ((30, 50, 370, 435), palette[1]),
        ((150, 50, 470, 350), palette[1]),
        ((80, 42, 320, 290), palette[2]),
        ((180, 118, 385, 330), palette[2]),
        ((28, 205, 225, 410), palette[1]),
        ((270, 290, 470, 472), palette[0]),
        ((110, 350, 295, 485), palette[0]),
    ]:
        layer = Image.new('L', (SIZE, SIZE))
        draw = ImageDraw.Draw(layer)
        draw.ellipse(box, fill=255)
        layer = layer.filter(ImageFilter.GaussianBlur(2))
        image.paste(Image.new('RGBA', (SIZE, SIZE), color), (0, 0), layer)
    image.putalpha(mask)
    image.save(OUT / name, optimize=True)

canopy('canopy-sage.png', ['#547a60', '#70966c', '#91af7f'])
canopy('canopy-amber.png', ['#b96e43', '#d58a4e', '#e9ac62'])
canopy('canopy-cedar.png', ['#315c52', '#477465', '#67917a'])

# A fuller rounded individual grass tuft. It is planted in small clusters and
# animated only at its tips; no dotted screen-space grass or sparkle shader.
grass = Image.new('RGBA', (384, 384), (134,162,93,0))
draw = ImageDraw.Draw(grass)
def curve(points, samples=24):
    result=[]
    for sample in range(samples+1):
        t=sample/samples;s=1-t
        result.append((s**3*points[0][0]+3*s*s*t*points[1][0]+3*s*t*t*points[2][0]+t**3*points[3][0],
                       s**3*points[0][1]+3*s*s*t*points[1][1]+3*s*t*t*points[2][1]+t**3*points[3][1]))
    return result
for path,base_radius,tip_radius,color in [
    ([(150,348),(116,304),(94,221),(70,170)],30,20,'#73955f'),
    ([(190,352),(183,270),(180,151),(197,87)],35,24,'#89a86c'),
    ([(230,347),(250,302),(275,237),(301,202)],31,22,'#7f9e64'),
]:
    # Rounded brush-stroke blades rather than another pointed wire tuft.
    centers=curve(path,48)
    for index,(x,y) in enumerate(centers):
        t=index/(len(centers)-1);radius=base_radius+(tip_radius-base_radius)*t
        draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=color)
grass = grass.filter(ImageFilter.GaussianBlur(.4))
grass.save(OUT / 'grass-tuft.png', optimize=True)

# A tiny broad-leaf ground sprig for the base of a tree or rock cluster.
sprig = Image.new('RGBA', (256, 256))
draw = ImageDraw.Draw(sprig)
draw.line([(128, 244), (128, 35)], fill='#60805c', width=12)
for box, color in [((48, 110, 135, 165), '#729366'), ((122, 65, 208, 120), '#89a576'), ((72, 30, 132, 94), '#97ae7e'), ((124, 160, 214, 215), '#729366')]:
    draw.ellipse(box, fill=color)
sprig.save(OUT / 'ground-sprig.png', optimize=True)
print('Painted', ', '.join(path.name for path in sorted(OUT.glob('*.png'))))
