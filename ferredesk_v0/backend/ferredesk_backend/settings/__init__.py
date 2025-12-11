"""
Selector de settings según la variable de entorno ENVIRONMENT.
"""
import os

ENTORNO_ACTUAL = os.environ.get("ENVIRONMENT", "development").lower()

if ENTORNO_ACTUAL == "production":
    from .prod import *  # noqa: F401,F403
else:
    from .dev import *  # noqa: F401,F403
