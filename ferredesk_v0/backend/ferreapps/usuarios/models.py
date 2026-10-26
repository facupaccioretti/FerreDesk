from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db.models.functions import Lower


class ActorTipo(models.TextChoices):
    TITULAR = 'TITULAR', 'Titular'
    PERFIL = 'PERFIL', 'Perfil'
    SISTEMA = 'SISTEMA', 'Sistema'


class ActorSnapshotMixin(models.Model):
    actor_tipo = models.CharField(max_length=8, choices=ActorTipo.choices, db_index=True)
    actor_perfil = models.ForeignKey(
        'usuarios.Perfil',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )
    actor_etiqueta = models.CharField(max_length=160)

    class Meta:
        abstract = True


class ActorPersistidoMixin(ActorSnapshotMixin):
    actor_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )

    class Meta(ActorSnapshotMixin.Meta):
        abstract = True


def crear_constraint_actor(nombre):
    return models.CheckConstraint(
        check=(
            models.Q(actor_tipo=ActorTipo.PERFIL, actor_perfil__isnull=False)
            | models.Q(
                actor_tipo__in=[ActorTipo.TITULAR, ActorTipo.SISTEMA],
                actor_perfil__isnull=True,
            )
        ) & ~models.Q(actor_etiqueta=''),
        name=nombre,
    )

class Usuario(AbstractUser):
    TIPO_CHOICES = [
        ('admin', 'Administrador'),
        ('cli_admin', 'Administrador de Cliente'),
        ('cli_user', 'Usuario de Cliente'),
        ('prueba', 'Usuario de Prueba'),
        ('auditor', 'Auditor'),
    ]
    
    tipo_usuario = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='cli_user'
    )
    ferreteria = models.ForeignKey(
        'productos.Ferreteria',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usuarios'
    )
    
    def __str__(self):
        return f"{self.username} ({self.get_tipo_usuario_display()})"

class CliUsuario(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cuenta_activa = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_modificacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {'Activa' if self.cuenta_activa else 'Inactiva'}"

    class Meta:
        verbose_name = "Usuario Cliente"
        verbose_name_plural = "Usuarios Clientes"


class Perfil(models.Model):
    TIPO_DUENO = 'DUENO'
    TIPO_ORDINARIO = 'ORDINARIO'
    TIPOS = [
        (TIPO_DUENO, 'Dueno'),
        (TIPO_ORDINARIO, 'Ordinario'),
    ]

    id = models.BigAutoField(primary_key=True)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='perfil_dueno',
    )
    tipo = models.CharField(max_length=10, choices=TIPOS)
    nombre = models.CharField(max_length=120)
    habilitado = models.BooleanField(default=True)
    puede_gestionar_perfiles = models.BooleanField(default=False)
    permisos = ArrayField(models.CharField(max_length=64), default=list, blank=True)
    pin_hash = models.CharField(max_length=128)
    credencial_version = models.PositiveBigIntegerField(default=1)
    intentos_fallidos = models.PositiveSmallIntegerField(default=0)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tipo'],
                condition=models.Q(tipo='DUENO'),
                name='usuarios_perfil_unico_dueno',
            ),
            models.UniqueConstraint(
                Lower('nombre'),
                condition=models.Q(habilitado=True),
                name='usuarios_perfil_nombre_unico_habilitados',
            ),
            models.CheckConstraint(
                check=(
                    models.Q(
                        tipo='DUENO',
                        usuario__isnull=False,
                        habilitado=True,
                        puede_gestionar_perfiles=False,
                        intentos_fallidos=0,
                        bloqueado_hasta__isnull=True,
                    )
                    | models.Q(tipo='ORDINARIO', usuario__isnull=True)
                ),
                name='usuarios_perfil_tipo_valido',
            ),
            models.CheckConstraint(
                check=models.Q(credencial_version__gt=0),
                name='usuarios_perfil_credencial_version_positiva',
            ),
            models.CheckConstraint(
                check=~models.Q(nombre=''),
                name='usuarios_perfil_nombre_no_vacio',
            ),
        ]
        indexes = [
            models.Index(fields=['tipo', 'habilitado'], name='usuarios_perfil_tipo_hab_idx'),
        ]

    @property
    def etiqueta(self):
        if self.tipo == self.TIPO_DUENO:
            return f'Dueño ({self.nombre})'
        return self.nombre

    def __str__(self):
        return self.etiqueta


class RecuperacionPinDueno(models.Model):
    perfil = models.ForeignKey(
        Perfil,
        on_delete=models.PROTECT,
        related_name='recuperaciones_pin',
        limit_choices_to={'tipo': Perfil.TIPO_DUENO},
    )
    token_hash = models.CharField(max_length=64, unique=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    vence_en = models.DateTimeField()
    usado_en = models.DateTimeField(null=True, blank=True)
    revocado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['perfil'],
                condition=models.Q(usado_en__isnull=True, revocado_en__isnull=True),
                name='usuarios_recuperacion_dueno_activa_unica',
            ),
            models.CheckConstraint(
                check=models.Q(vence_en__gt=models.F('creado_en')),
                name='usuarios_recuperacion_vigencia_valida',
            ),
        ]
        indexes = [models.Index(fields=['perfil', 'creado_en'], name='usuarios_recup_fecha_idx')]


class EventoSeguridad(models.Model):
    evento = models.CharField(max_length=64, db_index=True)
    actor_tipo = models.CharField(max_length=8, choices=ActorTipo.choices)
    actor_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_seguridad',
    )
    actor_perfil = models.ForeignKey(
        Perfil,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_seguridad',
    )
    actor_etiqueta = models.CharField(max_length=160)
    objeto_tipo = models.CharField(max_length=64, blank=True, default='')
    objeto_id = models.CharField(max_length=64, blank=True, default='')
    detalles = models.JSONField(default=dict, blank=True)
    request_hash = models.CharField(max_length=64, blank=True, default='')
    session_hash = models.CharField(max_length=64, blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(actor_tipo=ActorTipo.PERFIL)
                    | models.Q(
                        actor_tipo__in=[ActorTipo.TITULAR, ActorTipo.SISTEMA],
                        actor_perfil__isnull=True,
                    )
                ) & ~models.Q(actor_etiqueta=''),
                name='usuarios_evento_actor_valido',
            ),
        ]
        indexes = [
            models.Index(fields=['evento', 'creado_en'], name='usuarios_evento_tipo_fecha_idx'),
            models.Index(fields=['objeto_tipo', 'objeto_id'], name='usuarios_evento_objeto_idx'),
        ]

class Auditoria(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    accion = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    objeto_afectado = models.CharField(max_length=200, blank=True, null=True)
    detalles = models.TextField(blank=True, null=True)
    session_key = models.CharField(max_length=40, blank=True, null=True)

    def __str__(self):
        return f"{self.timestamp} - {self.usuario} - {self.accion}"

    class Meta:
        verbose_name = "Auditoría"
        verbose_name_plural = "Auditorías"

# Utilidad para tracking de sesiones activas
# Puedes usar Session.objects.filter(expire_date__gte=timezone.now()) para ver sesiones activas
