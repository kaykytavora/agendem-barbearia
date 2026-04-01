import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para criar um ícone SVG otimizado para PWA
function createPWAIcon(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6c47ff"/>
      <stop offset="100%" style="stop-color:#4f46e5"/>
    </linearGradient>
  </defs>

  <!-- Background circle with safe zone -->
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.4}" fill="url(#bg)"/>

  <!-- Letter A for Agendem -->
  <text x="${size/2}" y="${size/2 + size*0.08}"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="bold"
        font-size="${size*0.25}"
        fill="white">A</text>

  <!-- Three dots representing appointments -->
  <circle cx="${size*0.35}" cy="${size*0.75}" r="${size*0.02}" fill="white" opacity="0.9"/>
  <circle cx="${size*0.5}" cy="${size*0.75}" r="${size*0.02}" fill="white" opacity="0.9"/>
  <circle cx="${size*0.65}" cy="${size*0.75}" r="${size*0.02}" fill="white" opacity="0.9"/>

  <!-- Small calendar icon -->
  <rect x="${size*0.42}" y="${size*0.2}" width="${size*0.16}" height="${size*0.12}" rx="${size*0.01}" fill="white" opacity="0.8"/>
  <rect x="${size*0.44}" y="${size*0.22}" width="${size*0.12}" height="${size*0.06}" rx="${size*0.005}" fill="#6c47ff"/>
</svg>`;
}

// Criar os ícones SVG
const icon192 = createPWAIcon(192);
const icon512 = createPWAIcon(512);

// Salvar os arquivos
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), icon192);
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), icon512);

console.log('✅ Ícones SVG gerados com sucesso!');
console.log('📁 Localizados em: public/icons/');
console.log('');
console.log('📋 Próximos passos:');
console.log('1. Abra os arquivos SVG em um navegador');
console.log('2. Use a ferramenta de captura de tela ou "Salvar como PNG"');
console.log('3. Ou use um conversor online como https://convertio.co/svg-png/');
console.log('');
console.log('🎯 Para converter automaticamente, você pode:');
console.log('- Instalar ImageMagick: https://imagemagick.org/');
console.log('- Usar: magick icon-192.svg icon-192x192.png');
console.log('- Usar: magick icon-512.svg icon-512x512.png');