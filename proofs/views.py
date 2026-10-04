import hashlib,logging,uuid
from datetime import timedelta
from pathlib import Path
from functools import wraps
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate,login,logout,update_session_auth_hash,get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm,PasswordChangeForm,SetPasswordForm
from django.core.exceptions import ValidationError
from django.db import transaction,IntegrityError
from django.db.models import Count,Max,Prefetch,Q
from django.http import FileResponse,Http404,HttpResponse,JsonResponse
from django.shortcuts import render,redirect,get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST,require_GET
from .models import Property,Photo,Version,Comment,Group,Profile,LoginAttempt
from .forms import CustomerForm,PropertyForm,GroupForm,PhotoForm,CommentForm
from .images import make_proofs

def staff(view):
 @login_required
 @wraps(view)
 def wrapped(request,*a,**kw):
  if not request.user.is_staff:raise Http404
  return view(request,*a,**kw)
 return wrapped
def properties(request):
 qs=Property.objects.all()
 return qs if request.user.is_staff else qs.filter(customer=request.user,archived=False)
def photos(request):
 qs=Photo.objects.filter(property__in=properties(request))
 return qs if request.user.is_staff else qs.filter(hidden=False)
def valid_uuid(value):
 try:return uuid.UUID(str(value))
 except (ValueError,TypeError,AttributeError):raise Http404
@require_GET
def health(request):return JsonResponse({'status':'ok','version':settings.APP_VERSION})
def login_view(request):
 if request.user.is_authenticated:return redirect('home')
 form=AuthenticationForm(request,data=request.POST or None)
 if request.method=='POST':
  # Two persistent buckets prevent easy per-worker bypass or username rotation.
  addr=request.META.get('HTTP_X_FORWARDED_FOR',request.META.get('REMOTE_ADDR','unknown')).split(',')[0].strip()
  user=request.POST.get('username','').casefold()[:150]
  keys=[hashlib.sha256(('ip:'+addr).encode()).hexdigest(),hashlib.sha256(('user:'+user).encode()).hexdigest()]
  now=timezone.now();blocked=False
  with transaction.atomic():
   LoginAttempt.objects.filter(started__lt=now-timedelta(days=1)).delete()
   for key in keys:
    a,_=LoginAttempt.objects.get_or_create(key=key,defaults={'started':now})
    if a.started<now-timedelta(minutes=15):a.failures=0;a.started=now;a.save()
    if a.failures>=10:blocked=True
  if blocked:
   form.add_error(None,'Too many attempts. Please try again in 15 minutes.')
   return render(request,'login.html',{'form':form},status=429)
  if form.is_valid():
   login(request,form.get_user());LoginAttempt.objects.filter(key=keys[1]).delete();return redirect('home')
  with transaction.atomic():
   for key in keys:
    a=LoginAttempt.objects.get(key=key);a.failures+=1;a.save()
 return render(request,'login.html',{'form':form})
@require_POST
def logout_view(request):logout(request);return redirect('login')
@login_required
def password_view(request):
 form=PasswordChangeForm(request.user,request.POST or None)
 if request.method=='POST' and form.is_valid():
  user=form.save();update_session_auth_hash(request,user);Profile.objects.update_or_create(user=user,defaults={'must_change_password':False});messages.success(request,'Password updated.');return redirect('home')
 return render(request,'form.html',{'form':form,'title':'Choose a new password','subtitle':'Use at least 12 characters.','button':'Save password'})
@login_required
def home(request):
 count=Count('photos') if request.user.is_staff else Count('photos',filter=Q(photos__hidden=False))
 qs=properties(request).annotate(photo_count=count).select_related('customer')
 cards=[]
 for p in qs:
  cover=photos(request).filter(property=p).prefetch_related('versions').first()
  cards.append((p,cover.latest if cover else None))
 return render(request,'home.html',{'cards':cards})
@staff
def customers(request):
 form=CustomerForm(request.POST or None)
 if request.method=='POST' and form.is_valid():
  with transaction.atomic():user=form.save();Profile.objects.create(user=user)
  messages.success(request,'Customer created. Share their username and temporary password privately.');return redirect('customers')
 return render(request,'customers.html',{'form':form,'customers':get_user_model().objects.filter(is_staff=False).order_by('username')})
