import {
  Stack,
  Text,
  Button,
  Group,
  Loader,
  Paper,
  ActionIcon,
  Badge,
  Box,
  Title,
  Tooltip,
  Checkbox,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { useModals } from '@mantine/modals';
import type { Project, ProjectSource } from '../../types';
import { useProjectSources, useDeleteProjectSource } from '../../hooks/useProjectSources';
import { ProjectSourceModal } from './ProjectSourceModal';
import { AppendContentModal } from './AppendContentModal';
import { useFetchContentJob } from '../../hooks/useJobMutations';
import { useLatestJob } from '../../hooks/useProjectJobs';
import { JobStatusIndicator } from '../common/JobStatusIndicator';
import { IconBrandFacebook, IconBrandX, IconDownload, IconEye, IconPlus, IconTrash, IconWorld, IconBug, IconFilePlus, IconHelp } from '@tabler/icons-react';
import { formatDate } from '../../utils/formatDate';
import { ViewSourceContentModal } from './ViewSourceContentModal';
import { DebugSourceModal } from './DebugSourceModal';
import { useI18n } from '../../i18n';

interface CharacterSourcesProps {
  project: Project;
  selectedSourceIds: string[];
  setSelectedSourceIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function CharacterSources({ project, selectedSourceIds, setSelectedSourceIds }: CharacterSourcesProps) {
  const { data: sources, isLoading: isLoadingSources } = useProjectSources(project.id);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [appendModalOpened, { open: openAppendModal, close: closeAppendModal }] = useDisclosure(false);
  const [viewModalOpened, { open: openViewModal, close: closeViewModal }] = useDisclosure(false);
  const [debugModalOpened, { open: openDebugModal, close: closeDebugModal }] = useDisclosure(false);
  const [selectedSource, setSelectedSource] = useState<ProjectSource | null>(null);
  const [sourceToViewId, setSourceToViewId] = useState<string | null>(null);
  const [sourceToDebugId, setSourceToDebugId] = useState<string | null>(null);
  const modals = useModals();

  const deleteSourceMutation = useDeleteProjectSource(project.id);
  const fetchContentMutation = useFetchContentJob();
  const { job: fetchContentJob } = useLatestJob(project.id, 'fetch_source_content');
  const { t } = useI18n();

  const isFacebookUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes('facebook.com') || parsed.hostname.includes('fb.com');
    } catch {
      return false;
    }
  };

  const isTwitterUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes('twitter.com') || parsed.hostname.includes('x.com');
    } catch {
      return false;
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedSource(null);
    openModal();
  };

  const handleOpenViewModal = (sourceId: string) => {
    setSourceToViewId(sourceId);
    openViewModal();
  };

  const handleOpenDebugModal = (sourceId: string) => {
    setSourceToDebugId(sourceId);
    openDebugModal();
  };

  const openDeleteModal = (source: ProjectSource) =>
    modals.openConfirmModal({
      title: t('sources.deleteTitle'),
      centered: true,
      children: (
        <Text size="sm">{t('sources.deleteConfirm')}</Text>
      ),
      labels: { confirm: t('sources.deleteConfirmBtn'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteSourceMutation.mutate({ projectId: project.id, sourceId: source.id }),
    });

  const handleFetchContent = (sourceId: string) => {
    fetchContentMutation.mutate({ project_id: project.id, source_ids: [sourceId] });
  };

  const isFetchJobActive = fetchContentJob?.status === 'pending' || fetchContentJob?.status === 'in_progress';

  // Check if project has existing content (character card generated)
  const hasExistingContent = sources && sources.some(s => s.last_crawled_at);
  const projectType = project.project_type === 'character_lorebook' ? 'character_lorebook' : 'character';

  return (
    <>
      <ProjectSourceModal
        opened={modalOpened}
        onClose={closeModal}
        projectId={project.id}
        source={selectedSource}
        projectType="character"
      />
      <AppendContentModal
        opened={appendModalOpened}
        onClose={closeAppendModal}
        projectId={project.id}
        projectType={projectType}
      />
      <ViewSourceContentModal
        opened={viewModalOpened}
        onClose={closeViewModal}
        projectId={project.id}
        sourceId={sourceToViewId}
      />
      <DebugSourceModal
        opened={debugModalOpened}
        onClose={closeDebugModal}
        projectId={project.id}
        sourceId={sourceToDebugId}
      />
      <Stack>
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={4}>{t('character.contextSources') || 'Context Sources'}</Title>
            <Tooltip 
              label={
                <Box style={{ whiteSpace: 'pre-line' }}>
                  {t('guide.character') || '🎭 **Character Workspace**\n\n• **Sources**: Add URLs, fetch content, select for generation\n• **Editor**: Edit character fields, regenerate with custom prompts\n• **Lorebook**: View/manage background entries\n• **Append**: Add more content without losing existing data'}
                </Box>
              } 
              multiline 
              w={320}
              position="bottom-start"
            >
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconHelp size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group gap="xs">
            {hasExistingContent && (
              <Tooltip label={t('append.tooltip') || 'Add more content and merge with existing'}>
                <Button 
                  leftSection={<IconFilePlus size={16} />} 
                  onClick={openAppendModal} 
                  size="xs"
                  variant="light"
                  color="green"
                >
                  {t('append.buttonLabel') || 'Append Content'}
                </Button>
              </Tooltip>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreateModal} size="xs">
              {t('sources.add')}
            </Button>
          </Group>
        </Group>
        <Text size="sm" c="dimmed">{t('character.sourcesTip') || 'Add source URLs, fetch their content, then select which ones to use for generation.'}</Text>

        <JobStatusIndicator job={fetchContentJob} title={t('character.contentFetching') || 'Content Fetching'} />

        <Paper withBorder p="md" mt="xs">
          {isLoadingSources ? (
            <Loader />
          ) : (
            <Stack>
              {sources && sources.length > 0 ? (
                sources.map((source) => (
                  <Paper withBorder p="xs" key={source.id} radius="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Checkbox
                          checked={selectedSourceIds.includes(source.id)}
                          onChange={(event) => {
                            const { checked } = event.currentTarget;
                            setSelectedSourceIds((current) =>
                              checked ? [...current, source.id] : current.filter((id) => id !== source.id)
                            );
                          }}
                          disabled={!source.last_crawled_at}
                        />
                        <Box style={{ minWidth: 0 }}>
                          <Text truncate fw={500}>
                            {source.url}
                          </Text>
                          <Group gap="xs">
                            {isFacebookUrl(source.url) ? (
                              <Tooltip label={t('sources.facebookSource') || 'Facebook source - uses Apify scraper'}>
                                <Badge size="sm" variant="light" color="blue" leftSection={<IconBrandFacebook size={12} />}>
                                  Facebook
                                </Badge>
                              </Tooltip>
                            ) : isTwitterUrl(source.url) ? (
                              <Tooltip label={t('sources.twitterSource') || 'Twitter/X source - uses Apify scraper'}>
                                <Badge size="sm" variant="light" color="dark" leftSection={<IconBrandX size={12} />}>
                                  Twitter/X
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Tooltip label={t('sources.webSource') || 'Web source'}>
                                <Badge size="sm" variant="light" color="gray" leftSection={<IconWorld size={12} />}>
                                  Web
                                </Badge>
                              </Tooltip>
                            )}
                            {source.last_crawled_at ? (
                              <Tooltip label={`${t('character.lastFetched') || 'Last fetched'}: ${formatDate(source.last_crawled_at)}`}>
                                <Badge size="sm" variant="light" color="green">
                                  {t('character.fetched') || 'Fetched'}
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Badge size="sm" variant="light" color="gray">
                                {t('character.notFetched') || 'Not Fetched'}
                              </Badge>
                            )}
                            {source.content_char_count && (
                              <Text size="xs" c="dimmed">
                                ~{Math.ceil(source.content_char_count / 4)} {t('character.tokens') || 'tokens'}
                              </Text>
                            )}
                          </Group>
                        </Box>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label={t('character.viewContent') || 'View Content'}>
                          <ActionIcon
                            onClick={() => handleOpenViewModal(source.id)}
                            variant="default"
                            disabled={!source.last_crawled_at}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('sources.debugTitle') || 'Debug: View raw data'}>
                          <ActionIcon
                            onClick={() => handleOpenDebugModal(source.id)}
                            variant="default"
                            disabled={!source.last_crawled_at}
                          >
                            <IconBug size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('character.fetchContent') || 'Fetch/Re-fetch Content'}>
                          <ActionIcon
                            onClick={() => handleFetchContent(source.id)}
                            variant="default"
                            loading={isFetchJobActive}
                            disabled={isFetchJobActive}
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('sources.deleteTitle')}>
                          <ActionIcon
                            onClick={() => openDeleteModal(source)}
                            variant="default"
                            color="red"
                            loading={deleteSourceMutation.isPending}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                ))
              ) : (
                <Text ta="center" c="dimmed" p="md">{t('sources.empty')}</Text>
              )}
            </Stack>
          )}
        </Paper>
      </Stack>
    </>
  );
}
