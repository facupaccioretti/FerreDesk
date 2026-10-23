from rest_framework.authentication import SessionAuthentication


class SesionNegocioAuthentication(SessionAuthentication):
    def authenticate_header(self, request):
        return "Session"
