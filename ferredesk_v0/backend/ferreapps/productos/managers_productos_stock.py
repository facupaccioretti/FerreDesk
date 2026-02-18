from django.db import models
from django.db.models import Sum, F, Case, When, Value, DecimalField, OuterRef, Subquery
from django.db.models.functions import Coalesce

class ProductosStockQuerySet(models.QuerySet):
    def con_stock_total(self):
        """
        Replica la lógica de la vista SQL VISTA_STOCK_PRODUCTO usando Django ORM.
        Calcula el stock total sumando todas las cantidades por proveedor y 
        determina si es necesaria la reposición basándose en el stock mínimo.
        """
        from .models import StockProve
        
        agregado_stock_proveedores = StockProve.objects.filter(
            stock=OuterRef('pk')
        ).order_by().values('stock').annotate(
            total=Sum('cantidad')
        ).values('total')
        
        stock_total_calculado = Coalesce(
            Subquery(agregado_stock_proveedores, output_field=DecimalField(max_digits=15, decimal_places=2)),
            Value(0.0, output_field=DecimalField())
        )
        
        # --- 2. Lógica de Reposición ---
        # CASE WHEN stock_total <= cantidad_minima THEN 1 ELSE 0 END
        necesita_reposicion_logica = Case(
            When(stock_total__lte=F('cantmin'), then=Value(1)),
            default=Value(0),
            output_field=models.IntegerField()
        )

        return self.annotate(
            stock_total=stock_total_calculado,
            necesita_reposicion=necesita_reposicion_logica,
            proveedor_razon=F('proveedor_habitual__razon'),
            proveedor_fantasia=F('proveedor_habitual__fantasia'),
            # Alias para compatibilidad con nombres de la vista original
            denominacion=F('deno'),
            codigo_venta=F('codvta'),
            cantidad_minima=F('cantmin')
        )
