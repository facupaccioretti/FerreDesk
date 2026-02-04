from django.db import models, transaction
from django.conf import settings

class Ferreteria(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    SITUACION_IVA_CHOICES = [
        ('RI', 'Responsable Inscripto'),
        ('MO', 'Monotributista'),
    ]
    situacion_iva = models.CharField(
        max_length=2,
        choices=SITUACION_IVA_CHOICES,
        default='RI',
        help_text='Condición fiscal del negocio/emisor para comprobantes.'
    )
    

    
    # Punto de Venta (ARCA)
    punto_venta_arca = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text='Punto de venta ARCA para comprobantes fiscales'
    )
    
    # CUIT/CUIL
    cuit_cuil = models.CharField(
        max_length=13,
        blank=True,
        null=True,
        help_text='CUIT/CUIL de la empresa'
    )
    
    # Razón Social
    razon_social = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='Razón social de la empresa'
    )
    
    # Ingresos Brutos
    ingresos_brutos = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text='Ingresos Brutos de la empresa'
    )
    
    # Inicio de Actividad
    inicio_actividad = models.DateField(
        blank=True,
        null=True,
        help_text='Fecha de inicio de actividad'
    )
    
    # Logo de la Empresa
    logo_empresa = models.ImageField(
        upload_to='logos/',
        blank=True,
        null=True,
        help_text='Logo de la empresa para comprobantes'
    )
    
    
    # Configuración ARCA - Integración con servicios web de AFIP
    certificado_arca = models.FileField(
        upload_to='arca/ferreteria_1/certificados/',
        blank=True,
        null=True,
        help_text='Certificado ARCA (.pem) para autenticación con servicios web de AFIP'
    )
    
    clave_privada_arca = models.FileField(
        upload_to='arca/ferreteria_1/claves_privadas/',
        blank=True,
        null=True,
        help_text='Clave privada ARCA (.pem) para firma digital de comprobantes'
    )
    
    MODO_ARCA_CHOICES = [
        ('HOM', 'Homologación'),
        ('PROD', 'Producción'),
    ]
    modo_arca = models.CharField(
        max_length=4,
        choices=MODO_ARCA_CHOICES,
        default='HOM',
        help_text='Modo de operación ARCA (Homologación para pruebas, Producción para uso real)'
    )
    
    
    
    arca_habilitado = models.BooleanField(
        default=False,
        help_text='Activar/desactivar la emisión automática de comprobantes ARCA'
    )
    
    # Política operativa: permitir stock negativo por defecto
    permitir_stock_negativo = models.BooleanField(
        default=False,
        help_text='Permite que el sistema permita vender con stock negativo por defecto'
    )
    
    # Prefijo para códigos de barras Code 128 internos
    prefijo_codigo_barras = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text='Siglas para códigos de barras internos Code 128 (ej: ABC, MIF). Si está vacío, se usa solo el número secuencial.'
    )
    
    # Estado de configuración ARCA
    arca_configurado = models.BooleanField(
        default=False,
        help_text='Indica si la configuración ARCA está completa y válida'
    )
    
    # Fecha de última validación ARCA
    arca_ultima_validacion = models.DateTimeField(
        blank=True,
        null=True,
        help_text='Fecha y hora de la última validación exitosa de la configuración ARCA'
    )
    
    # Mensaje de error de configuración ARCA
    arca_error_configuracion = models.TextField(
        blank=True,
        null=True,
        help_text='Mensaje de error si la configuración ARCA no es válida'
    )
    
    def __str__(self):
        return self.nombre
    
    
    
    def validar_configuracion_arca(self):
        """
        Valida que la configuración ARCA esté completa y sea correcta.
        Retorna (es_valido, mensaje_error)
        """
        errores = []
        
        # Verificar que los archivos estén presentes
        if not self.certificado_arca:
            errores.append("Certificado ARCA no está configurado")
        
        if not self.clave_privada_arca:
            errores.append("Clave privada ARCA no está configurada")
        
        # Verificar datos fiscales requeridos
        if not self.cuit_cuil:
            errores.append("CUIT/CUIL no está configurado")
        
        if not self.razon_social:
            errores.append("Razón social no está configurada")
        
        if not self.punto_venta_arca:
            errores.append("Punto de venta ARCA no está configurado")
        
        # Verificar que el CUIT tenga formato válido (11 dígitos)
        if self.cuit_cuil and len(str(self.cuit_cuil).replace('-', '').replace(' ', '')) != 11:
            errores.append("CUIT debe tener 11 dígitos")
        
        if errores:
            self.arca_configurado = False
            self.arca_error_configuracion = "; ".join(errores)
            return False, self.arca_error_configuracion
        
        # Si no hay errores, marcar como configurado
        self.arca_configurado = True
        self.arca_error_configuracion = ""
        return True, "Configuración ARCA válida"
    
    
    
    def save(self, *args, **kwargs):
        """
        Método save que renombra automáticamente los archivos ARCA a nombres estándar.
        """
        # Verificar si hay archivos nuevos
        is_new = self.pk is None
        
        if not is_new:
            try:
                old_instance = Ferreteria.objects.get(pk=self.pk)
                certificado_nuevo = (
                    self.certificado_arca != old_instance.certificado_arca and 
                    self.certificado_arca is not None
                )
                clave_privada_nueva = (
                    self.clave_privada_arca != old_instance.clave_privada_arca and 
                    self.clave_privada_arca is not None
                )
                logo_nuevo = (
                    self.logo_empresa != old_instance.logo_empresa and
                    self.logo_empresa is not None
                )
            except Ferreteria.DoesNotExist:
                certificado_nuevo = self.certificado_arca is not None
                clave_privada_nueva = self.clave_privada_arca is not None
                logo_nuevo = self.logo_empresa is not None
        else:
            certificado_nuevo = self.certificado_arca is not None
            clave_privada_nueva = self.clave_privada_arca is not None
            logo_nuevo = self.logo_empresa is not None
        
        # Guardar primero para obtener el ID
        super().save(*args, **kwargs)
        
        # Los archivos ARCA se normalizan via señal post_save en ventas/signals.py
        if logo_nuevo:
            self._normalizar_logo_empresa()
    

    def _normalizar_logo_empresa(self):
        """
        Mueve el logo de empresa a un nombre estándar 'logos/logo.jpg' (o mantiene la extensión original 
        si no es .jpg) y elimina archivos anteriores en esa carpeta, preservando 'logo-arca.jpg'.
        """
        import os
        import shutil
        from django.conf import settings
        from django.db import connection

        if not self.logo_empresa:
            return

        logos_dir = os.path.join(settings.MEDIA_ROOT, 'logos')
        os.makedirs(logos_dir, exist_ok=True)

        # Determinar extensión del archivo subido
        try:
            origen_path = self.logo_empresa.path
        except Exception:
            return

        _, ext = os.path.splitext(origen_path)
        ext = ext.lower() if ext else '.jpg'
        # Normalizar a .jpg si no es una extensión común
        if ext not in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
            ext = '.jpg'

        destino_nombre = f'logo{ext}'
        destino_path = os.path.join(logos_dir, destino_nombre)

        # Eliminar archivo destino previo si existe
        if os.path.exists(destino_path):
            try:
                os.remove(destino_path)
            except Exception:
                pass

        # Mover el archivo subido al nombre estándar
        try:
            shutil.move(origen_path, destino_path)
        except Exception:
            # Si falló el move, no continuar
            return

        # Actualizar referencia en el modelo a 'logos/logo.ext'
        self.logo_empresa.name = f'logos/{destino_nombre}'

        # Limpiar otros archivos en la carpeta 'logos', excepto el logo estándar y 'logo-arca.jpg'
        try:
            for archivo in os.listdir(logos_dir):
                if archivo in {destino_nombre, 'logo-arca.jpg'}:
                    continue
                archivo_path = os.path.join(logos_dir, archivo)
                # Solo eliminar archivos (no directorios)
                if os.path.isfile(archivo_path):
                    try:
                        os.remove(archivo_path)
                    except Exception:
                        pass
        except Exception:
            pass

        # Persistir ruta actualizada en BD directamente
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE productos_ferreteria SET logo_empresa = %s WHERE id = %s",
                [self.logo_empresa.name, self.id]
            )

