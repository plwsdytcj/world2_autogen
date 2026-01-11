import { Stack, Text, Button, Group, Loader, Paper, Title, Textarea, ActionIcon, Tooltip, Image, TextInput, SimpleGrid, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { Project, ProjectSource } from '../../types';
import { useGenerateCharacterJob } from '../../hooks/useJobMutations';
import { useLatestJob } from '../../hooks/useProjectJobs';
import { JobStatusIndicator } from '../common/JobStatusIndicator';
import { IconDeviceFloppy, IconDownload, IconPlayerPlay, IconSparkles } from '@tabler/icons-react';
import { useCharacterCard, useUpdateCharacterCard } from '../../hooks/useCharacterCard';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { RegenerateFieldModal } from './RegenerateFieldModal';
import { useProjectSources } from '../../hooks/useProjectSources';
import { notifications } from '@mantine/notifications';
import apiClient from '../../services/api';
import { useI18n } from '../../i18n';
import { ExportToMobileModal } from '../common/ExportToMobileModal';

interface CharacterEditorProps {
  project: Project;
  selectedSourceIds: string[];
}

export function CharacterEditor({ project, selectedSourceIds }: CharacterEditorProps) {
  const { t } = useI18n();
  const { data: characterCardResponse, isLoading: isLoadingCard } = useCharacterCard(project.id);
  const { data: sources } = useProjectSources(project.id);
  const updateCardMutation = useUpdateCharacterCard(project.id);
  const generateCharacterMutation = useGenerateCharacterJob();
  const { job: generateCharacterJob } = useLatestJob(project.id, 'generate_character_card');

  const [regenerateModalOpened, { open: openRegenerateModal, close: closeRegenerateModal }] = useDisclosure(false);
  const [fieldToRegen, setFieldToRegen] = useState<keyof typeof form.values | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [exportMobileOpened, setExportMobileOpened] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      persona: '',
      scenario: '',
      first_message: '',
      example_messages: '',
      avatar_url: '',
    },
  });

  const apiBase = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api';
  const toProxy = (url?: string) => {
    if (!url) return undefined;
    // If URL is already a local image path (starts with /api/images), use it directly
    if (url.startsWith('/api/images')) {
      return url;
    }
    // Otherwise, use proxy for external URLs
    return `${apiBase}/proxy/image?url=${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    if (characterCardResponse?.data) {
      const { name, description, persona, scenario, first_message, example_messages, avatar_url } = characterCardResponse.data;
      const values = {
        name: name || '',
        description: description || '',
        persona: persona || '',
        scenario: scenario || '',
        first_message: first_message || '',
        example_messages: example_messages || '',
        avatar_url: avatar_url || '',
      };
      form.setValues(values);
      form.resetDirty(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterCardResponse]);

  const handleRegenerateClick = (fieldName: keyof typeof form.values) => {
    setFieldToRegen(fieldName);
    openRegenerateModal();
  };

  const fetchedSources = sources?.filter((s) => s.content_char_count && s.content_char_count > 0) || [];
  const candidateImages = (fetchedSources
    .flatMap((s) => s.all_image_url || [])
    .filter((u): u is string => !!u))
    .slice(0, 12);

  // Client-side debug to help diagnose empty candidates
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.debug('[CharacterEditor] candidateImages count:', candidateImages.length, 'first:', candidateImages.slice(0, 3));
  }
  const canGenerate = selectedSourceIds.length > 0;
  const isGenerationJobActive =
    generateCharacterJob?.status === 'pending' || generateCharacterJob?.status === 'in_progress';

  const handleExport = async () => {
    if (!characterCardResponse?.data?.name) {
      notifications.show({
        color: 'yellow',
        title: 'Cannot Export',
        message: 'Please generate or enter a name for the character before exporting.',
      });
      return;
    }
    setIsDownloading(true);
    try {
      const response = await apiClient.get(`/projects/${project.id}/character/export`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `${characterCardResponse.data.name}.png`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      notifications.show({
        title: 'Export Failed',
        message: 'Could not export the character card.',
        color: 'red',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportJson = async () => {
    if (!characterCardResponse?.data?.name) {
      notifications.show({
        color: 'yellow',
        title: 'Cannot Export',
        message: 'Please generate or enter a name for the character before exporting.',
      });
      return;
    }
    setIsDownloadingJson(true);
    try {
      const response = await apiClient.get(`/projects/${project.id}/character/export`, {
        params: { format: 'json' },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      const filename = `${characterCardResponse.data.name}.json`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export JSON failed:', err);
      notifications.show({
        title: 'Export JSON Failed',
        message: 'Could not export the character card as JSON.',
        color: 'red',
      });
    } finally {
      setIsDownloadingJson(false);
    }
  };

  if (isLoadingCard) {
    return <Loader />;
  }

  const renderTextareaWithRegen = (field: keyof typeof form.values, label: string, rows: number) => (
    <Textarea
      label={
        <Group justify="space-between">
          <Text component="span">{label}</Text>
          <Tooltip label={`Regenerate ${label}`} withArrow>
            <ActionIcon
              variant="subtle"
              size="xs"
              onClick={() => handleRegenerateClick(field)}
              disabled={!characterCardResponse?.data.id}
            >
              <IconSparkles size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
      autosize
      minRows={rows}
      maxRows={12}
      resize="vertical"
      {...form.getInputProps(field)}
    />
  );

  return (
    <>
      <RegenerateFieldModal
        opened={regenerateModalOpened}
        onClose={closeRegenerateModal}
        project={project}
        fieldName={fieldToRegen}
        fetchedSources={fetchedSources as ProjectSource[]}
        characterCard={characterCardResponse?.data}
      />
      <form onSubmit={form.onSubmit((values) => updateCardMutation.mutate({ projectId: project.id, data: values }))}>
        <Stack>
          <ExportToMobileModal
            opened={exportMobileOpened}
            onClose={() => setExportMobileOpened(false)}
            projectId={project.id}
            contentType="character"
            defaultFormat="png"
          />
          <Group justify="space-between" data-tour="character-editor">
            <Title order={4}>{t('character.title')}</Title>
            <Group>
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={() =>
                  generateCharacterMutation.mutate({ project_id: project.id, source_ids: selectedSourceIds })
                }
                disabled={!canGenerate || isGenerationJobActive}
                loading={isGenerationJobActive}
                title={!canGenerate ? 'Select at least one fetched source to enable generation.' : ''}
                data-tour="generate-character"
              >
                {t('btn.generate')}
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                type="submit"
                variant="default"
                disabled={!form.isDirty()}
                loading={updateCardMutation.isPending}
                data-tour="save-character"
              >
                {t('btn.save')}
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                variant="outline"
                onClick={handleExport}
                loading={isDownloading}
                disabled={!characterCardResponse?.data.name}
                data-tour="export-card"
              >
                {t('btn.exportCard')}
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                variant="light"
                onClick={handleExportJson}
                loading={isDownloadingJson}
                disabled={!characterCardResponse?.data.name}
                data-tour="export-json"
              >
                {t('btn.exportJson')}
              </Button>
              <Button
                variant="default"
                onClick={() => setExportMobileOpened(true)}
                disabled={!characterCardResponse?.data.name}
                data-tour="export-mobile"
              >
                {t('btn.exportMobile')}
              </Button>
            </Group>
          </Group>
          <Text size="sm" c="dimmed">
            Generate the character card from your selected sources, or fill out the fields manually.
          </Text>

          <JobStatusIndicator job={generateCharacterJob} title="Character Generation" />

          <Paper withBorder p="md" mt="xs">
            <Stack>
              <Group align="flex-start" justify="space-between" gap="xl">
                <Stack style={{ flex: 1, minWidth: 280 }}>
                  <Text size="sm" fw={500}>{t('character.avatar')}</Text>
                  {form.values.avatar_url ? (
                    <Image src={toProxy(form.values.avatar_url)} alt="Avatar" radius="sm" w={160} h={160} fit="cover" />
                  ) : (
                    <Box w={160} h={160} style={{ borderRadius: 'var(--mantine-radius-sm)', backgroundColor: 'var(--mantine-color-dark-5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text size="xs" c="dimmed">No Avatar</Text>
                    </Box>
                  )}
                  <TextInput
                    label="Avatar URL"
                    placeholder="https://..."
                    value={form.values.avatar_url}
                    onChange={(e) => form.setFieldValue('avatar_url', e.currentTarget.value)}
                  />
                </Stack>
                {candidateImages.length > 0 && (
                  <Stack style={{ flex: 2 }}>
                    <Text size="sm" c="dimmed">{t('character.suggestions')}</Text>
                    <SimpleGrid cols={{ base: 4, sm: 6 }} spacing={8}>
                      {candidateImages.map((url) => (
                        <Image
                          key={url}
                          src={toProxy(url)}
                          alt="candidate"
                          radius="sm"
                          w={80}
                          h={80}
                          fit="cover"
                          style={{ cursor: 'pointer', border: url === form.values.avatar_url ? '2px solid #4dabf7' : '1px solid rgba(255,255,255,0.1)' }}
                          onClick={() => form.setFieldValue('avatar_url', url)}
                        />
                      ))}
                    </SimpleGrid>
                  </Stack>
                )}
              </Group>
              {renderTextareaWithRegen('name', t('character.name'), 1)}
              {renderTextareaWithRegen('description', t('character.description'), 4)}
              {renderTextareaWithRegen('persona', t('character.persona'), 4)}
              {renderTextareaWithRegen('scenario', t('character.scenario'), 2)}
              {renderTextareaWithRegen('first_message', t('character.firstMessage'), 4)}
              {renderTextareaWithRegen('example_messages', t('character.exampleMessages'), 4)}
            </Stack>
          </Paper>
        </Stack>
      </form>
    </>
  );
}
