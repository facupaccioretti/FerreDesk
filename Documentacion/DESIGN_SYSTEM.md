# FerreDesk Design System

## Descripción General
Sistema de diseño centralizado para mantener consistencia visual en toda la aplicación FerreDesk, con enfoque en estética industrial moderna apropiada para gestión de ferretería.

## Paleta de Colores

### Colores Principales
- **`ferredesk-primario`**: `#1e293b` - Azul oscuro de las tarjetas
- **`ferredesk-primario-claro`**: `#334155` - Azul más claro para gradientes
- **`ferredesk-secundario`**: `#FF8C00` - Naranja ferretero

### Textos sobre Fondos Oscuros
- **`ferredesk-fuente`**: `#e2e8f0` - Texto principal
- **`ferredesk-fuente-secundaria`**: `#cbd5e1` - Texto secundario
- **`ferredesk-fuente-muted`**: `#94a3b8` - Texto atenuado

## Componentes

### Card
```jsx
import { Card } from '../components/ui';

// Variantes disponibles
<Card variant="default">Contenido</Card>
<Card variant="light">Contenido</Card>
<Card variant="metric">Contenido</Card>
<Card variant="dashboard">Contenido</Card>
```

### Button
```jsx
import { Button } from '../components/ui';

// Variantes disponibles
<Button variant="primary">Acción Principal</Button>
<Button variant="secondary">Acción Secundaria</Button>
<Button variant="danger">Eliminar</Button>
<Button variant="outline">Contorno</Button>

// Tamaños disponibles
<Button size="sm">Pequeño</Button>
<Button size="md">Mediano</Button>
<Button size="lg">Grande</Button>
```

### Container
```jsx
import { Container } from '../components/ui';

// Variantes disponibles
<Container variant="default">Contenido</Container>
<Container variant="dashboard">Dashboard</Container>
<Container variant="page">Página</Container>
<Container variant="metric">Métrica</Container>
```

## Clases Utilitarias

### Tarjetas
- `.ferredesk-tarjeta` - Tarjeta oscura con gradiente
- `.ferredesk-tarjeta-clara` - Tarjeta clara
- `.ferredesk-tarjeta-metrica` - Tarjeta para métricas

### Textos
- `.ferredesk-fuente` - Texto principal
- `.ferredesk-fuente-secundaria` - Texto secundario
- `.ferredesk-fuente-muted` - Texto atenuado

### Contenedores
- `.ferredesk-contenedor` - Contenedor principal
- `.ferredesk-contenedor-dashboard` - Contenedor para dashboards

### Botones
- `.ferredesk-boton-primario` - Botón principal naranja
- `.ferredesk-boton-secundario` - Botón secundario gris

### Selects
- `.ferredesk-select` - Select con estilo FerreDesk

### Fondos
- `.ferredesk-fondo` - Fondo de página
- `.ferredesk-patron` - Patrón de puntos
- `.ferredesk-overlay` - Overlay de gradiente

## Hook useFerreDeskTheme

```jsx
import { useFerreDeskTheme } from '../hooks/useFerreDeskTheme';

const MiComponente = () => {
  const theme = useFerreDeskTheme();
  
  return (
    <div className={theme.tarjeta}>
      <h2 className={theme.fuente}>Título</h2>
      <p className={theme.fuenteSecundaria}>Contenido</p>
      <button className={theme.botonPrimario}>Acción</button>
    </div>
  );
};
```

## Configuración de Gráficos

```jsx
const theme = useFerreDeskTheme();

const options = {
  plugins: {
    legend: {
      labels: {
        color: theme.grafico.leyenda
      }
    },
    title: {
      color: theme.grafico.titulo
    }
  },
  scales: {
    x: {
      ticks: {
        color: theme.grafico.ticks
      },
      grid: {
        color: theme.grafico.grilla
      }
    }
  }
};
```

## Implementación en Nuevas Páginas

### 1. Importar estilos
```jsx
import '../styles/design-tokens.css';
import '../styles/utilities.css';
```

### 2. Usar componentes
```jsx
import { Card, Button, Container, useFerreDeskTheme } from '../components/ui';

const NuevaPagina = () => {
  const theme = useFerreDeskTheme();
  
  return (
    <div className="ferredesk-fondo">
      <div className="ferredesk-patron"></div>
      <div className="ferredesk-overlay"></div>
      
      <div className="relative z-10">
        <Container variant="page">
          <Card variant="default">
            <h1 className={theme.fuente}>Título</h1>
            <p className={theme.fuenteSecundaria}>Descripción</p>
            <Button variant="primary">Acción</Button>
          </Card>
        </Container>
      </div>
    </div>
  );
};
```

## Migración de Páginas Existentes

### Antes
```jsx
<div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
  <h2 className="text-slate-800">Título</h2>
  <button className="bg-blue-600 text-white px-4 py-2 rounded">
    Acción
  </button>
</div>
```

### Después
```jsx
<Card variant="default">
  <h2 className="ferredesk-fuente">Título</h2>
  <Button variant="primary">Acción</Button>
</Card>
```

## Mejores Prácticas

1. **Usar componentes base**: Siempre preferir Card, Button, Container sobre clases directas
2. **Consistencia de colores**: Usar solo los colores definidos en el sistema
3. **Jerarquía visual**: Usar las variantes de fuente apropiadas
4. **Responsive**: Los componentes ya incluyen responsive design
5. **Accesibilidad**: Mantener contraste adecuado y focus rings

## Archivos del Sistema

- `src/styles/design-tokens.css` - Variables CSS
- `src/styles/utilities.css` - Clases utilitarias
- `src/hooks/useFerreDeskTheme.js` - Hook de tema
- `src/components/ui/` - Componentes base
- `src/components/ui/index.js` - Exportaciones
- `DESIGN_SYSTEM.md` - Esta documentación
