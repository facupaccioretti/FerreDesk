class HealthCheckBypassMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/api/health/':
            from django.http import JsonResponse
            return JsonResponse({"status": "ok"})
        return self.get_response(request)
