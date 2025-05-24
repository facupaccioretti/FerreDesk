from rest_framework import serializers
from .models import ReservaStock, FormLock

class ReservaStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservaStock
        fields = '__all__'
        read_only_fields = ('usuario', 'session_key', 'timestamp_creacion', 'timestamp_expiracion', 'estado')

class FormLockSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormLock
        fields = '__all__'
        read_only_fields = ('usuario', 'session_key', 'timestamp_creacion', 'timestamp_expiracion') 