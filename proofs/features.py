"""Gallery capabilities are server-enforced; defaults protect existing galleries."""
from copy import deepcopy
from rest_framework.exceptions import PermissionDenied, ValidationError

LABELS = [
    {'id': 'blue', 'name': 'Blue', 'color': '#6ea8ff', 'enabled': True},
    {'id': 'orange', 'name': 'Orange', 'color': '#f5b45e', 'enabled': True},
    {'id': 'green', 'name': 'Green', 'color': '#7fd3a3', 'enabled': True},
    {'id': 'purple', 'name': 'Purple', 'color': '#b79bff', 'enabled': True},
    {'id': 'red', 'name': 'Red', 'color': '#f28b99', 'enabled': True},
]
DEFAULTS = dict(view_only=False, gallery_status=True, asset_status=True, favorites=True,
    comments=True, annotations=True, color_labels=True, download=False, upload=False,
    file_information=True, workflow=True, versioning=True, watermark=True,
    approved_downloads_only=False, allowed_statuses=['approved','rejected','review','in_progress'], labels=LABELS)

def settings_for(prop):
    return {**deepcopy(DEFAULTS), **deepcopy(prop.review_settings or {})}

def allowed(user, prop, capability):
    if user.is_staff:
        return True
    settings = settings_for(prop)
    if settings['view_only'] and capability in {'gallery_status','asset_status','favorites','comments','annotations','color_labels','upload'}:
        return False
    return bool(settings.get(capability, False))

def require(user, prop, capability):
    if not allowed(user, prop, capability):
        raise PermissionDenied('This gallery does not allow this action.')

def visible_version(user, version):
    if not user.is_staff and not allowed(user, version.photo.property, 'versioning'):
        if version.photo.latest.pk != version.pk:
            raise PermissionDenied('Earlier versions are disabled for this gallery.')

def validate_settings(data):
    if not isinstance(data, dict) or set(data) - set(DEFAULTS):
        raise ValidationError('Unknown gallery setting.')
    result = deepcopy(data)
    for key, value in data.items():
        if key not in {'labels','allowed_statuses'} and type(value) is not bool:
            raise ValidationError({key:'Expected a boolean.'})
    if 'allowed_statuses' in data:
        values = data['allowed_statuses']
        if not isinstance(values,list) or not values or any(v not in DEFAULTS['allowed_statuses'] for v in values) or len(set(values)) != len(values) or 'approved' not in values:
            raise ValidationError('Choose unique review states including Approved.')
    if 'labels' in data:
        labels = data['labels']
        if not isinstance(labels,list) or len(labels)!=5 or {x.get('id') for x in labels if isinstance(x,dict)} != {x['id'] for x in LABELS}:
            raise ValidationError('Supply the five label definitions.')
        clean=[]
        for base in LABELS:
            item=next(x for x in labels if x['id']==base['id'])
            if not isinstance(item.get('name'),str) or not 1<=len(item['name'].strip())<=30 or type(item.get('enabled')) is not bool:
                raise ValidationError('Labels need a name (1–30 characters) and enabled flag.')
            clean.append({**base,'name':item['name'].strip(),'enabled':item['enabled']})
        result['labels']=clean
    return result

def apply_settings(prop, changes):
    result={**settings_for(prop),**validate_settings(changes)}
    if not result['watermark'] and prop.photos.filter(versions__clean_image='').exists():
        raise ValidationError({'watermark':'Older proofs have baked-in watermarks. This gallery contains legacy versions that must retain their watermarks. New galleries support switching.'})
    prop.review_settings=result
    prop.save(update_fields=['review_settings'])
    return result

def standard_presets():
    view={**deepcopy(DEFAULTS),'view_only':True,'gallery_status':False,'asset_status':False,'favorites':False,'comments':False,'annotations':False,'color_labels':False,'workflow':False,'versioning':False}
    return [
        {'id':'view-only','name':'View-Only','config':view,'standard':True},
        {'id':'download','name':'Download','config':{**view,'download':True},'standard':True},
        {'id':'review','name':'Review','config':{**deepcopy(DEFAULTS),'workflow':False},'standard':True},
        {'id':'workflow','name':'Workflow','config':deepcopy(DEFAULTS),'standard':True},
    ]
