from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm
from .models import Property,Group,Photo,Comment
class CustomerForm(UserCreationForm):
 class Meta: model=get_user_model();fields=['username','first_name']
class PropertyForm(forms.ModelForm):
 class Meta:model=Property;fields=['name','address','customer','delivery_url','delivery_shared','archived']
 def clean(self):
  data=super().clean()
  from urllib.parse import urlsplit
  url=data.get('delivery_url')
  if url:
   parsed=urlsplit(url)
   if parsed.scheme!='https' or parsed.hostname!='drive.google.com' or parsed.username or parsed.password or parsed.netloc!='drive.google.com':
    self.add_error('delivery_url','Enter an HTTPS Google Drive link (drive.google.com).')
  if data.get('delivery_shared') and not url:self.add_error('delivery_url','Add the Google Drive link before sharing.')
  return data
 def __init__(self,*a,**kw):
  super().__init__(*a,**kw);self.fields['delivery_url'].label='High-quality photos — Google Drive link';self.fields['delivery_shared'].label='Share delivery link with customer';self.fields['customer'].queryset=get_user_model().objects.filter(is_staff=False,is_active=True)
class GroupForm(forms.ModelForm):
 class Meta:model=Group;fields=['name','position']
class PhotoForm(forms.ModelForm):
 class Meta:model=Photo;fields=['name','group','position','hidden']
 def __init__(self,*a,**kw):
  super().__init__(*a,**kw);self.fields['group'].queryset=Group.objects.filter(property=self.instance.property)
class CommentForm(forms.ModelForm):
 class Meta:model=Comment;fields=['text'];widgets={'text':forms.Textarea(attrs={'rows':3,'placeholder':'What would you like adjusted in this version?'})};labels={'text':'Your comment'}
