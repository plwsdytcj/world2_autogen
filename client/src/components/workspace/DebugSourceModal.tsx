import {
  Modal,
  ScrollArea,
  Code,
  Loader,
  Alert,
  Title,
  Stack,
  Group,
  Text,
  Badge,
  Tabs,
  Image,
  Button,
  CopyButton,
  Tooltip,
  Box,
} from '@mantine/core';
import { useProjectSourceDetails } from '../../hooks/useProjectSources';
import { IconAlertCircle, IconCopy, IconCheck, IconPhoto } from '@tabler/icons-react';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/formatDate';

interface DebugSourceModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  sourceId: string | null;
}

export function DebugSourceModal({ opened, onClose, projectId, sourceId }: DebugSourceModalProps) {
  const { data, isLoading, isError, error } = useProjectSourceDetails(projectId, sourceId);
  const source = data?.data;
  const { t } = useI18n();

  const apiBase = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api';
  const toProxy = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith('/api/images')) {
      return url;
    }
    return `${apiBase}/proxy/image?url=${encodeURIComponent(url)}`;
  };

  const debugData = source
    ? {
        url: source.url,
        content_type: source.content_type,
        content_char_count: source.content_char_count,
        last_crawled_at: source.last_crawled_at,
        raw_content: source.raw_content,
        all_image_url: source.all_image_url || [],
        is_facebook: source.url?.includes('facebook.com') || source.url?.includes('fb.com'),
      }
    : null;

  const jsonData = JSON.stringify(debugData, null, 2);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={<Title order={4}>{t('sources.debugTitle') || 'Debug: Source Details'}</Title>}
    >
      {isLoading && <Loader />}
      {isError && (
        <Alert icon={<IconAlertCircle size="1rem" />} title={t('viewSource.error') || 'Error'} color="red">
          {error.message}
        </Alert>
      )}
      {source && debugData && (
        <Stack gap="md">
          {/* Summary Info */}
          <Group justify="space-between">
            <Group>
              <Text size="sm" fw={500}>
                {t('sources.url')}: {source.url}
              </Text>
              {debugData.is_facebook && (
                <Badge size="sm" color="blue">
                  Facebook
                </Badge>
              )}
            </Group>
            <Group>
              {source.last_crawled_at && (
                <Text size="xs" c="dimmed">
                  {t('character.lastFetched')}: {formatDate(source.last_crawled_at)}
                </Text>
              )}
            </Group>
          </Group>

          <Group>
            <Badge variant="light" color="gray">
              {t('sources.contentType') || 'Content Type'}: {source.content_type || 'N/A'}
            </Badge>
            <Badge variant="light" color="gray">
              {t('sources.charCount') || 'Characters'}: {source.content_char_count || 0}
            </Badge>
            <Badge variant="light" color="gray">
              {t('sources.imageCount') || 'Images'}: {debugData.all_image_url.length}
            </Badge>
          </Group>

          {/* Tabs for different views */}
          <Tabs defaultValue="images">
            <Tabs.List>
              <Tabs.Tab value="images" leftSection={<IconPhoto size={16} />}>
                {t('sources.images') || 'Images'} ({debugData.all_image_url.length})
              </Tabs.Tab>
              <Tabs.Tab value="content">
                {t('sources.content') || 'Content'} ({source.content_char_count || 0} chars)
              </Tabs.Tab>
              <Tabs.Tab value="json">JSON Debug</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="images" pt="md">
              {debugData.all_image_url.length > 0 ? (
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      {t('sources.imageList') || 'Image URLs (first is typically the avatar)'}
                    </Text>
                    <CopyButton value={debugData.all_image_url.join('\n')}>
                      {({ copied, copy }) => (
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          onClick={copy}
                        >
                          {copied ? t('common.copied') || 'Copied' : t('common.copy') || 'Copy All URLs'}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                  <ScrollArea h={400}>
                    <Stack gap="sm">
                      {debugData.all_image_url.map((url, index) => (
                        <Stack key={index} gap="xs" p="xs" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: '4px' }}>
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                              <Badge size="xs" variant="light" color={index === 0 ? 'blue' : 'gray'}>
                                {index === 0 ? t('sources.avatar') || 'Avatar' : `#${index + 1}`}
                              </Badge>
                              <Text size="xs" style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                {url}
                              </Text>
                            </Group>
                            <Group gap="xs" wrap="nowrap">
                              <CopyButton value={url}>
                                {({ copied, copy }) => (
                                  <Tooltip label={copied ? t('common.copied') || 'Copied' : t('common.copy') || 'Copy'}>
                                    <Button size="xs" variant="subtle" onClick={copy}>
                                      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                    </Button>
                                  </Tooltip>
                                )}
                              </CopyButton>
                            </Group>
                          </Group>
                          <Group>
                            <Box w={120} h={120} style={{ position: 'relative' }}>
                              <Image
                                src={toProxy(url)}
                                alt={`Image ${index + 1}`}
                                w={120}
                                h={120}
                                fit="cover"
                                radius="sm"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <Group
                                w={120}
                                h={120}
                                style={{
                                  display: 'none',
                                  border: '1px dashed var(--mantine-color-dark-4)',
                                  borderRadius: '4px',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                }}
                                justify="center"
                              >
                                <Text size="xs" c="dimmed" ta="center">
                                  {t('sources.imageLoadFailed') || 'Failed to load'}
                                </Text>
                              </Group>
                            </Box>
                            <Stack gap="xs" style={{ flex: 1 }}>
                              <Text size="xs" c="dimmed">
                                {url.startsWith('/api/images') ? (
                                  <Badge size="xs" color="green" variant="light">
                                    {t('sources.localImage') || 'Local (Downloaded)'}
                                  </Badge>
                                ) : (
                                  <Badge size="xs" color="yellow" variant="light">
                                    {t('sources.externalImage') || 'External (May expire)'}
                                  </Badge>
                                )}
                              </Text>
                              {url.includes('fbcdn.net') && (
                                <Text size="xs" c="orange">
                                  ⚠️ {t('sources.facebookCdnWarning') || 'Facebook CDN - signature may expire'}
                                </Text>
                              )}
                            </Stack>
                          </Group>
                        </Stack>
                      ))}
                    </Stack>
                  </ScrollArea>
                </Stack>
              ) : (
                <Alert color="gray">{t('sources.noImages') || 'No images found'}</Alert>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="content" pt="md">
              <ScrollArea h={400}>
                {source.raw_content ? (
                  <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
                    {source.raw_content}
                  </Code>
                ) : (
                  <Alert color="gray">{t('viewSource.empty') || 'No content'}</Alert>
                )}
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="json" pt="md">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  {t('sources.debugJson') || 'Complete debug data (JSON)'}
                </Text>
                <CopyButton value={jsonData}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={copy}
                    >
                      {copied ? t('common.copied') || 'Copied' : t('common.copy') || 'Copy JSON'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              <ScrollArea h={400}>
                <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
                  {jsonData}
                </Code>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Modal>
  );
}

