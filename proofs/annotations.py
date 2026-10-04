"""Bounded, normalized geometry; no client markup is persisted or rendered."""
import math
from rest_framework.exceptions import ValidationError

def validate_annotations(value):
    if not isinstance(value, list) or len(value) > 8:
        raise ValidationError('Use at most eight annotations per comment.')
    for shape in value:
        if not isinstance(shape, dict) or set(shape) != {'kind', 'points', 'color'}:
            raise ValidationError('Invalid annotation.')
        if shape['kind'] not in {'pin', 'pen', 'rectangle', 'ellipse', 'arrow'} or shape['color'] not in {'#ffcc45', '#ff7185', '#70b7ff', '#4f5bff', '#58c99a', '#f2c94c', '#f2594b'}:
            raise ValidationError('Invalid annotation tool or colour.')
        points = shape['points']
        expected = 1 if shape['kind'] == 'pin' else 2
        if not isinstance(points, list) or not expected <= len(points) <= (500 if shape['kind'] == 'pen' else expected):
            raise ValidationError('Invalid annotation points.')
        for point in points:
            if not isinstance(point, list) or len(point) != 2 or any(type(n) not in (int, float) or not math.isfinite(n) or not 0 <= n <= 1 for n in point):
                raise ValidationError('Annotation coordinates must be within the image.')
    return value
