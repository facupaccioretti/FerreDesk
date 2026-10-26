from ferreapps.usuarios.models import Perfil


def perfiles_adoptados(request):
    valor = getattr(request, 'perfiles_adoptados', None)
    if valor is not None:
        return valor
    valor = (
        Perfil.objects.filter(
            tipo=Perfil.TIPO_DUENO,
            usuario__isnull=False,
            habilitado=True,
        )
        .exclude(pin_hash='')
        .exists()
    )
    request.perfiles_adoptados = valor
    return valor
