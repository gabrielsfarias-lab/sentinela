import React, { type ReactNode } from 'react';
import { AppShell, Box, Text, Group, useMantineTheme } from '@mantine/core';
import { Link as RouterLink } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const theme = useMantineTheme();

    return (
        <AppShell
            padding={0}
            style={{ maxWidth: '100vw', maxHeight: '100vh' }} // Garante que o AppShell ocupe toda a tela
        >
            <AppShell.Header px="md" style={{ height: 60 }}>
                <Group justify="space-between" style={{ height: '100%' }}>
                    <Text size="xl" fw={700} component={RouterLink} to="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
                        Gestor de Documentos
                    </Text>
                </Group>
            </AppShell.Header>

            <AppShell.Main
                style={{
                    backgroundColor: theme.colors.white ? theme.colors.gray[8] : theme.colors.gray[0],
                    flexGrow: 1, // Garante que Main ocupe o espaço vertical
                    display: 'flex', // Torna Main um container flex
                    flexDirection: 'column',
                }}
            >
                <ToastContainer
                    position="top-right" autoClose={3000} hideProgressBar={false}
                    newestOnTop={false} closeOnClick rtl={false}
                    pauseOnFocusLoss draggable pauseOnHover theme="colored"
                />
                {/* Este Box é o container direto do children (sua página) */}
                {/* Ele usará flex para centralizar o children */}
                <Box
                    style={{
                        flexGrow: 1,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center', // Centraliza horizontalmente o children
                        alignItems: 'center',   // Centraliza verticalmente o children
                        padding: theme.spacing.md, // Padding em volta do conteúdo da página
                        boxSizing: 'border-box',
                    }}
                >
                    {/* O children (LoginPage, DashboardPage) será renderizado aqui */}
                    {/* A própria página (ex: o Paper do LoginPage) definirá sua própria largura máxima */}
                    {children}
                </Box>
            </AppShell.Main>

            <AppShell.Footer px="md" style={{ height: 60 }}>
                <Text c="dimmed" size="sm" ta="center">
                    © {new Date().getFullYear()} Seu Nome/Empresa. Todos os direitos reservados.
                </Text>
            </AppShell.Footer>
        </AppShell>
    );
};

export default MainLayout;