@staff
def customer_edit(request,pk):
 customer=get_object_or_404(get_user_model(),pk=pk,is_staff=False)
 form=SetPasswordForm(customer,request.POST if request.method=='POST' and request.POST.get('action')=='password' else None)
 if request.method=='POST':
  if request.POST.get('action')=='toggle':customer.is_active=not customer.is_active;customer.save();messages.success(request,'Customer access updated.');return redirect('customers')
  if form.is_valid():form.save();Profile.objects.update_or_create(user=customer,defaults={'must_change_password':True});messages.success(request,'Temporary password changed; previous sessions are invalidated.');return redirect('customers')
 return render(request,'customer_edit.html',{'form':form,'customer':customer})
@staff
def property_new(request):
 form=PropertyForm(request.POST or None)
 if request.method=='POST' and form.is_valid():p=form.save();return redirect('property',pk=p.pk)
 return render(request,'form.html',{'form':form,'title':'New property','button':'Create property'})
@staff
def property_edit(request,pk):
 p=get_object_or_404(Property,pk=pk);form=PropertyForm(request.POST or None,instance=p)
 if request.method=='POST' and form.is_valid():form.save();messages.success(request,'Property updated.');return redirect('property',pk=pk)
 return render(request,'form.html',{'form':form,'title':'Property settings','button':'Save changes'})
@login_required
def property_detail(request,pk):
 p=get_object_or_404(properties(request),pk=pk)
 mode='grouped' if request.GET.get('view')=='grouped' else 'all'
 qs=list(photos(request).filter(property=p).prefetch_related('versions').select_related('group'))
 counts={key:0 for key in ['pending','approved','review','rejected']}
 for item in qs:
  if item.latest:counts[item.latest.status]+=1
 reviewed=sum(counts.values())-counts['pending']
 sections=[]
 if mode=='grouped':
  for group in p.groups.all():sections.append((group.name,[x for x in qs if x.group_id==group.id]))
  ungrouped=[x for x in qs if x.group_id is None]
  if ungrouped:sections.append(('Ungrouped',ungrouped))
 else:sections=[('All photos',qs)]
 return render(request,'property.html',{'property':p,'sections':sections,'mode':mode,'count':len(qs),'groups':p.groups.all(),'counts':counts,'reviewed':reviewed})
@staff
def group_new(request,pk):
 p=get_object_or_404(Property,pk=pk);form=GroupForm(request.POST or None)
 if request.method=='POST' and form.is_valid():
  if p.groups.filter(name=form.cleaned_data['name']).exists():form.add_error('name','This group already exists.')
  else:g=form.save(commit=False);g.property=p;g.save();return redirect('property',pk=pk)
 return render(request,'form.html',{'form':form,'title':'Add a room or group','button':'Add group'})
def add_version(photo,upload,note=''):
 paths=[]
 try:
  with transaction.atomic():
   photo=Photo.objects.select_for_update().get(pk=photo.pk)
   number=(photo.versions.aggregate(n=Max('number'))['n'] or 0)+1
   label=f'{photo.name} · v{number}'
   paths=make_proofs(upload,label)
   return Version.objects.create(photo=photo,number=number,image=paths[0],thumb=paths[1],label=label,note=note[:500])
 except Exception:
  for name in paths:(Path(settings.MEDIA_ROOT)/name).unlink(missing_ok=True)
  raise
@staff
@require_POST
def upload(request,pk):
 p=get_object_or_404(Property,pk=pk);group=None
 if request.POST.get('group'):
  try:group_id=int(request.POST['group'])
  except ValueError:raise Http404
  group=get_object_or_404(Group,pk=group_id,property=p)
 files=request.FILES.getlist('photos')
 if not files:messages.error(request,'Choose photographs to upload.')
 for file in files:
  name=Path(file.name).stem[:140]
  if p.photos.filter(name=name).exists():messages.error(request,f'{name}: already exists. Open the photo to add a new version.');continue
  photo=Photo.objects.create(property=p,group=group,name=name)
  try:add_version(photo,file)
  except ValidationError as exc:photo.delete();messages.error(request,f'{name}: {exc.messages[0]}')
  except Exception:photo.delete();logging.exception('Photo conversion failed');messages.error(request,f'{name}: upload could not be completed.')
  else:messages.success(request,f'{name}: watermarked proof added.')
 return redirect('property',pk=pk)