class Categoria(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.nombre

class Producto(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True, null=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT)
    precio_compra = models.DecimalField(max_digits=10, decimal_places=2)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    stock_minimo = models.IntegerField(default=5)
    ferreteria = models.ForeignKey(Ferreteria, on_delete=models.CASCADE)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

class Proveedor(models.Model):
    id = models.AutoField(primary_key=True, db_column='PRO_ID')
    razon = models.CharField(max_length=50, db_column='PRO_RAZON')
    fantasia = models.CharField(max_length=50, db_column='PRO_FANTASIA')
    domicilio = models.CharField(max_length=50, db_column='PRO_DOMI')
    tel1 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL1')
    tel2 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL2')
    tel3 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL3')
    cuit = models.CharField(max_length=11, null=False, blank=False, db_column='PRO_CUIT', unique=True)
    ib = models.CharField(max_length=10, null=True, blank=True, db_column='PRO_IB')
    cpostal = models.CharField(max_length=7, null=True, blank=True, db_column='PRO_CPOSTAL')
    iva = models.SmallIntegerField(null=True, blank=True, db_column='PRO_IVA')
    contacto = models.CharField(max_length=50, null=True, blank=True, db_column='PRO_CONTACTO')
    impsalcta = models.DecimalField(max_digits=12, decimal_places=2, db_column='PRO_IMPSALCTA')
    fecsalcta = models.DateField(db_column='PRO_FECSALCTA')
    idbar = models.IntegerField(null=True, blank=True, db_column='PRO_IDBAR')
    idloc = models.IntegerField(null=True, blank=True, db_column='PRO_IDLOC')
    idprv = models.IntegerField(null=True, blank=True, db_column='PRO_IDPRV')
    idcap = models.IntegerField(null=True, blank=True, db_column='PRO_IDCAP')
    acti = models.CharField(max_length=1, null=True, blank=True, db_column='PRO_ACTI')
    sigla = models.CharField(max_length=3, unique=True, db_column='PRO_SIGLA', blank=True, null=True)

    class Meta:
        db_table = 'PROVEEDORES'


class ContadorCodigoBarras(models.Model):
    """Contador secuencial para generación de códigos de barras internos."""
    
    TIPO_EAN13 = 'EAN13'
    TIPO_CODE128 = 'CODE128'
    
    TIPO_CHOICES = [
        (TIPO_EAN13, 'EAN-13'),
        (TIPO_CODE128, 'Code 128'),
    ]
    
    tipo = models.CharField(
        max_length=10,
        unique=True,
        choices=TIPO_CHOICES,
        db_column='TIPO_CODIGO'
    )
    ultimo_numero = models.BigIntegerField(
        default=0,
        db_column='ULTIMO_NUMERO'
    )
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'CONTADOR_CODIGO_BARRAS'
        verbose_name = 'Contador de Código de Barras'
        verbose_name_plural = 'Contadores de Códigos de Barras'
    
    def __str__(self):
        return f"{self.tipo}: {self.ultimo_numero}"
    
    @classmethod
    def obtener_siguiente_numero(cls, tipo: str) -> int:
        """Obtiene el siguiente número secuencial de forma atómica."""
        with transaction.atomic():
            contador, _ = cls.objects.select_for_update().get_or_create(
                tipo=tipo,
                defaults={'ultimo_numero': 0}
            )
            contador.ultimo_numero += 1
            contador.save()
            return contador.ultimo_numero


class Stock(models.Model):
    id = models.IntegerField(primary_key=True, db_column='STO_ID')
    codvta = models.CharField(max_length=15, unique=True, db_column='STO_CODVTA')
    deno = models.CharField(max_length=settings.PRODUCTO_DENOMINACION_MAX_CARACTERES, db_column='STO_DENO')
    orden = models.SmallIntegerField(null=True, blank=True, db_column='STO_ORDEN')
    unidad = models.CharField(max_length=10, null=True, blank=True, db_column='STO_UNIDAD')
    margen = models.DecimalField(max_digits=5, decimal_places=2, null=False, blank=False, db_column='STO_MARGEN')
    cantmin = models.IntegerField(null=True, blank=True, db_column='STO_CANTMIN')
    idaliiva = models.ForeignKey(
        'AlicuotaIVA', db_column='STO_IDALIIVA', on_delete=models.PROTECT, related_name='stocks'
    )
    idfam1 = models.ForeignKey(
        'Familia', null=True, blank=True, db_column='STO_IDFAM1', on_delete=models.SET_NULL, related_name='stocks_fam1'
    )
    idfam2 = models.ForeignKey(
        'Familia', null=True, blank=True, db_column='STO_IDFAM2', on_delete=models.SET_NULL, related_name='stocks_fam2'
    )
    idfam3 = models.ForeignKey(
        'Familia', null=True, blank=True, db_column='STO_IDFAM3', on_delete=models.SET_NULL, related_name='stocks_fam3'
    )
    proveedor_habitual = models.ForeignKey(
        'Proveedor', null=False, blank=False, db_column='STO_IDPRO', on_delete=models.PROTECT, related_name='productos_habituales'
    )
    ACTIVO_CHOICES = [
        ('S', 'Activo'),
        ('N', 'Inactivo'),
    ]
    acti = models.CharField(
        max_length=1,
        choices=ACTIVO_CHOICES,
        null=False,
        blank=False,
        default='S',
        db_column='STO_ACTI'
    )
    
    # Campos para Lista de Precios 0 (precio base)
    precio_lista_0 = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        db_column='PRECIO_VENTA_LISTA_CERO_SIN_IVA',
        help_text='Precio de venta base (Lista 0) sin IVA'
    )
    precio_lista_0_manual = models.BooleanField(
        default=False,
        db_column='ES_PRECIO_LISTA_CERO_MANUAL',
        help_text='TRUE si el precio fue cargado manualmente, FALSE si se calcula desde costo+margen'
    )
    
    # Campos para código de barras
    TIPO_CODIGO_BARRAS_CHOICES = [
        ('EAN13', 'EAN-13 Interno'),
        ('CODE128', 'Code 128 Interno'),
        ('EXTERNO', 'Código externo/escaneado'),
    ]
    codigo_barras = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        unique=True,
        db_column='STO_CODIGO_BARRAS',
        help_text='Código de barras asociado al producto'
    )
    tipo_codigo_barras = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        choices=TIPO_CODIGO_BARRAS_CHOICES,
        db_column='STO_TIPO_CODIGO_BARRAS',
        help_text='Tipo de código de barras (EAN13, CODE128, EXTERNO)'
    )

    # Impuesto interno: informativo; no se cobra en venta minorista (ya viene en el costo).
    impuesto_interno_porcentaje = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        db_column='STO_IMP_INTERNO_PORCE',
        help_text='Porcentaje nominal del impuesto interno que ya viene en el costo (ej. 70 cigarrillos, 26 destilados, 14 cerveza, 8 gaseosas). Solo informativo.'
    )

    class Meta:
        db_table = 'STOCK'
        indexes = [
            models.Index(fields=['acti']),
            models.Index(fields=['proveedor_habitual']),
            models.Index(fields=['codigo_barras']),
        ]

