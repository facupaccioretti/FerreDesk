import os

from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse


def health_check(request):
    return JsonResponse({"status": "ok"})


def serve_react_root_file(request, filename):
    """Sirve archivos raiz del build de React y, en dev, hace fallback a public/."""
    content_types = {
        ".ico": "image/x-icon",
        ".json": "application/json",
        ".txt": "text/plain",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
    }
    ext = os.path.splitext(filename)[1].lower()
    content_type = content_types.get(ext, "application/octet-stream")

    candidate_paths = [os.path.join(settings.REACT_APP_DIR, filename)]
    public_dir = getattr(settings, "FRONTEND_PUBLIC_DIR", None)
    if public_dir:
        candidate_paths.append(os.path.join(public_dir, filename))

    for file_path in candidate_paths:
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(open(file_path, "rb"), content_type=content_type)
    raise Http404(f"Archivo no encontrado: {filename}")
