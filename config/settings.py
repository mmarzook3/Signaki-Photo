import os
from pathlib import Path
BASE_DIR=Path(__file__).resolve().parent.parent
SECRET_KEY=os.environ['DJANGO_SECRET_KEY']
DEBUG=False
ALLOWED_HOSTS=os.environ.get('ALLOWED_HOSTS','photo.signaki.com,localhost,127.0.0.1,testserver').split(',')
INSTALLED_APPS=['django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','proofs','rest_framework','drf_spectacular']
MIDDLEWARE=['django.middleware.security.SecurityMiddleware','whitenoise.middleware.WhiteNoiseMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','proofs.middleware.AccessHeaders','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF='config.urls'
TEMPLATES=[{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[BASE_DIR/'templates'],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION='config.wsgi.application'
DATA_DIR=Path(os.environ.get('DATA_DIR',BASE_DIR/'data'));DATA_DIR.mkdir(parents=True,exist_ok=True)
DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':DATA_DIR/'db.sqlite3','OPTIONS':{'timeout':20,'transaction_mode':'IMMEDIATE'}}}
AUTH_PASSWORD_VALIDATORS=[{'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':12}},{'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},{'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'}]
LANGUAGE_CODE='en-gb';TIME_ZONE='Europe/London';USE_I18N=True;USE_TZ=True
STATIC_URL='/static/';STATIC_ROOT=BASE_DIR/'staticfiles';STATICFILES_DIRS=[BASE_DIR/'static']
STORAGES={'default':{'BACKEND':'django.core.files.storage.FileSystemStorage'},'staticfiles':{'BACKEND':'whitenoise.storage.CompressedManifestStaticFilesStorage'}}
MEDIA_ROOT=DATA_DIR/'proofs'
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
LOGIN_URL='/login/';LOGIN_REDIRECT_URL='/'
SESSION_COOKIE_HTTPONLY=True;SESSION_COOKIE_SAMESITE='Lax';SESSION_COOKIE_AGE=28800
CSRF_COOKIE_HTTPONLY=True;CSRF_COOKIE_SAMESITE='Lax'
SESSION_COOKIE_SECURE=CSRF_COOKIE_SECURE=os.environ.get('COOKIE_SECURE','1')=='1'
SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')
SECURE_SSL_REDIRECT=os.environ.get('SSL_REDIRECT','1')=='1'
SECURE_REDIRECT_EXEMPT=[r'^healthz/$']
SECURE_HSTS_SECONDS=31536000 if SESSION_COOKIE_SECURE else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS=False;SECURE_HSTS_PRELOAD=False
SECURE_CONTENT_TYPE_NOSNIFF=True;SECURE_REFERRER_POLICY='same-origin';X_FRAME_OPTIONS='DENY'
CSRF_TRUSTED_ORIGINS=['https://'+os.environ.get('APP_DOMAIN','photo.signaki.com')]
FILE_UPLOAD_MAX_MEMORY_SIZE=2*1024*1024;DATA_UPLOAD_MAX_MEMORY_SIZE=64*1024*1024;DATA_UPLOAD_MAX_NUMBER_FILES=10
EMAIL_BACKEND='django.core.mail.backends.dummy.EmailBackend'
APP_VERSION=os.environ.get('APP_VERSION','development')

REST_FRAMEWORK = {"DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"], "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"], "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema"}
SPECTACULAR_SETTINGS = {"TITLE": "Signaki API", "VERSION": "1.0.0", "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"]}
NEW_UI_ENABLED = os.environ.get("NEW_UI_ENABLED", "0") == "1"

if (BASE_DIR / "frontend" / "dist").exists():
 STATICFILES_DIRS.append(("ui", BASE_DIR / "frontend" / "dist"))