class StockProve(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, db_column='STP_IDSTO', related_name='stock_proveedores')
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE, db_column='STP_IDPRO', related_name='proveedor_stocks')
    cantidad = models.DecimalField(max_digits=15, decimal_places=2, db_column='STP_CANTIDAD', default=0)
    costo = models.DecimalField(max_digits=15, decimal_places=2, db_column='STP_COSTO', default=0)
    fecultcan = models.DateField(null=True, blank=True, db_column='STP_FECULTCAN')
    fecultcos = models.DateField(null=True, blank=True, db_column='STP_FECULTCOS')
    fecha_actualizacion = models.DateTimeField(auto_now=True, db_column='STP_FECHA_ACTUALIZACION')
    codigo_producto_proveedor = models.CharField(max_length=100, null=True, blank=True, db_column='STP_CODPROV')

    class Meta:
        db_table = 'STOCKPROVE'
        unique_together = (('stock', 'proveedor'),)
        indexes = [
            models.Index(fields=['stock', 'proveedor']),
            models.Index(fields=['proveedor']),
        ]
        # NOTA: La unicidad (proveedor, codigo_producto_proveedor) solo se valida en el serializer si el código no está vacío.

class Familia(models.Model):
    id = models.AutoField(primary_key=True, db_column='FAM_ID')
    deno = models.CharField(max_length=50, db_column='FAM_DENO')
    comentario = models.CharField(max_length=50, db_column='FAM_COMENTARIO', blank=True, null=True)
    nivel = models.CharField(max_length=3, db_column='FAM_NIVEL')
    acti = models.CharField(max_length=1, db_column='FAM_ACTI')

    class Meta:
        db_table = 'FAMILIAS'

    def __str__(self):
        return self.deno

