# Chat Inteligente con Socket.IO y ChatGPT (TypeScript)

Este es un proyecto de chat inteligente que utiliza Socket.IO para la comunicación en tiempo real y la API de Gemini para generar respuestas inteligentes. El proyecto está desarrollado en TypeScript para un mejor desarrollo y mantenimiento.

## Requisitos

- Node.js 20.11.0
- TypeScript 5.3.3 o superior
- Una clave de API de OpenAI (gratuita)

## Instalación

1. Clona este repositorio
2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
```
OPENAI_API_KEY=tu_clave_api_aqui
PORT=3000
```

4. Reemplaza `tu_clave_api_aqui` con tu clave de API de OpenAI

## Uso

Para iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

Para compilar el proyecto:
```bash
npm run build
```

Para iniciar el servidor en modo producción:
```bash
npm start
```

El chat estará disponible en `http://localhost:3000`

## Estructura del Proyecto

```
.
├── src/                # Código fuente TypeScript
│   └── server.ts      # Servidor principal
├── public/            # Archivos estáticos
│   └── index.html     # Interfaz de usuario
├── dist/              # Código compilado (generado)
├── package.json       # Dependencias y scripts
├── tsconfig.json      # Configuración de TypeScript
└── .env              # Variables de entorno
```

## Características

- Interfaz de usuario moderna y responsive
- Comunicación en tiempo real con Socket.IO
- Integración con gemini
- Diseño similar a WhatsApp
- Soporte para mensajes de error
- Historial de chat en tiempo real
- Tipado estático con TypeScript
- Desarrollo más seguro y mantenible

## Notas

- Asegúrate de tener una conexión a internet estable
- La API de OpenAI tiene límites de uso, consulta su documentación para más detalles
- El proyecto está configurado para usar el modelo gemini-lite
