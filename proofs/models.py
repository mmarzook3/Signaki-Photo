import uuid,builtins
from django.db import models
from django.conf import settings
class Profile(models.Model):
 user=models.OneToOneField(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
 must_change_password=models.BooleanField(default=True)
class Property(models.Model):
 review_settings=models.JSONField(default=dict,db_default={},blank=True)
 review_status=models.CharField(max_length=12,default="pending",db_default="pending")
 review_revision=models.PositiveIntegerField(default=0,db_default=0)
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 name=models.CharField(max_length=160)
 address=models.CharField(max_length=240,blank=True)
 customer=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='properties')
 delivery_url=models.URLField(blank=True,max_length=1000)
 delivery_shared=models.BooleanField(default=False)
 archived=models.BooleanField(default=False)
 created=models.DateTimeField(auto_now_add=True)
 class Meta:ordering=['-created']
class Group(models.Model):
 property=models.ForeignKey(Property,on_delete=models.CASCADE,related_name='groups')
 name=models.CharField(max_length=100)
 position=models.PositiveIntegerField(default=0)
 class Meta:
  ordering=['position','name'];constraints=[models.UniqueConstraint(fields=['property','name'],name='group_property_name')]
class Photo(models.Model):
 color_label=models.CharField(max_length=12,blank=True,db_default="")
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 property=models.ForeignKey(Property,on_delete=models.CASCADE,related_name='photos')
 group=models.ForeignKey(Group,on_delete=models.SET_NULL,null=True,blank=True,related_name='photos')
 name=models.CharField(max_length=140)
 hidden=models.BooleanField(default=False)
 position=models.PositiveIntegerField(default=0)
 created=models.DateTimeField(auto_now_add=True)
 class Meta:
  ordering=['position','name'];constraints=[models.UniqueConstraint(fields=['property','name'],name='photo_property_name')]
 @builtins.property
 def latest(self):return self.versions.first()
class Version(models.Model):
 media_kind=models.CharField(max_length=8,default='image',db_default='image')
 processing=models.CharField(max_length=12,default='ready',db_default='ready')
 duration=models.FloatField(default=0,db_default=0)
 source_file=models.CharField(max_length=100,blank=True,default='',db_default='')
 processing_error=models.CharField(max_length=200,blank=True,default='',db_default='')
 processing_started=models.DateTimeField(null=True,blank=True)
 clean_image=models.CharField(max_length=100,blank=True,db_default="")
 clean_thumb=models.CharField(max_length=100,blank=True,db_default="")
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 photo=models.ForeignKey(Photo,on_delete=models.CASCADE,related_name='versions')
 number=models.PositiveIntegerField()
 image=models.CharField(max_length=100)
 thumb=models.CharField(max_length=100)
 label=models.CharField(max_length=140)
 review_revision=models.PositiveIntegerField(default=0)
 upload_request_id=models.UUIDField(null=True,blank=True,unique=True)
 status=models.CharField(max_length=12,default='pending',choices=[('pending','Awaiting review'),('approved','Approved'),('rejected','Rejected — not needed'),('review','Review — changes needed'),('in_progress','In progress')])
 note=models.CharField(max_length=500,blank=True)
 created=models.DateTimeField(auto_now_add=True)
 class Meta:
  ordering=['-number'];constraints=[models.UniqueConstraint(fields=['photo','number'],name='version_photo_number')]
class Comment(models.Model):
 timestamp_seconds=models.FloatField(null=True,blank=True)
 annotations=models.JSONField(default=list,blank=True,db_default=[])
 parent=models.ForeignKey("self",null=True,blank=True,on_delete=models.CASCADE,related_name="replies")
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 version=models.ForeignKey(Version,on_delete=models.CASCADE,related_name='comments')
 author=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
 request_id=models.UUIDField(null=True,blank=True,unique=True)
 decision=models.CharField(max_length=12,blank=True,choices=[('approved','Approved'),('rejected','Rejected — not needed'),('review','Review — changes needed'),('in_progress','In progress')])
 text=models.TextField(max_length=4000)
 resolved=models.BooleanField(default=False)
 created=models.DateTimeField(auto_now_add=True)
 class Meta:ordering=['created']
class LoginAttempt(models.Model):
 key=models.CharField(max_length=64,unique=True)
 failures=models.PositiveIntegerField(default=0)
 started=models.DateTimeField()

class Favorite(models.Model):
 user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
 photo=models.ForeignKey(Photo,on_delete=models.CASCADE,related_name='favorites')
 class Meta:constraints=[models.UniqueConstraint(fields=['user','photo'],name='favorite_user_photo')]
class SettingsPreset(models.Model):
 name=models.CharField(max_length=80,unique=True)
 config=models.JSONField(default=dict)
 created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
 created=models.DateTimeField(auto_now_add=True)
class GalleryDecision(models.Model):
 property=models.ForeignKey(Property,on_delete=models.CASCADE,related_name='decisions')
 author=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
 status=models.CharField(max_length=12)
 reason=models.CharField(max_length=4000,blank=True)
 request_id=models.UUIDField(unique=True)
 created=models.DateTimeField(auto_now_add=True)