class AlicuotaIVA(models.Model):
    id = models.AutoField(primary_key=True, db_column='ALI_ID')
    codigo = models.CharField(max_length=5, unique=True, db_column='ALI_CODIGO', blank=True, null=True)
    deno = models.CharField(max_length=20, db_column='ALI_DENO')
    porce = models.DecimalField(max_digits=5, decimal_places=2, db_column='ALI_PORCE')

    class Meta:
        db_table = 'ALICUOTASIVA'
        verbose_name = 'Alicuota IVA'
        verbose_name_plural = 'Alicuotas IVA'

    def __str__(self):
        return f'{self.deno} ({self.porce}%)'

class PrecioProveedorExcel(models.Model):
    proveedor = models.ForeignKey('Proveedor', on_delete=models.CASCADE, related_name='precios_excel')
    codigo_producto_excel = models.CharField(max_length=100, db_index=True)
    precio = models.DecimalField(max_digits=15, decimal_places=2)
    denominacion = models.CharField(max_length=200, blank=True, null=True, help_text='Denominación del producto desde Excel')
    fecha_carga = models.DateTimeField(auto_now_add=True)
    nombre_archivo = models.CharField(max_length=255)

    class Meta:
        unique_together = (('proveedor', 'codigo_producto_excel'),)
        verbose_name = "Precio de producto por proveedor (Excel)"
        verbose_name_plural = "Precios de productos por proveedor (Excel)"

    def __str__(self):
        return f"{self.proveedor.razon} - {self.codigo_producto_excel}: {self.precio}"

