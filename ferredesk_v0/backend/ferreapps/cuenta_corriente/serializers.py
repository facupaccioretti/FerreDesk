from rest_framework import serializers
from decimal import Decimal
from .models import ImputacionVenta, CuentaCorrienteCliente
from ferreapps.ventas.models import Venta, VentaCalculada
from ferreapps.clientes.models import Cliente


class ImputacionSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo ImputacionVenta
    """
    # Campos de solo lectura para mostrar información relacionada
    factura_numero = serializers.CharField(source='imp_id_venta.numero_formateado', read_only=True)
    recibo_numero = serializers.CharField(source='imp_id_recibo.numero_formateado', read_only=True)
    cliente_nombre = serializers.CharField(source='imp_id_venta.ven_razon_social', read_only=True)
    
    class Meta:
        model = ImputacionVenta
        fields = [
            'imp_id', 'imp_id_venta', 'imp_id_recibo', 'imp_fecha', 'imp_monto',
            'imp_usuario', 'imp_observacion', 'factura_numero', 'recibo_numero', 'cliente_nombre'
        ]
        read_only_fields = ['imp_id', 'imp_usuario']

    def validate(self, data):
        """
        Validaciones personalizadas del serializer
        """
        # Validar que el monto sea positivo
        if data.get('imp_monto', Decimal('0')) <= 0:
            raise serializers.ValidationError({
                'imp_monto': 'El monto debe ser mayor a cero'
            })
        
        # Validar que la factura y el recibo sean del mismo cliente
        factura = data.get('imp_id_venta')
        recibo = data.get('imp_id_recibo')
        
        if factura and recibo and factura.ven_idcli != recibo.ven_idcli:
            raise serializers.ValidationError({
                'imp_id_recibo': 'La factura y el recibo deben pertenecer al mismo cliente'
            })
        
        return data


class ImputacionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer simplificado para crear imputaciones
    """
    class Meta:
        model = ImputacionVenta
        # imp_id_recibo e imp_fecha los setea el backend al crear el recibo
        fields = ['imp_id_venta', 'imp_monto', 'imp_observacion']

    def validate(self, data):
        """
        Validaciones para la creación de imputaciones
        """
        factura = data.get('imp_id_venta')
        monto = data.get('imp_monto', Decimal('0'))
        
        # Validar que no se impute más del saldo pendiente
        # Calculamos el saldo directamente desde VentaCalculada e ImputacionVenta
        # para evitar problemas con vistas que pueden no estar actualizadas
        if factura:
            from django.db.models import Sum
            
            # Obtener el total de la factura desde VentaCalculada
            vc = VentaCalculada.objects.filter(ven_id=factura.ven_id).first()
            
            if not vc:
                raise serializers.ValidationError({
                    'imp_id_venta': f'No se encontró información de la factura {factura.ven_id}'
                })
            
            # Verificar que sea una factura o cotización
            if vc.comprobante_tipo not in ['factura', 'factura_interna']:
                raise serializers.ValidationError({
                    'imp_id_venta': 'Solo se pueden imputar facturas o cotizaciones (factura interna)'
                })
            
            total_factura = Decimal(str(vc.ven_total)) if hasattr(vc, 'ven_total') else Decimal('0.00')
            
            # Calcular lo ya imputado
            imputado = ImputacionVenta.objects.filter(imp_id_venta=factura).aggregate(
                total=Sum('imp_monto')
            )['total'] or Decimal('0.00')
            
            # Calcular saldo pendiente
            saldo_pendiente = max(total_factura - imputado, Decimal('0.00'))
            
            if monto > saldo_pendiente:
                raise serializers.ValidationError({
                    'imp_monto': f'El monto a imputar (${monto}) no puede ser mayor al saldo pendiente de la factura (${saldo_pendiente})'
                })
        
        return data


class CuentaCorrienteItemSerializer(serializers.ModelSerializer):
    """
    Serializer para items de cuenta corriente usando CuentaCorrienteCliente
    """
    # Campos calculados
    debe = serializers.SerializerMethodField()
    haber = serializers.SerializerMethodField()
    saldo_acumulado = serializers.SerializerMethodField()
    saldo_pendiente = serializers.SerializerMethodField()
    es_fac_rcbo = serializers.SerializerMethodField()
    
    class Meta:
        model = CuentaCorrienteCliente
        fields = [
            'ven_id', 'ven_fecha', 'numero_formateado', 'comprobante_nombre',
            'comprobante_tipo', 'ven_total', 'debe', 'haber', 'saldo_acumulado',
            'saldo_pendiente', 'es_fac_rcbo'
        ]

    def get_debe(self, obj):
        """
        Debe ya viene calculado de la vista SQL
        """
        return obj.debe

    def get_haber(self, obj):
        """
        Haber ya viene calculado de la vista SQL
        """
        return obj.haber

    def get_saldo_acumulado(self, obj):
        """
        Saldo acumulado ya viene calculado de la vista SQL
        """
        return obj.saldo_acumulado

    def get_saldo_pendiente(self, obj):
        """
        Saldo pendiente ya viene calculado de la vista SQL
        """
        return obj.saldo_pendiente

    def get_es_fac_rcbo(self, obj):
        """
        FAC RCBO ya viene calculado de la vista SQL
        """
        return obj.es_fac_rcbo


