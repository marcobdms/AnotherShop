#!/bin/bash
# Genera el proyecto Xcode para AnotherShop iOS
# Ejecutar desde la raíz del repo: bash ios/setup.sh

set -e

echo "→ Instalando xcodegen si no está disponible..."
if ! command -v xcodegen &> /dev/null; then
  if command -v brew &> /dev/null; then
    brew install xcodegen
  else
    echo "ERROR: Homebrew no encontrado. Instala Homebrew primero: https://brew.sh"
    exit 1
  fi
fi

echo "→ Generando AnotherShop.xcodeproj..."
cd "$(dirname "$0")"
xcodegen generate

echo ""
echo "✓ Proyecto generado. Abre ios/AnotherShop.xcodeproj en Xcode."
