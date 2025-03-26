#!/bin/bash

# Crear carpeta principal
mkdir -p ferredesk
cd ferredesk

# Crear estructura del backend
mkdir -p backend/app/{api,core,db,schemas}
touch backend/app/{main.py,__init__.py}
touch backend/app/api/__init__.py
touch backend/app/core/config.py
touch backend/app/db/{base.py,session.py}
touch backend/app/schemas/__init__.py
touch backend/requirements.txt
touch backend/.env

# Crear estructura del frontend con Vite
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api
cd ..

# Inicializar Tauri dentro del frontend
cd frontend
npx tauri init
cd ..

# Crear estructura src del frontend
mkdir -p frontend/src/{assets,components,pages,services,hooks,utils}
touch frontend/src/{App.tsx,main.tsx}
touch frontend/.env

# Crear carpeta raíz adicional
touch docker-compose.yml
touch .gitignore
touch README.md

echo "✅ Estructura del proyecto FerreDesk creada con éxito."