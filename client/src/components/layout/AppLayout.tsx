import { AppShell, Burger, Group, Title, NavLink, Box, Text, Anchor, Stack, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { IconGift, IconHome, IconKey, IconTemplate, IconDeviceMobile, IconSparkles, IconExternalLink } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';
import { useI18n } from '../../i18n';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

interface AppInfo {
  current_version: string;
  latest_version?: string;
  runtime_env: 'docker' | 'source';
  update_available: boolean;
}

const fetchAppInfo = async (): Promise<AppInfo> => {
  const response = await apiClient.get('/info');
  return response.data;
};

const UpdateInstructions = ({ runtimeEnv }: { runtimeEnv: 'docker' | 'source' }) => {
  const { t } = useI18n();
  const instruction = runtimeEnv === 'docker' ? t('app.updateDockerInstruction') : t('app.updateSourceInstruction');

  return (
    <Text size="sm" mt="xs" fw={500}>
      {instruction}
    </Text>
  );
};

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { pathname } = useLocation();
  const { t } = useI18n();
  const { data: appInfo } = useQuery({
    queryKey: ['appInfo'],
    queryFn: fetchAppInfo,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (appInfo?.current_version !== 'development' && appInfo?.update_available) {
      notifications.show({
        id: 'update-notification',
        title: t('app.updateAvailableTitle') || 'Update Available!',
        color: 'teal',
        icon: <IconGift size={18} />,
        autoClose: false,
        message: (
          <Stack gap="xs">
            <Text size="sm">
              A new version (<strong>{appInfo.latest_version}</strong>) is available. You are currently on{' '}
              <strong>{appInfo.current_version}</strong>.
            </Text>
            <UpdateInstructions runtimeEnv={appInfo.runtime_env} />
          </Stack>
        ),
      });
    }
  }, [appInfo]);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" style={{ background: 'linear-gradient(90deg, rgba(255,182,193,0.15), rgba(186,85,211,0.08))' }}>
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Title order={3} style={{ letterSpacing: 0.5 }}>{t('app.title')}</Title>
          </Link>
          
          {/* Promotional Banner for World2 iOS App */}
          <Anchor
            href="https://www.world2.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 16,
              padding: '8px 16px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #ff6b9d 0%, #c44dff 50%, #6366f1 100%)',
              border: 'none',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.85rem',
              letterSpacing: 0.3,
              boxShadow: '0 4px 15px rgba(196, 77, 255, 0.4), 0 2px 6px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(196, 77, 255, 0.5), 0 4px 10px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(196, 77, 255, 0.4), 0 2px 6px rgba(0,0,0,0.2)';
            }}
          >
            <IconDeviceMobile size={18} />
            <span>Try <strong>World2</strong> on iOS</span>
            <Badge 
              size="xs" 
              variant="filled" 
              color="rgba(255,255,255,0.25)"
              style={{ 
                color: 'white', 
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              <IconSparkles size={10} style={{ marginRight: 2 }} />
              Better than Tavern Forge
            </Badge>
            <IconExternalLink size={14} style={{ opacity: 0.8 }} />
          </Anchor>
          <Box ml="auto">
            <LanguageSwitcher />
          </Box>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Box>
          <NavLink
            component={Link}
            to="/"
            label={t('nav.projects')}
            leftSection={<IconHome size="1rem" />}
            active={pathname === '/' || pathname.startsWith('/projects')}
          />
          <NavLink
            component={Link}
            to="/credentials"
            label={t('nav.credentials')}
            leftSection={<IconKey size="1rem" />}
            active={pathname === '/credentials'}
          />
          <NavLink
            component={Link}
            to="/templates"
            label={t('nav.templates')}
            leftSection={<IconTemplate size="1rem" />}
            active={pathname === '/templates'}
          />
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
        <Box component="footer" p="md" mt="xl" style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="xs">
            {t('app.title')}
            {appInfo?.current_version && ` - ${t('footer.version')}: ${appInfo.current_version}`}
            {' | '}
            <Anchor href="#" target="_blank" c="dimmed" size="xs">
              {t('app.github')}
            </Anchor>
          </Text>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