class ProductoTempID(models.Model):
    id = models.IntegerField(primary_key=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"TempID {self.id} ({self.fecha_creacion})"

# ------------------------------
# Modelo para la vista SQL 'vista_stock_producto'
# ------------------------------
class VistaStockProducto(models.Model):
    """Representa la vista que contiene el stock total calculado para cada producto
    junto con la cantidad mínima definida y una bandera que indica si requiere
    reposición (1 = sí, 0 = no). Este modelo es *no gestionado* porque la vista
    es creada/destruida mediante migraciones personalizadas y no debe ser
    alterada por el ORM.
    """

    id = models.IntegerField(primary_key=True)
    denominacion = models.CharField(max_length=50)
    codigo_venta = models.CharField(max_length=15)
    cantidad_minima = models.IntegerField(null=True, blank=True)
    stock_total = models.DecimalField(max_digits=15, decimal_places=2)
    necesita_reposicion = models.IntegerField()
    proveedor_razon = models.CharField(max_length=50, null=True, blank=True)
    proveedor_fantasia = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        managed = False  # Importante: Django no debe crear/alterar la vista
        db_table = 'VISTA_STOCK_PRODUCTO'
        verbose_name = 'Vista de Stock de Producto'
        verbose_name_plural = 'Vistas de Stock de Productos'


# =============================================================================
# SISTEMA DE LISTAS DE PRECIOS
# =============================================================================

class ListaPrecio(models.Model):
    """
    Configuración de márgenes generales por lista de precios (0-4).
    - Lista 0: Precio base (sin descuento/recargo sobre sí misma)
    - Listas 1-4: Aplican margen_descuento sobre Lista 0
    """
    id = models.AutoField(primary_key=True, db_column='ID_LISTA_DE_PRECIOS')
    numero = models.IntegerField(unique=True, db_column='NUMERO_LISTA_DE_PRECIOS')
    nombre = models.CharField(max_length=50, db_column='NOMBRE_LISTA_DE_PRECIOS')
    margen_descuento = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        db_column='PORCENTAJE_AJUSTE_SOBRE_LISTA_CERO',
        help_text='Porcentaje de descuento (-) o recargo (+) sobre Lista 0'
    )
    activo = models.BooleanField(default=True, db_column='ESTA_ACTIVA')
    fecha_actualizacion = models.DateTimeField(auto_now=True, db_column='FECHA_ACTUALIZACION')

    class Meta:
        db_table = 'LISTAS_DE_PRECIOS'
        verbose_name = 'Lista de Precios'
        verbose_name_plural = 'Listas de Precios'
        ordering = ['numero']

    def __str__(self):
        return f"Lista {self.numero} - {self.nombre}"


