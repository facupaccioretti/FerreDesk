from django.contrib import admin
from .models import Localidad, Provincia, Barrio, TipoIVA, Transporte, Vendedor, Plazo, CategoriaCliente, Cliente

admin.site.register(Localidad)
admin.site.register(Provincia)
admin.site.register(Barrio)
admin.site.register(TipoIVA)
admin.site.register(Transporte)
admin.site.register(Vendedor)
admin.site.register(Plazo)
admin.site.register(CategoriaCliente)
admin.site.register(Cliente)
