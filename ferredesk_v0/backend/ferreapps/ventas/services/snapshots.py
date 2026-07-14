import json

from django.core.serializers.json import DjangoJSONEncoder


def canonicalizar_snapshot(payload):
    return json.loads(json.dumps(payload, cls=DjangoJSONEncoder))
