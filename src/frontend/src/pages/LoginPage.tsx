import React, { useState } from 'react';
import { useAuth } from '../contexts/UseAuthHooks';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { handleApiServiceError } from '../utils/errorHandler';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Anchor, Stack, LoadingOverlay, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading: isAuthOperationLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ email, password });
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const friendlyError = handleApiServiceError(err, 'Falha no login. Verifique suas credenciais.');
      setError(friendlyError);
    }
  };

  return (
    // O Paper agora é o filho direto do Box centralizador no MainLayout.
    // Ele define sua própria largura máxima.
    <Paper
      withBorder
      shadow="md"
      p={30}
      radius="md"
      style={{ maxWidth: 420, width: '100%' }} // mx="auto" não é estritamente necessário aqui
    // pois o pai flex já centraliza.
    >
      <LoadingOverlay visible={isAuthOperationLoading} overlayProps={{ blur: 2 }} />
      <Title order={2} ta="center" mb="xl">
        Login
      </Title>

      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} title="Erro de Login" color="red" withCloseButton onClose={() => setError(null)} mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            required label="Email" placeholder="seu@email.com"
            value={email} onChange={(event) => setEmail(event.currentTarget.value)}
            autoComplete="email" error={!!error}
          />
          <PasswordInput
            required label="Senha" placeholder="Sua senha"
            value={password} onChange={(event) => setPassword(event.currentTarget.value)}
            autoComplete="current-password" error={!!error}
          />
          <Button type="submit" fullWidth mt="md" loading={isAuthOperationLoading}>
            Entrar
          </Button>
        </Stack>
      </form>

      <Text c="dimmed" size="sm" ta="center" mt="lg">
        <Anchor component={RouterLink} to="/forgot-password" size="sm" inherit>
          Esqueceu a senha?
        </Anchor>
      </Text>
      <Text c="dimmed" size="sm" ta="center" mt="xs">
        Não tem conta?{' '}
        <Anchor component={RouterLink} to="/cadastro" size="sm" inherit>
          Cadastre-se
        </Anchor>
      </Text>
    </Paper>
  );
};
export default LoginPage;