import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthProvider.tsx';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ColorSchemeScript é para SSR ou se você for gerenciar tema escuro/claro com Mantine */}
    {/* Para um app CSR simples, pode não ser estritamente necessário inicialmente */}
    {/* <ColorSchemeScript defaultColorScheme="auto" />  */}
    <MantineProvider
      theme={{
        // Você pode definir sua cor primária aqui
        // O Mantine tem cores pré-definidas (blue, red, green, etc.) e shades (0-9)
        // Exemplo: usar o azul padrão do Mantine como primário
        primaryColor: 'blue',
        // fontFamily: 'Verdana, sans-serif', // Se quiser mudar a fonte padrão
        // Você pode adicionar mais customizações de tema aqui no futuro
      }}
      defaultColorScheme="light" // Ou 'dark' ou 'auto'
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ToastContainer
            position="top-right" autoClose={3000} hideProgressBar={false}
            newestOnTop={false} closeOnClick rtl={false}
            pauseOnFocusLoss draggable pauseOnHover theme="colored"
          />
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
)