class PrecioProductoLista(models.Model):
    """
    Precio de un producto para una lista específica (1-4).
    La Lista 0 se almacena directamente en Stock.precio_lista_0.
    """
    id = models.AutoField(primary_key=True, db_column='ID_PRECIO_DE_PRODUCTO_POR_LISTA_DE_PRECIOS')
    stock = models.ForeignKey(
        'Stock',
        on_delete=models.CASCADE,
        db_column='ID_PRODUCTO_STOCK',
        related_name='precios_listas'
    )
    lista_numero = models.IntegerField(db_column='NUMERO_LISTA_DE_PRECIOS')
    precio = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='PRECIO_VENTA_SIN_IVA'
    )
    precio_manual = models.BooleanField(
        default=False,
        db_column='ES_PRECIO_MANUAL',
        help_text='TRUE si fue cargado manualmente, FALSE si es calculado'
    )
    fecha_actualizacion = models.DateTimeField(auto_now=True, db_column='FECHA_ACTUALIZACION')
    fecha_carga_manual = models.DateTimeField(
        null=True,
        blank=True,
        db_column='FECHA_CARGA_MANUAL',
    )
    usuario_carga_manual = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column='USUARIO_CARGA_MANUAL',
    )

    class Meta:
        db_table = 'PRECIOS_DE_PRODUCTOS_POR_LISTA_DE_PRECIOS'
        verbose_name = 'Precio de Producto por Lista'
        verbose_name_plural = 'Precios de Productos por Lista'
        unique_together = (('stock', 'lista_numero'),)
        indexes = [
            models.Index(fields=['stock', 'lista_numero']),
            models.Index(fields=['lista_numero']),
            models.Index(fields=['precio_manual']),
        ]

    def __str__(self):
        tipo = "Manual" if self.precio_manual else "Calculado"
        return f"{self.stock.codvta} - Lista {self.lista_numero}: ${self.precio} ({tipo})"


class ActualizacionListaDePrecios(models.Model):
    """
    Registro de auditoría para actualizaciones de márgenes de listas.
    Permite rastrear cuándo se actualizó una lista y cuántos productos
    quedaron sin recalcular por tener precio manual.
    """
    id = models.AutoField(primary_key=True, db_column='ID_ACTUALIZACION_DE_LISTA_DE_PRECIOS')
    lista_numero = models.IntegerField(db_column='NUMERO_LISTA_DE_PRECIOS')
    porcentaje_anterior = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        db_column='PORCENTAJE_ANTERIOR'
    )
    porcentaje_nuevo = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        db_column='PORCENTAJE_NUEVO'
    )
    fecha_actualizacion = models.DateTimeField(auto_now_add=True, db_column='FECHA_ACTUALIZACION')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column='USUARIO_ID'
    )
    cantidad_productos_recalculados = models.IntegerField(
        default=0,
        db_column='CANTIDAD_PRODUCTOS_RECALCULADOS'
    )
    cantidad_productos_manuales_no_recalculados = models.IntegerField(
        default=0,
        db_column='CANTIDAD_PRODUCTOS_CON_PRECIO_MANUAL_NO_RECALCULADOS'
    )

    class Meta:
        db_table = 'ACTUALIZACIONES_DE_LISTAS_DE_PRECIOS'
        verbose_name = 'Actualización de Lista de Precios'
        verbose_name_plural = 'Actualizaciones de Listas de Precios'
        ordering = ['-fecha_actualizacion']

    def __str__(self):
        return f"Lista {self.lista_numero}: {self.porcentaje_anterior}% → {self.porcentaje_nuevo}% ({self.fecha_actualizacion.strftime('%d/%m/%Y %H:%M')})"


