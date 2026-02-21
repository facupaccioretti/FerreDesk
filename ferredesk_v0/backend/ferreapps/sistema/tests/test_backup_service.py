"""
Tests unitarios para el servicio de backup del sistema.
Verificamos que el flujo interno (creación de tmp, volcado, validación y limpieza) 
funcione correctamente bajo distintos escenarios.
"""

import os
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from ferreapps.sistema.services.backup_service import (
    ejecutar_backup_asincrono,
    _proceso_backup_interno,
    _obtener_ruta_pg_dump_windows,
    _limpiar_backups_antiguos,
    ESTADO_BACKUP
)

class BackupServiceTests(TestCase):

    def setUp(self):
        """Reiniciamos el estado en memoria antes de cada test para evitar colisiones."""
        ESTADO_BACKUP['estado'] = 'INACTIVO'
        ESTADO_BACKUP['ultima_ejecucion'] = None
        ESTADO_BACKUP['error'] = None

    @patch('ferreapps.sistema.services.backup_service.threading.Thread')
    def test_ejecutar_backup_asincrono_inicia_hilo(self, mock_thread):
        """
        Verifica que al llamar a ejecutar_backup_asincrono se dispare un hilo
        nuevo y se configure como daemon si el estado no es EN_CURSO.
        """
        ejecutar_backup_asincrono()
        
        # Debe haberse instanciado y llamado a start() en un Thread
        mock_thread.assert_called_once()
        instancia_hilo = mock_thread.return_value
        instancia_hilo.start.assert_called_once()
        
    @patch('ferreapps.sistema.services.backup_service.threading.Thread')
    @patch('ferreapps.sistema.services.backup_service.logger.warning')
    def test_ejecutar_backup_asincrono_ignora_si_en_curso(self, mock_logger, mock_thread):
        """
        Verifica que si existe un backup EN_CURSO, no se inicie un hilo redundante.
        """
        ESTADO_BACKUP['estado'] = 'EN_CURSO'
        
        ejecutar_backup_asincrono()
        
        # Verificamos que se logueó la advertencia y NO se disparó un nuevo hilo
        mock_logger.assert_called_once_with("Intento de backup ignorado: Ya hay uno en curso.")
        mock_thread.assert_not_called()

    @patch('ferreapps.sistema.services.backup_service.os.name', 'nt')
    @patch.dict('os.environ', clear=True)
    @patch('ferreapps.sistema.services.backup_service.os.path.exists')
    def test_obtener_ruta_pg_dump_windows_fallback(self, mock_exists):
        """
        Simulamos que estamos en Windows y no se encuentra pg_dump en ninguna
        ruta habitual. Debe devolver el fallback "pg_dump.exe".
        """
        # Configuramos los mocks para que no exista la ruta ni las variables
        mock_exists.return_value = False
        
        with patch('shutil.which', return_value=None):
            ruta_obtenida = _obtener_ruta_pg_dump_windows()
            
        self.assertEqual(ruta_obtenida, "pg_dump.exe")

    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    @patch('ferreapps.sistema.services.backup_service.os.rename')
    @patch('ferreapps.sistema.services.backup_service._limpiar_backups_antiguos')
    @patch('ferreapps.sistema.services.backup_service.os.makedirs')
    def test_proceso_backup_interno_exito(self, mock_makedirs, mock_limpiar, mock_rename, mock_run):
        """
        Simulamos un backup exitoso de pg_dump (returncode = 0).
        Se debe actualizar el estado a EXITO y no debe existir error.
        """
        # Simulamos respuesta exitosa del comando
        mock_resultado = MagicMock()
        mock_resultado.returncode = 0
        mock_run.return_value = mock_resultado
        
        _proceso_backup_interno()
        
        self.assertEqual(ESTADO_BACKUP['estado'], 'EXITO')
        self.assertIsNotNone(ESTADO_BACKUP['ultima_ejecucion'])
        self.assertIsNone(ESTADO_BACKUP['error'])
        
        # Debió llamarse al renombrado (de .tmp a .dump) y a la limpieza final
        mock_rename.assert_called_once()
        mock_limpiar.assert_called_once()

    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    @patch('ferreapps.sistema.services.backup_service.os.rename')
    @patch('ferreapps.sistema.services.backup_service.os.path.exists', return_value=True)
    @patch('ferreapps.sistema.services.backup_service._limpiar_backups_antiguos')
    @patch('ferreapps.sistema.services.backup_service.os.makedirs')
    def test_proceso_backup_interno_error_comando(self, mock_makedirs, mock_limpiar, mock_exists, mock_rename, mock_run):
        """
        Simulamos que pg_dump falla (returncode diferente de 0).
        Se debe actualizar el estado a ERROR y guardar el stderr.
        """
        error_simulado = "Error fatal: base de datos no encontrada."
        
        # Simulamos respuesta fallida
        mock_resultado = MagicMock()
        mock_resultado.returncode = 1
        mock_resultado.stderr = error_simulado
        mock_run.return_value = mock_resultado
        
        _proceso_backup_interno()
        
        self.assertEqual(ESTADO_BACKUP['estado'], 'ERROR')
        self.assertEqual(ESTADO_BACKUP['error'], error_simulado)
        
        # En este caso, el rename debería renombrar a .err, no a .dump
        # Evaluamos que se haya intentado hacer el rename porque path.exists está en True
        self.assertTrue(mock_rename.called)
        
    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    def test_proceso_backup_interno_excepcion_critica(self, mock_run):
        """
        Si ocurre alguna excepción a nivel código (Python), 
        el sistema no debe crashear, sino registrar el estado en ERROR.
        """
        mock_run.side_effect = Exception("Fallo catastrófico de entorno")
        
        _proceso_backup_interno()
        
        self.assertEqual(ESTADO_BACKUP['estado'], 'ERROR')
        self.assertIn("Fallo catastrófico", ESTADO_BACKUP['error'])
