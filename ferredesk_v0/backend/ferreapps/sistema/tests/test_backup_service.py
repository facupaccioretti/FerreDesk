"""
Tests unitarios para el servicio de backup del sistema.
Verificamos que el flujo interno (creacion de tmp, volcado, validacion y limpieza)
funcione correctamente bajo distintos escenarios.
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase

from ferreapps.sistema.services.backup_service import (
    ESTADO_BACKUP,
    _construir_nombre_archivo_backup,
    _construir_sentencia_pg_dump,
    _obtener_ruta_pg_dump_windows,
    _proceso_backup_interno,
    _validar_schema_respaldo,
    ejecutar_backup_asincrono,
)


class BackupServiceTests(TestCase):

    def setUp(self):
        """Reiniciamos el estado en memoria antes de cada test para evitar colisiones."""
        ESTADO_BACKUP['estado'] = 'INACTIVO'
        ESTADO_BACKUP['ultima_ejecucion'] = None
        ESTADO_BACKUP['error'] = None

    @patch('ferreapps.sistema.services.backup_service.threading.Thread')
    @patch('ferreapps.sistema.services.backup_service._obtener_schema_activo', return_value='ferretest')
    def test_ejecutar_backup_asincrono_inicia_hilo_con_schema_activo(self, mock_schema, mock_thread):
        """
        Verifica que al llamar a ejecutar_backup_asincrono se dispare un hilo
        nuevo y se le pase el schema activo para no perder el tenant.
        """
        ejecutar_backup_asincrono()

        mock_thread.assert_called_once_with(target=_proceso_backup_interno, args=('ferretest',))
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
        mock_exists.return_value = False

        with patch('shutil.which', return_value=None):
            ruta_obtenida = _obtener_ruta_pg_dump_windows()

        self.assertEqual(ruta_obtenida, "pg_dump.exe")

    def test_construir_nombre_archivo_backup_incluye_schema(self):
        nombre = _construir_nombre_archivo_backup('tenant-demo', '20260612_120000', 'dump')
        self.assertEqual(nombre, 'backup_tenant-demo_20260612_120000.dump')

    def test_construir_sentencia_pg_dump_incluye_schema(self):
        sentencia = _construir_sentencia_pg_dump(
            comando_pg_dump='pg_dump',
            config_db={
                'HOST': 'localhost',
                'PORT': '5432',
                'USER': 'postgres',
                'NAME': 'ferredesk',
            },
            schema_name='ferretest',
            ruta_archivo_tmp='/tmp/backup_ferretest_20260612_120000.tmp',
        )

        self.assertIn('--schema=ferretest', sentencia)
        self.assertEqual(sentencia[-1], '/tmp/backup_ferretest_20260612_120000.tmp')

    def test_validar_schema_respaldo_rechaza_public(self):
        with self.assertRaisesMessage(
            ValueError,
            "El backup operativo de tenants no permite respaldar el schema 'public'."
        ):
            _validar_schema_respaldo('public')

    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    @patch('ferreapps.sistema.services.backup_service.os.rename')
    @patch('ferreapps.sistema.services.backup_service._limpiar_backups_antiguos')
    @patch('ferreapps.sistema.services.backup_service.os.makedirs')
    def test_proceso_backup_interno_exito(self, mock_makedirs, mock_limpiar, mock_rename, mock_run):
        """
        Simulamos un backup exitoso de pg_dump (returncode = 0).
        Se debe actualizar el estado a EXITO y no debe existir error.
        """
        mock_resultado = MagicMock()
        mock_resultado.returncode = 0
        mock_run.return_value = mock_resultado

        _proceso_backup_interno(schema_name='ferretest')

        self.assertEqual(ESTADO_BACKUP['estado'], 'EXITO')
        self.assertIsNotNone(ESTADO_BACKUP['ultima_ejecucion'])
        self.assertIsNone(ESTADO_BACKUP['error'])
        mock_rename.assert_called_once()
        mock_limpiar.assert_called_once()

        sentencia = mock_run.call_args.args[0]
        self.assertIn('--schema=ferretest', sentencia)
        self.assertIn('backup_ferretest_', sentencia[-1])
        self.assertIn('backup_ferretest_', mock_rename.call_args.args[0])
        self.assertIn('backup_ferretest_', mock_rename.call_args.args[1])

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

        mock_resultado = MagicMock()
        mock_resultado.returncode = 1
        mock_resultado.stderr = error_simulado
        mock_run.return_value = mock_resultado

        _proceso_backup_interno(schema_name='ferretest')

        self.assertEqual(ESTADO_BACKUP['estado'], 'ERROR')
        self.assertEqual(ESTADO_BACKUP['error'], error_simulado)
        self.assertTrue(mock_rename.called)

        sentencia = mock_run.call_args.args[0]
        self.assertIn('--schema=ferretest', sentencia)
        self.assertIn('backup_ferretest_', mock_rename.call_args.args[1])

    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    def test_proceso_backup_interno_rechaza_public(self, mock_run):
        """
        El flujo operativo de tenant debe rechazar explicitamente el schema public.
        """
        _proceso_backup_interno(schema_name='public')

        self.assertEqual(ESTADO_BACKUP['estado'], 'ERROR')
        self.assertIn("no permite respaldar el schema 'public'", ESTADO_BACKUP['error'])
        mock_run.assert_not_called()

    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    def test_proceso_backup_interno_pg_dump_no_encontrado(self, mock_run):
        """
        Si pg_dump no esta instalado, subprocess.run lanza FileNotFoundError.
        El servicio debe registrar ERROR con mensaje amigable para el frontend.
        """
        mock_run.side_effect = FileNotFoundError("pg_dump no encontrado en el PATH")

        _proceso_backup_interno(schema_name='ferretest')

        self.assertEqual(ESTADO_BACKUP['estado'], 'ERROR')
        self.assertEqual(
            ESTADO_BACKUP['error'],
            'El comando pg_dump no se encuentra instalado en el servidor.'
        )

    @patch('ferreapps.sistema.services.backup_service.subprocess.run')
    def test_proceso_backup_interno_excepcion_critica(self, mock_run):
        """
        Si ocurre alguna excepcion a nivel codigo (Python),
        el sistema no debe crashear, sino registrar el estado en ERROR.
        """
        mock_run.side_effect = Exception("Fallo catastrofico de entorno")

        _proceso_backup_interno(schema_name='ferretest')

        self.assertEqual(ESTADO_BACKUP['estado'], 'ERROR')
        self.assertIn("Fallo catastrofico", ESTADO_BACKUP['error'])
