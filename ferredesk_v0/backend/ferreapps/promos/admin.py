from django.contrib import admin

from .models import Promocion
from .services.gestionar_promocion import actualizar_promocion


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'precio_promocional', 'activa', 'desactualizada')
    list_filter = ('activa', 'desactualizada')
    search_fields = ('nombre',)
    fields = ('nombre', 'descripcion', 'precio_promocional', 'activa', 'fecha_inicio', 'fecha_fin')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_actions(self, request):
        acciones = super().get_actions(request)
        acciones.pop('delete_selected', None)
        return acciones

    def save_model(self, request, obj, form, change):
        if not change:
            return
        promocion = Promocion.objects.get(pk=obj.pk)
        datos = {
            campo: form.cleaned_data[campo]
            for campo in form.changed_data
            if campo in self.fields
        }
        actualizar_promocion(promocion=promocion, datos=datos)
        obj.refresh_from_db()
