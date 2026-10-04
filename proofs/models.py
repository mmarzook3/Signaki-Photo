import uuid,builtins
from django.db import models
from django.conf import settings
class Profile(models.Model):
 user=models.OneToOneField(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
 must_change_password=models.BooleanField(default=True)
class Property(models.Model):
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
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 photo=models.ForeignKey(Photo,on_delete=models.CASCADE,related_name='versions')
 number=models.PositiveIntegerField()
 image=models.CharField(max_length=100)
 thumb=models.CharField(max_length=100)
 label=models.CharField(max_length=140)
 review_revision=models.PositiveIntegerField(default=0)
 upload_request_id=models.UUIDField(null=True,blank=True,unique=True)
 status=models.CharField(max_length=12,default='pending',choices=[('pending','Awaiting review'),('approved','Approved'),('rejected','Rejected — not needed'),('review','Review — changes needed')])
 note=models.CharField(max_length=500,blank=True)
 created=models.DateTimeField(auto_now_add=True)
 class Meta:
  ordering=['-number'];constraints=[models.UniqueConstraint(fields=['photo','number'],name='version_photo_number')]
class Comment(models.Model):
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 version=models.ForeignKey(Version,on_delete=models.CASCADE,related_name='comments')
 author=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
 request_id=models.UUIDField(null=True,blank=True,unique=True)
 decision=models.CharField(max_length=12,blank=True,choices=[('approved','Approved'),('rejected','Rejected — not needed'),('review','Review — changes needed')])
 text=models.TextField(max_length=4000)
 resolved=models.BooleanField(default=False)
 created=models.DateTimeField(auto_now_add=True)
 class Meta:ordering=['created']
class LoginAttempt(models.Model):
 key=models.CharField(max_length=64,unique=True)
 failures=models.PositiveIntegerField(default=0)
 started=models.DateTimeField()
