from django.contrib import admin

from .models import Promocion, PromocionGrupo, PromocionGrupoAlternativa, PromocionItem


class PromocionItemInline(admin.TabularInline):
    model = PromocionItem
    extra = 1


class PromocionGrupoAlternativaInline(admin.TabularInline):
    model = PromocionGrupoAlternativa
    extra = 2


@admin.register(PromocionGrupo)
class PromocionGrupoAdmin(admin.ModelAdmin):
    list_display = ('promocion', 'nombre', 'cantidad', 'orden')
    inlines = [PromocionGrupoAlternativaInline]


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'precio_promocional', 'activa', 'desactualizada')
    list_filter = ('activa', 'desactualizada')
    search_fields = ('nombre',)
    inlines = [PromocionItemInline]