class FacturaPendienteSerializer(serializers.ModelSerializer):
    """
    Serializer para facturas pendientes de imputar
    """
    dias_vencido = serializers.SerializerMethodField()
    
    class Meta:
        model = CuentaCorrienteCliente
        fields = [
            'ven_id', 'ven_fecha', 'numero_formateado', 'comprobante_nombre',
            'ven_total', 'saldo_pendiente', 'dias_vencido'
        ]


    def get_dias_vencido(self, obj):
        """
        Calcular días vencido (si aplica)
        """
        from django.utils import timezone
        from datetime import date
        
        # La vista CUENTA_CORRIENTE_CLIENTE no siempre expone ven_vence;
        # evitamos acceder a un atributo inexistente para no romper la serialización
        if hasattr(obj, 'ven_vence') and getattr(obj, 'ven_vence'):
            hoy = timezone.now().date()
            dias = (hoy - getattr(obj, 'ven_vence')).days
            return max(0, dias)
        return 0


class ReciboCreateSerializer(serializers.Serializer):
    """
    Serializer para crear un recibo o nota de crédito con sus imputaciones
    """
    # Datos del recibo/nota de crédito
    rec_fecha = serializers.DateField()
    rec_monto_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    rec_observacion = serializers.CharField(max_length=200, required=False, allow_blank=True)
    rec_tipo = serializers.ChoiceField(choices=[('recibo', 'Recibo'), ('credito', 'Nota de Crédito')], default='recibo')
    # Número manual estilo CompraForm (letra fija X en backend)
    rec_pv = serializers.CharField(max_length=4)   # se validará que sean 1-4 dígitos y se padecea a 4
    rec_numero = serializers.CharField(max_length=8)  # se validará que sean 1-8 dígitos y se padecea a 8
    
    # Datos del cliente
    cliente_id = serializers.IntegerField()
    
    # Lista de imputaciones
    imputaciones = ImputacionCreateSerializer(many=True)
    
    def validate(self, data):
        """
        Validaciones para la creación del recibo
        """
        imputaciones = data.get('imputaciones', [])
        monto_total = data.get('rec_monto_total', Decimal('0'))
        
        # Validaciones del número (PV y Número, sin fallback)
        pv_raw = (data.get('rec_pv') or '').strip()
        num_raw = (data.get('rec_numero') or '').strip()
        if not pv_raw.isdigit() or len(pv_raw) == 0 or len(pv_raw) > 4:
            raise serializers.ValidationError({'rec_pv': 'Punto de venta debe tener 1 a 4 dígitos numéricos'})
        if not num_raw.isdigit() or len(num_raw) == 0 or len(num_raw) > 8:
            raise serializers.ValidationError({'rec_numero': 'Número debe tener 1 a 8 dígitos numéricos'})

        # Normalizar con padding a la manera de CompraForm
        data['rec_pv'] = pv_raw.zfill(4)
        data['rec_numero'] = num_raw.zfill(8)

        # Calcular monto total de imputaciones
        monto_imputaciones = sum(
            imp['imp_monto'] for imp in imputaciones
        )
        
        # Validar que el monto del recibo no sea menor a las imputaciones
        if monto_total < monto_imputaciones:
            raise serializers.ValidationError({
                'rec_monto_total': f'El monto del recibo ({monto_total}) no puede ser menor '
                                 f'al monto de las imputaciones ({monto_imputaciones})'
            })
        
        # Validar que todas las imputaciones sean del mismo cliente
        cliente_id = data.get('cliente_id')
        for imp in imputaciones:
            if imp['imp_id_venta'].ven_idcli.id != cliente_id:
                raise serializers.ValidationError({
                    'imputaciones': 'Todas las facturas deben pertenecer al cliente seleccionado'
                })
        
        return data


class ClienteCuentaCorrienteSerializer(serializers.ModelSerializer):
    """
    Serializer para información básica del cliente en cuenta corriente
    """
    saldo_total = serializers.SerializerMethodField()
    
    class Meta:
        model = Cliente
        fields = [
            'id', 'razon', 'fantasia', 'domicilio', 
            'tel1', 'cuit', 'saldo_total'
        ]

    def get_saldo_total(self, obj):
        """
        Calcular saldo total del cliente
        """
        return getattr(obj, 'saldo_total', Decimal('0.00'))
