import csv
import json
from collections.abc import Mapping

from django.core.management.base import BaseCommand, CommandError
from django.urls import URLPattern, URLResolver, get_resolver

from ferreapps.usuarios.permisos import CATALOGO_PERMISOS
from ferredesk_backend.permissions import RequierePermisoFuncional


URLCONFS = ('ferredesk_backend.urls', 'ferredesk_backend.urls_public')
CORTE_ACTUAL = '3.0'
EXENCIONES_VALIDAS = frozenset({
    'publica',
    'sesion_exenta',
    'infraestructura',
    'deprecada',
})
CAMPOS = (
    'corte',
    'urlconf',
    'ruta',
    'metodo',
    'callback',
    'accion',
    'clasificacion',
    'detalle',
)


def _recorrer_patrones(patrones, prefijo=''):
    for patron in patrones:
        ruta = f'{prefijo}{patron.pattern}'
        if isinstance(patron, URLResolver):
            yield from _recorrer_patrones(patron.url_patterns, ruta)
        elif isinstance(patron, URLPattern):
            yield ruta, patron.callback


def _objetivos_callback(callback):
    yield callback
    clase = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    if clase is not None:
        yield clase


def _tiene_permission_class(callback):
    for objetivo in _objetivos_callback(callback):
        if getattr(objetivo, 'requiere_permiso_funcional', False):
            return True
        for clase_permiso in getattr(objetivo, 'permission_classes', ()):
            try:
                if issubclass(clase_permiso, RequierePermisoFuncional):
                    return True
            except TypeError:
                if isinstance(clase_permiso, RequierePermisoFuncional):
                    return True
    return False


def _valor_atributo(callback, nombre, default=None):
    for objetivo in _objetivos_callback(callback):
        valor = getattr(objetivo, nombre, None)
        if valor is not None:
            return valor
    return default


def _permiso_declarado(callback, accion):
    for objetivo in _objetivos_callback(callback):
        if isinstance(objetivo, type) and 'get_permiso_requerido' in objetivo.__dict__:
            vista = objetivo()
            vista.action = accion
            try:
                return vista.get_permiso_requerido()
            except (AttributeError, TypeError):
                return None

    permisos_por_accion = _valor_atributo(callback, 'permisos_por_accion')
    if accion and isinstance(permisos_por_accion, Mapping):
        return permisos_por_accion.get(accion)
    permiso_id = _valor_atributo(callback, 'permiso_requerido')
    if permiso_id:
        return permiso_id
    for objetivo in _objetivos_callback(callback):
        for clase_permiso in getattr(objetivo, 'permission_classes', ()):
            if isinstance(clase_permiso, type) and issubclass(
                clase_permiso,
                RequierePermisoFuncional,
            ):
                permiso_id = getattr(clase_permiso, 'permiso_requerido', None)
                if permiso_id:
                    return permiso_id
    return None


def _obtener_exencion(callback, accion=None):
    exenciones_por_accion = _valor_atributo(callback, 'exenciones_por_accion')
    if accion and isinstance(exenciones_por_accion, Mapping):
        exencion = exenciones_por_accion.get(accion)
        if exencion in EXENCIONES_VALIDAS:
            return exencion
    exencion = _valor_atributo(callback, 'exencion_permiso')
    return exencion if exencion in EXENCIONES_VALIDAS else None


def _nombre_callback(callback):
    objetivo = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None) or callback
    return f'{objetivo.__module__}.{objetivo.__qualname__}'


def _operaciones_callback(callback):
    acciones = getattr(callback, 'actions', None) or getattr(callback, 'action_map', None)
    if isinstance(acciones, Mapping):
        for metodo, accion in acciones.items():
            if metodo.lower() not in {'head', 'options'}:
                yield metodo.upper(), accion
        return

    objetivo = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    metodos = _valor_atributo(callback, 'allowed_methods')
    if isinstance(metodos, (list, tuple, set, frozenset)):
        for metodo in metodos:
            if metodo.lower() not in {'head', 'options'}:
                yield metodo.upper(), metodo.lower()
        return

    if objetivo is not None:
        for metodo in getattr(objetivo, 'http_method_names', ()):
            if metodo not in {'head', 'options'} and callable(getattr(objetivo, metodo, None)):
                yield metodo.upper(), metodo
        return

    yield 'ANY', ''


