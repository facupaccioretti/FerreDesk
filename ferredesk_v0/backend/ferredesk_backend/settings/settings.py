# ferredesk_backend/settings.py
import os

ENV = os.environ.get("ENVIRONMENT", "development").lower()

if ENV == "production":
    from .prod import *  # noqa: F401,F403
else:
    from .dev import *  # noqa: F401,F403
