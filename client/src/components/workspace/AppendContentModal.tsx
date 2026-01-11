import {
  Modal,
  TextInput,
  Button,
  Stack,
  Text,
  Switch,
  NumberInput,
  Alert,
  Group,
  Progress,
  Badge,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { IconAlertCircle, IconCheck, IconPlus, IconLoader } from '@tabler/icons-react';
import { quickCreateApi } from '../../services/api';
import type { AppendContentRequest } from '../../services/api';
import apiClient from '../../services/api';
import { useI18n } from '../../i18n';
import { notifications } from '@mantine/notifications';
import { queryClient } from '../../main';

interface AppendContentModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  projectType: 'character' | 'character_lorebook';
}

type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface BackgroundJob {
  id: string;
  status: JobStatus;
  task_name: string;
}

export function AppendContentModal({ opened, onClose, projectId, projectType }: AppendContentModalProps) {
  const [url, setUrl] = useState('');
  const [autoRegenerate, setAutoRegenerate] = useState(true);
  const [tweetsLimit, setTweetsLimit] = useState<number | string>(20);
  const [fetchJobId, setFetchJobId] = useState<string | null>(null);
  const [generateJobIds, setGenerateJobIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useI18n();

  const appendMutation = useMutation({
    mutationFn: async (data: AppendContentRequest) => {
      return quickCreateApi.appendContent(projectId, data);
    },
    onSuccess: (data) => {
      setFetchJobId(data.fetch_job_id);
      setGenerateJobIds(data.generate_job_ids);
      setIsProcessing(true);
      notifications.show({
        title: t('append.started') || 'Processing Started',
        message: data.message,
        color: 'blue',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      notifications.show({
        title: t('common.error') || 'Error',
        message: error.response?.data?.detail || error.message,
        color: 'red',
      });
    },
  });

  // Poll for job status
  const { data: fetchJobStatus } = useQuery<BackgroundJob>({
    queryKey: ['job', fetchJobId],
    queryFn: async () => {
      if (!fetchJobId) return null;
      const response = await apiClient.get(`/projects/${projectId}/jobs/${fetchJobId}`);
      return response.data.data;
    },
    enabled: isProcessing && !!fetchJobId,
    refetchInterval: (query) => {
      const job = query.state.data as BackgroundJob | null;
      if (job?.status === 'completed' || job?.status === 'failed') {
        return false;
      }
      return 2000;
    },
  });

  // Check if generate jobs are done
  const allJobsCompleted = 
    fetchJobStatus?.status === 'completed' && 
    (generateJobIds.length === 0 || !isProcessing);

  const anyJobFailed = fetchJobStatus?.status === 'failed';

  // Handle completion
  useEffect(() => {
    if (allJobsCompleted && isProcessing) {
      notifications.show({
        title: t('append.completed') || 'Content Appended',
        message: t('append.completedMsg') || 'New content has been added and regeneration is in progress.',
        color: 'green',
        icon: <IconCheck />,
      });
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectSources', projectId] });
      queryClient.invalidateQueries({ queryKey: ['characterCard', projectId] });
      queryClient.invalidateQueries({ queryKey: ['lorebookEntries', projectId] });
      handleClose();
    }
  }, [allJobsCompleted, isProcessing, projectId, t]);

  const handleClose = () => {
    if (!isProcessing) {
      setUrl('');
      setAutoRegenerate(true);
      setTweetsLimit(20);
      setFetchJobId(null);
      setGenerateJobIds([]);
      onClose();
    }
  };

  const handleSubmit = () => {
    if (!url.trim()) return;
    
    appendMutation.mutate({
      url: url.trim(),
      auto_regenerate: autoRegenerate,
      tweets_limit: typeof tweetsLimit === 'number' ? tweetsLimit : 20,
    });
  };

  const isTwitterOrFacebook = 
    url.includes('twitter.com') || 
    url.includes('x.com') || 
    url.includes('facebook.com') ||
    url.includes('fb.com');

  const getStatusText = () => {
    if (!isProcessing) return '';
    if (fetchJobStatus?.status === 'pending') return t('quickCreate.waiting') || 'Waiting in queue...';
    if (fetchJobStatus?.status === 'in_progress') return t('quickCreate.fetchingContent') || 'Fetching content...';
    if (fetchJobStatus?.status === 'completed') return t('quickCreate.generatingCharacterCard') || 'Regenerating character card...';
    if (fetchJobStatus?.status === 'failed') return t('quickCreate.failed') || 'Failed';
    return t('quickCreate.starting') || 'Starting...';
  };

  const getProgress = () => {
    if (!isProcessing) return 0;
    if (!fetchJobStatus || fetchJobStatus.status === 'pending') return 10;
    if (fetchJobStatus.status === 'in_progress') return 40;
    if (fetchJobStatus.status === 'completed') return 80;
    if (fetchJobStatus.status === 'failed') return 100;
    return 5;
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group>
          <IconPlus size={20} />
          <Text fw={600}>{t('append.title') || 'Add More Content'}</Text>
        </Group>
      }
      size="md"
      closeOnClickOutside={!isProcessing}
      closeOnEscape={!isProcessing}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t('append.description') || 
            'Add a new URL to this project. The new content will be intelligently merged with the existing character card and lorebook entries.'}
        </Text>

        <TextInput
          label={t('append.urlLabel') || 'URL'}
          placeholder="https://twitter.com/username or https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isProcessing}
          required
        />

        {isTwitterOrFacebook && (
          <NumberInput
            label={t('quickCreate.tweetsLimit') || 'Posts to fetch'}
            description={t('quickCreate.tweetsLimitDesc') || 'Number of posts to retrieve from social media'}
            value={tweetsLimit}
            onChange={setTweetsLimit}
            min={5}
            max={100}
            disabled={isProcessing}
          />
        )}

        <Switch
          label={t('append.autoRegenerate') || 'Auto-regenerate character card'}
          description={
            projectType === 'character_lorebook'
              ? t('append.autoRegenerateDescLorebook') || 'Automatically enhance character card and add new lorebook entries'
              : t('append.autoRegenerateDesc') || 'Automatically enhance the existing character card with new content'
          }
          checked={autoRegenerate}
          onChange={(e) => setAutoRegenerate(e.currentTarget.checked)}
          disabled={isProcessing}
        />

        {autoRegenerate && (
          <Alert variant="light" color="blue" icon={<IconAlertCircle size={16} />}>
            <Text size="sm">
              {t('append.appendModeInfo') || 
                'Append mode will intelligently merge new information with existing content, avoiding duplicates and preserving important details.'}
            </Text>
          </Alert>
        )}

        {isProcessing && (
          <Stack gap="xs">
            <Progress 
              value={getProgress()} 
              color={anyJobFailed ? 'red' : 'blue'}
              animated={!anyJobFailed}
            />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{getStatusText()}</Text>
              <Badge 
                color={anyJobFailed ? 'red' : 'blue'} 
                variant="light"
                leftSection={!anyJobFailed && <IconLoader size={12} className="animate-spin" />}
              >
                {anyJobFailed ? t('common.failed') || 'Failed' : t('common.processing') || 'Processing'}
              </Badge>
            </Group>
          </Stack>
        )}

        {anyJobFailed && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {t('append.failed') || 'Failed to process content. Please try again.'}
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose} disabled={isProcessing}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={appendMutation.isPending || isProcessing}
            disabled={!url.trim() || isProcessing}
            leftSection={<IconPlus size={16} />}
          >
            {isProcessing 
              ? (t('common.processing') || 'Processing...') 
              : (t('append.addContent') || 'Add Content')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

