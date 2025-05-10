from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, CliUsuario

@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ('username', 'email', 'tipo_usuario', 'ferreteria', 'is_staff')
    list_filter = ('tipo_usuario', 'ferreteria', 'is_staff', 'is_active')
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Información Personal', {'fields': ('first_name', 'last_name', 'email')}),
        ('Permisos', {'fields': ('tipo_usuario', 'ferreteria', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Fechas Importantes', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'tipo_usuario', 'ferreteria'),
        }),
    )
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering = ('username',)

@admin.register(CliUsuario)
class CliUsuarioAdmin(admin.ModelAdmin):
    list_display = ('user', 'cuenta_activa', 'fecha_creacion', 'ultima_modificacion')
    list_filter = ('cuenta_activa', 'fecha_creacion')
    search_fields = ('user__username', 'user__email')
    ordering = ('-fecha_creacion',)
    actions = ['activar_cuentas', 'desactivar_cuentas']

    def activar_cuentas(self, request, queryset):
        queryset.update(cuenta_activa=True)
    activar_cuentas.short_description = "Activar las cuentas seleccionadas"

    def desactivar_cuentas(self, request, queryset):
        queryset.update(cuenta_activa=False)
    desactivar_cuentas.short_description = "Desactivar las cuentas seleccionadas"