@staff
@require_POST
def version_upload(request,pk):
 photo=get_object_or_404(Photo,pk=pk)
 if 'photo' not in request.FILES:messages.error(request,'Choose a photograph.')
 else:
  try:add_version(photo,request.FILES['photo'],request.POST.get('note',''))
  except ValidationError as exc:messages.error(request,exc.messages[0])
  else:messages.success(request,'New version added. Earlier versions and comments are retained.')
 return redirect('photo',pk=pk)
@staff
def photo_edit(request,pk):
 photo=get_object_or_404(Photo,pk=pk);form=PhotoForm(request.POST or None,instance=photo)
 if request.method=='POST' and form.is_valid():form.save();return redirect('photo',pk=pk)
 return render(request,'form.html',{'form':form,'title':'Photo settings','subtitle':'Existing versions keep the name burned into their proof. New versions use the updated name.','button':'Save changes'})
@login_required
def photo_detail(request,pk):
 photo=get_object_or_404(photos(request),pk=pk);versions=photo.versions.all()
 selected=get_object_or_404(versions,pk=valid_uuid(request.GET['version'])) if request.GET.get('version') else versions.first()
 if not selected:raise Http404
 form=CommentForm(request.POST or None)
 if request.method=='POST' and request.POST.get('decision'):
  if request.user.is_staff:raise Http404
  target=get_object_or_404(versions,pk=valid_uuid(request.POST.get('version')))
  decision=request.POST['decision'];reason=request.POST.get('text','').strip()
  if decision not in {'approved','rejected','review'}:raise Http404
  if len(reason)>4000 or (decision!='approved' and not reason):
   messages.error(request,'Please explain why this photo is not needed or what changes you need (up to 4,000 characters).')
  else:
   with transaction.atomic():
    target.status=decision;target.save(update_fields=['status'])
    Comment.objects.create(version=target,author=request.user,decision=decision,text=reason or 'Photo approved.',resolved=decision=='approved')
   messages.success(request,'Photo decision saved for version '+str(target.number)+'.')
  return redirect(str(request.path)+'?version='+str(target.pk)+('&view=grouped' if request.GET.get('view')=='grouped' else ''))
 if request.method=='POST' and form.is_valid():
  # The posted version is checked within the already-authorised photo.
  target=get_object_or_404(versions,pk=valid_uuid(request.POST.get('version')))
  c=form.save(commit=False);c.version=target;c.author=request.user;c.save();messages.success(request,'Comment saved on version '+str(target.number)+'.')
  return redirect(str(request.path)+'?version='+str(target.pk)+('&view=grouped' if request.GET.get('view')=='grouped' else ''))
 comments=Comment.objects.filter(version__photo=photo).select_related('version','author')
 grouped=request.GET.get('view')=='grouped'
 sequence=photos(request).filter(property_id=photo.property_id,versions__isnull=False).distinct()
 if grouped:sequence=sequence.filter(group_id=photo.group_id)
 items=list(sequence.prefetch_related('versions'));ids=[item.pk for item in items];index=ids.index(photo.pk)
 filmstrip=items[max(0,index-4):index+5]
 return render(request,'photo.html',{'photo':photo,'versions':versions,'selected':selected,'comments':comments,'form':form,'grouped':grouped,'previous':ids[index-1] if index else None,'next':ids[index+1] if index+1<len(ids) else None,'photo_index':index+1,'photo_total':len(ids),'filmstrip':filmstrip})
@staff
@require_POST
def resolve_comment(request,pk):
 c=get_object_or_404(Comment,pk=pk);c.resolved=not c.resolved;c.save();return redirect('photo',pk=c.version.photo_id)
@staff
def feedback(request):
 qs=Comment.objects.select_related('version__photo__property','author').order_by('-created')
 if request.GET.get('status')!='all':qs=qs.filter(resolved=False)
 from django.core.paginator import Paginator
 return render(request,'feedback.html',{'page':Paginator(qs,50).get_page(request.GET.get('page')),'status':request.GET.get('status','open')})
@login_required
@require_GET
def proof(request,pk,size):
 if size not in {'image','thumb'}:raise Http404
 v=get_object_or_404(Version.objects.filter(photo__in=photos(request)),pk=pk)
 path=Path(settings.MEDIA_ROOT)/getattr(v,size)
 if not path.is_file():raise Http404
 response=FileResponse(path.open('rb'),content_type='image/jpeg');response['Content-Disposition']='inline; filename="review-proof.jpg"';return response
