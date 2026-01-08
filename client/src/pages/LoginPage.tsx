import { Button, Card, Center, Stack, Text, Title, Box } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { authApi } from '../services/api';

export function LoginPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  
  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleLoginUrl();
  };
  
  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        shadow="xl"
        padding="xl"
        radius="lg"
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
        }}
      >
        <Stack align="center" gap="lg">
          <Title order={2} ta="center">
            {t('app.title')}
          </Title>
          
          <Text c="dimmed" ta="center" size="sm">
            {t('auth.loginDescription') || 'Sign in to create and manage your character cards'}
          </Text>
          
          {error && (
            <Text c="red" size="sm" ta="center">
              {error === 'no_code' && 'Authentication failed. Please try again.'}
              {error === 'callback_failed' && 'Login failed. Please try again.'}
              {!['no_code', 'callback_failed'].includes(error) && `Error: ${error}`}
            </Text>
          )}
          
          <Button
            fullWidth
            size="lg"
            variant="outline"
            leftSection={<IconBrandGoogle size={20} />}
            onClick={handleGoogleLogin}
            style={{
              borderColor: '#4285f4',
              color: '#4285f4',
            }}
          >
            {t('auth.signInWithGoogle') || 'Sign in with Google'}
          </Button>
          
          <Text c="dimmed" size="xs" ta="center">
            {t('auth.termsNotice') || 'By signing in, you agree to our Terms of Service'}
          </Text>
        </Stack>
      </Card>
    </Box>
  );
}

