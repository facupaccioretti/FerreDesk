from django.db import models

class Ferreteria(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    activa = models.BooleanField(default=True)
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
    
    # Configuración de Notificaciones
    notificaciones_email = models.BooleanField(
        default=True,
        help_text='Activar notificaciones por email'
    )
    notificaciones_stock_bajo = models.BooleanField(
        default=True,
        help_text='Notificar cuando el stock esté bajo'
    )
    notificaciones_vencimientos = models.BooleanField(
        default=True,
        help_text='Notificar vencimientos próximos'
    )
    notificaciones_pagos_pendientes = models.BooleanField(
        default=True,
        help_text='Notificar pagos pendientes'
    )
    
    # Configuración de Sistema
    permitir_stock_negativo = models.BooleanField(
        default=False,
        help_text='Permitir que el stock de productos sea negativo'
    )
    
    # Configuración de Comprobantes
    comprobante_por_defecto = models.CharField(
        max_length=2,
        choices=[
            ('FA', 'Factura A'),
            ('FB', 'Factura B'),
            ('FC', 'Factura C'),
            ('BA', 'Boleta A'),
            ('BB', 'Boleta B'),
            ('BC', 'Boleta C'),
        ],
        default='FA',
        help_text='Tipo de comprobante por defecto'
    )
    
    # Configuración de Precios
    margen_ganancia_por_defecto = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=30.00,
        help_text='Margen de ganancia por defecto en porcentaje'
    )

    # Configuración de Impresión
    
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
    
    url_wsaa_arca = models.URLField(
        max_length=255,
        blank=True,
        null=True,
        help_text='URL del servicio WSAA de ARCA (se configura automáticamente según modo)'
    )
    
    url_wsfev1_arca = models.URLField(
        max_length=255,
        blank=True,
        null=True,
        help_text='URL del servicio WSFEv1 de ARCA (se configura automáticamente según modo)'
    )
    
    arca_habilitado = models.BooleanField(
        default=False,
        help_text='Activar/desactivar la emisión automática de comprobantes ARCA'
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
    
    def get_configuracion_arca_urls(self):
        """
        Retorna las URLs de configuración ARCA según el modo seleccionado.
        """
        if self.modo_arca == 'PROD':
            return {
                'wsaa': 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL',
                'wsfev1': 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
            }
        else:  # HOM (Homologación)
            return {
                'wsaa': 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL',
                'wsfev1': 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
            }
    
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
    
    def get_ruta_tokens_arca(self):
        """
        Retorna la ruta donde se almacenarán los tokens ARCA para esta ferretería.
        """
        import os
        from django.conf import settings
        
        # Crear directorio si no existe
        ruta_base = os.path.join(settings.MEDIA_ROOT, 'arca', 'tokens', f'ferreteria_{self.id}')
        os.makedirs(ruta_base, exist_ok=True)
        
        return ruta_base
    
    def get_ruta_certificados_arca(self):
        """
        Retorna la ruta donde se almacenan los certificados ARCA para esta ferretería.
        """
        import os
        from django.conf import settings
        
        # Crear directorio si no existe
        ruta_base = os.path.join(settings.MEDIA_ROOT, 'arca', 'certificados', f'ferreteria_{self.id}')
        os.makedirs(ruta_base, exist_ok=True)
        
        return ruta_base
    
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
            except Ferreteria.DoesNotExist:
                certificado_nuevo = self.certificado_arca is not None
                clave_privada_nueva = self.clave_privada_arca is not None
        else:
            certificado_nuevo = self.certificado_arca is not None
            clave_privada_nueva = self.clave_privada_arca is not None
        
        # Guardar primero para obtener el ID
        super().save(*args, **kwargs)
        
        # Renombrar archivos si son nuevos
        if certificado_nuevo or clave_privada_nueva:
            self._renombrar_archivos_estandar()
    
    def _renombrar_archivos_estandar(self):
        """
        Renombra los archivos ARCA a nombres estándar con reemplazo directo.
        """
        import os
        import shutil
        from django.conf import settings
        
        # Crear directorios si no existen
        base_dir = os.path.join(settings.MEDIA_ROOT, 'arca', f'ferreteria_{self.id}')
        certificados_dir = os.path.join(base_dir, 'certificados')
        claves_dir = os.path.join(base_dir, 'claves_privadas')
        
        os.makedirs(certificados_dir, exist_ok=True)
        os.makedirs(claves_dir, exist_ok=True)
        
        # Procesar certificado
        if self.certificado_arca and os.path.exists(self.certificado_arca.path):
            destino_certificado = os.path.join(certificados_dir, 'certificado.pem')
            
            # ELIMINAR archivo anterior si existe (reemplazo directo)
            if os.path.exists(destino_certificado):
                os.remove(destino_certificado)
                print(f"Archivo anterior eliminado: {destino_certificado}")
            
            # Mover archivo nuevo a nombre estándar
            shutil.move(self.certificado_arca.path, destino_certificado)
            
            # Actualizar referencia en el modelo
            self.certificado_arca.name = f'arca/ferreteria_{self.id}/certificados/certificado.pem'
            
            # LIMPIAR cualquier archivo duplicado restante
            for archivo in os.listdir(certificados_dir):
                if archivo != 'certificado.pem':
                    archivo_path = os.path.join(certificados_dir, archivo)
                    os.remove(archivo_path)
                    print(f"Archivo duplicado eliminado: {archivo}")
            
            print(f"✅ Certificado reemplazado: {destino_certificado}")
        
        # Procesar clave privada
        if self.clave_privada_arca and os.path.exists(self.clave_privada_arca.path):
            destino_clave = os.path.join(claves_dir, 'clave_privada.pem')
            
            # ELIMINAR archivo anterior si existe (reemplazo directo)
            if os.path.exists(destino_clave):
                os.remove(destino_clave)
                print(f"Archivo anterior eliminado: {destino_clave}")
            
            # Mover archivo nuevo a nombre estándar
            shutil.move(self.clave_privada_arca.path, destino_clave)
            
            # Actualizar referencia en el modelo
            self.clave_privada_arca.name = f'arca/ferreteria_{self.id}/claves_privadas/clave_privada.pem'
            
            # LIMPIAR cualquier archivo duplicado restante
            for archivo in os.listdir(claves_dir):
                if archivo != 'clave_privada.pem':
                    archivo_path = os.path.join(claves_dir, archivo)
                    os.remove(archivo_path)
                    print(f"Archivo duplicado eliminado: {archivo}")
            
            print(f"✅ Clave privada reemplazada: {destino_clave}")
        
        # Guardar cambios en la BD (sin llamar save() para evitar bucle)
        from django.db import connection
        with connection.cursor() as cursor:
            if self.certificado_arca:
                cursor.execute(
                    "UPDATE productos_ferreteria SET certificado_arca = %s WHERE id = %s",
                    [self.certificado_arca.name, self.id]
                )
            if self.clave_privada_arca:
                cursor.execute(
                    "UPDATE productos_ferreteria SET clave_privada_arca = %s WHERE id = %s",
                    [self.clave_privada_arca.name, self.id]
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
    codigo = models.IntegerField(unique=True, db_column='PRO_CODIGO')
    razon = models.CharField(max_length=50, db_column='PRO_RAZON')
    fantasia = models.CharField(max_length=50, db_column='PRO_FANTASIA')
    domicilio = models.CharField(max_length=50, db_column='PRO_DOMI')
    tel1 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL1')
    tel2 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL2')
    tel3 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL3')
    cuit = models.CharField(max_length=11, null=True, blank=True, db_column='PRO_CUIT')
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

class Stock(models.Model):
    id = models.IntegerField(primary_key=True, db_column='STO_ID')
    codvta = models.CharField(max_length=15, unique=True, db_column='STO_CODVTA')
    codcom = models.CharField(max_length=15, unique=True, db_column='STO_CODCOM')
    deno = models.CharField(max_length=50, db_column='STO_DENO')
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

    class Meta:
        db_table = 'STOCK'

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


