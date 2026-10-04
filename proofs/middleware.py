from django.shortcuts import redirect
class AccessHeaders:
 def __init__(self,get_response):self.get_response=get_response
 def __call__(self,request):
  if request.user.is_authenticated and request.path not in ['/password/','/logout/','/healthz/'] and not request.path.startswith('/static/'):
   if hasattr(request.user,'profile') and request.user.profile.must_change_password:return redirect('password')
  response=self.get_response(request)
  response['Content-Security-Policy']="default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  response['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
  response['X-Robots-Tag']='noindex, nofollow, noarchive'
  if not request.path.startswith('/static/'):response['Cache-Control']='private, no-store'
  return response
