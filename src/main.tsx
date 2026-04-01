import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        // Verificar por atualizações
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão disponível - notificação mais suave
                console.log('Nova versão da aplicação disponível');

                // Criar notificação discreta em vez de popup invasivo
                const updateBanner = document.createElement('div');
                updateBanner.innerHTML = `
                  <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #1f2937;
                    color: white;
                    padding: 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 9999;
                    max-width: 300px;
                    font-family: system-ui;
                    font-size: 14px;
                    line-height: 1.4;
                  ">
                    <div style="margin-bottom: 12px;">
                      <strong>Nova versão disponível!</strong><br>
                      Atualize para obter as últimas melhorias.
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button id="update-now" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                      ">Atualizar</button>
                      <button id="update-later" style="
                        background: transparent;
                        color: #9ca3af;
                        border: 1px solid #4b5563;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                      ">Depois</button>
                    </div>
                  </div>
                `;
                document.body.appendChild(updateBanner);

                // Handlers dos botões
                document.getElementById('update-now')?.addEventListener('click', () => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                });

                document.getElementById('update-later')?.addEventListener('click', () => {
                  updateBanner.remove();
                });

                // Auto-remover após 10 segundos
                setTimeout(() => {
                  if (document.body.contains(updateBanner)) {
                    updateBanner.remove();
                  }
                }, 10000);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Erro ao registrar Service Worker:', error);
      });
  });

  // Detectar quando o service worker toma controle
  // REMOVIDO: refresh automático que causava UX ruim
  // navigator.serviceWorker.addEventListener('controllerchange', () => {
  //   window.location.reload();
  // });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
