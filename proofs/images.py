"""Discard uploads; persist stripped, low-resolution review derivatives only."""
import io,uuid,warnings
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont,ImageCms
from django.conf import settings
from django.core.exceptions import ValidationError
Image.MAX_IMAGE_PIXELS=40_000_000
def font(size):
 for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','C:/Windows/Fonts/arial.ttf']:
  if Path(p).exists():return ImageFont.truetype(p,size)
 return ImageFont.load_default(size=size)
def derivative(image,label,width):
 image=image.copy();image.thumbnail((width,width),Image.Resampling.LANCZOS)
 w,h=image.size;overlay=Image.new('RGBA',image.size);draw=ImageDraw.Draw(overlay)
 size=max(12,round(w*.026));f=font(size)
 text='SCANAKI · REVIEW ONLY'
 # The repeated marks and photo name are pixels, not removable HTML overlays.
 step=max(130,round(w*.32))
 for y in range(-20,h, max(90,round(h*.22))):
  for x in range(-step//2,w,step):
   draw.text((x,y),text,font=f,fill=(255,255,255,100),stroke_width=1,stroke_fill=(20,20,20,65))
 image=Image.alpha_composite(image.convert('RGBA'),overlay).convert('RGB')
 draw=ImageDraw.Draw(image);bar=max(32,round(w*.05));draw.rectangle((0,h-bar,w,h),fill='#172823')
 label_font=font(max(12,round(w*.022)));caption=label[:110]
 while draw.textbbox((0,0),caption,font=label_font)[2]>w-20 and len(caption)>10:caption=caption[:-2]
 draw.text((10,h-bar+max(3,bar//5)),caption,font=label_font,fill='white')
 return image
def make_proofs(upload,label,store_clean=False):
 paths=[]
 if upload.size>25*1024*1024:raise ValidationError('Each photo must be smaller than 25 MB.')
 try:
  with warnings.catch_warnings():
   warnings.simplefilter('error',Image.DecompressionBombWarning)
   im=Image.open(upload)
   if im.format not in {'JPEG','PNG','WEBP'}:raise ValidationError('Use JPEG, PNG or WebP photographs. Videos are not supported.')
   if getattr(im,'is_animated',False):raise ValidationError('Animated images are not supported.')
   im.load();im=ImageOps.exif_transpose(im)
   if min(im.size)<100:raise ValidationError('Photo is too small to review.')
   profile=im.info.get('icc_profile')
   if profile:im=ImageCms.profileToProfile(im,ImageCms.ImageCmsProfile(io.BytesIO(profile)),ImageCms.createProfile('sRGB'),outputMode='RGB')
   else:im=im.convert('RGB')
   paths=[];root=Path(settings.MEDIA_ROOT);root.mkdir(parents=True,exist_ok=True)
   for width in [1280,480]:
    name=uuid.uuid4().hex+'.jpg';p=root/name
    derivative(im,label,width).save(p,format='JPEG',quality=72,optimize=True)
    paths.append(name)
   if store_clean:
    for width in [1280,480]:
     clean=im.copy();clean.thumbnail((width,width),Image.Resampling.LANCZOS)
     name=uuid.uuid4().hex+'.jpg';clean.save(root/name,format='JPEG',quality=72,optimize=True);paths.append(name)
   return paths
 except ValidationError:
  for name in paths:(Path(settings.MEDIA_ROOT)/name).unlink(missing_ok=True)
  raise
 except (OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning) as exc:
  for name in paths:(Path(settings.MEDIA_ROOT)/name).unlink(missing_ok=True)
  raise ValidationError('Cannot safely read this photograph.') from exc
