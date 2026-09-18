from django.contrib import admin

from .models import Promocion, PromocionItem


class PromocionItemInline(admin.TabularInline):
    model = PromocionItem
    extra = 1


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'precio_promocional', 'activa', 'desactualizada')
    list_filter = ('activa', 'desactualizada')
    search_fields = ('nombre',)
    inlines = [PromocionItemInline]