def _es_ruta_api(ruta):
    return ruta.lstrip('^/').startswith('api/')


def _clave_corte(corte):
    try:
        return tuple(int(parte) for parte in str(corte).split('.'))
    except ValueError:
        return ()


def _validar_deprecada(callback, metodo, corte):
    metodos = _valor_atributo(callback, 'metodos_deprecados', ())
    if metodo not in {valor.upper() for valor in metodos}:
        return 'error', f'metodo_deprecado_no_declarado:{metodo}'

    retiro = _valor_atributo(callback, 'retiro_deprecado_en', '')
    if retiro and corte and _clave_corte(corte) >= _clave_corte(retiro):
        return 'error', f'ruta_deprecada_vigente_desde:{retiro}'
    return 'exento', 'deprecada'


def _clasificar(callback, metodo, accion, corte):
    exencion = _obtener_exencion(callback, accion)
    if exencion == 'deprecada':
        return _validar_deprecada(callback, metodo, corte)
    if exencion:
        return 'exento', exencion
    if not _tiene_permission_class(callback):
        return 'sin_clasificar', ''

    permiso_id = _permiso_declarado(callback, accion)
    if not permiso_id:
        return 'sin_clasificar', 'permiso_no_declarado'
    permisos = (permiso_id,) if isinstance(permiso_id, str) else tuple(permiso_id)
    desconocidos = [permiso for permiso in permisos if permiso not in CATALOGO_PERMISOS]
    if desconocidos:
        return 'error', f'permiso_desconocido:{",".join(desconocidos)}'
    return 'permiso', '+'.join(permisos)


def _obtener_resolvers():
    for urlconf in URLCONFS:
        yield urlconf, get_resolver(urlconf)


def _generar_filas(corte=''):
    for urlconf, resolver in _obtener_resolvers():
        for ruta, callback in _recorrer_patrones(resolver.url_patterns):
            corte_callback = _valor_atributo(callback, 'corte_permisos', '')
            if corte and corte_callback != corte:
                continue
            for metodo, accion in _operaciones_callback(callback):
                clasificacion, detalle = _clasificar(
                    callback,
                    metodo,
                    accion,
                    corte or CORTE_ACTUAL,
                )
                yield {
                    'corte': corte_callback or corte,
                    'urlconf': urlconf,
                    'ruta': ruta,
                    'metodo': metodo,
                    'callback': _nombre_callback(callback),
                    'accion': accion,
                    'clasificacion': clasificacion,
                    'detalle': detalle,
                }


def _emitir_filas(stdout, filas, formato):
    if formato == 'json':
        stdout.write(json.dumps(filas, ensure_ascii=False, indent=2))
        return
    if formato == 'csv':
        writer = csv.DictWriter(stdout, fieldnames=CAMPOS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(filas)
        return

    stdout.write('\t'.join(CAMPOS))
    for fila in filas:
        stdout.write('\t'.join(str(fila[campo]) for campo in CAMPOS))


class Command(BaseCommand):
    help = 'Verifica la cobertura de permisos funcionales del URL resolver.'

    def add_arguments(self, parser):
        parser.add_argument('--corte', default='')
        parser.add_argument(
            '--format',
            dest='formato',
            choices=('tab', 'csv', 'json'),
            default='tab',
        )
        parser.add_argument('--fail-on-unclassified', action='store_true')

    def handle(self, *args, **options):
        corte = options['corte']
        filas = list(_generar_filas(corte))
        _emitir_filas(self.stdout, filas, options['formato'])

        errores = [fila for fila in filas if fila['clasificacion'] == 'error']
        sin_clasificar = [
            fila
            for fila in filas
            if fila['clasificacion'] == 'sin_clasificar' and _es_ruta_api(fila['ruta'])
        ]
        if errores:
            if all(
                fila['detalle'].startswith('permiso_desconocido:')
                for fila in errores
            ):
                raise CommandError(
                    f'{len(errores)} operaciones declaran permisos desconocidos.'
                )
            raise CommandError(f'{len(errores)} operaciones con errores de cobertura.')
        if sin_clasificar and (corte or options['fail_on_unclassified']):
            raise CommandError(f'{len(sin_clasificar)} operaciones API sin clasificar.')
