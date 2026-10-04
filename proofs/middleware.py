from django.shortcuts import redirect
class AccessHeaders:
 def __init__(self,get_response):self.get_response=get_response
 def __call__(self,request):
  if request.user.is_authenticated and request.path not in ['/password/','/logout/','/healthz/','/api/v1/session/','/api/v1/password/'] and not request.path.startswith('/static/'):
   if hasattr(request.user,'profile') and request.user.profile.must_change_password:
    if request.path.startswith('/api/'):
     from django.http import JsonResponse
     return JsonResponse({'detail':'Choose a new password.','code':'password_required'},status=403)
    if not request.path.startswith('/app'):return redirect('password')
  response=self.get_response(request)
  response['Content-Security-Policy']="default-src 'self'; img-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  response['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
  response['X-Robots-Tag']='noindex, nofollow, noarchive'
  if not request.path.startswith('/static/'):response['Cache-Control']='private, no-store'
  return response
