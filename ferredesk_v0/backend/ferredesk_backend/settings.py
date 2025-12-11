# ferredesk_backend/settings.py
import os

ENV = os.environ.get("ENVIRONMENT", "development").lower()

if ENV == "production":
    from .settings.prod import *
else:
    from .settings.dev import *
