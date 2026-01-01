import { Paper, Group, Badge, Text, Progress, Button, Alert, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCancelJob } from '../../hooks/useJobMutations';
import type { BackgroundJob, JobStatus } from '../../types';
import { useI18n } from '../../i18n';

interface JobStatusIndicatorProps {
  job?: BackgroundJob;
  title: string;
}

const statusColors: Record<JobStatus, string> = {
  pending: 'gray',
  in_progress: 'blue',
  completed: 'green',
  failed: 'red',
  cancelling: 'yellow',
  canceled: 'orange',
};

export function JobStatusIndicator({ job, title }: JobStatusIndicatorProps) {
  const cancelJobMutation = useCancelJob();
  const { t } = useI18n();

  if (!job) {
    return null;
  }

  const handleCancel = () => {
    cancelJobMutation.mutate(job.id);
  };

  const isCancellable = job.status === 'pending' || job.status === 'in_progress';

  return (
    <Paper withBorder p="md" mt="lg" radius="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={500}>{title}</Text>
          <Badge color={statusColors[job.status]}>{t(`status.${job.status}`) || job.status.replace('_', ' ')}</Badge>
        </Group>

        {(job.status === 'in_progress' || job.progress) && (
          <Stack gap="xs">
            <Progress value={job.progress || 0} striped animated={job.status === 'in_progress'} />
            {job.total_items && (
              <Text c="dimmed" size="xs" ta="right">
                {(t('jobs.itemsProcessed') || '{processed} / {total} items processed')
                  .replace('{processed}', String(job.processed_items || 0))
                  .replace('{total}', String(job.total_items))}
              </Text>
            )}
          </Stack>
        )}

        {job.status === 'failed' && job.error_message && (
          <Alert icon={<IconAlertCircle size="1rem" />} title={t('jobs.failedTitle') || 'Job Failed'} color="red" variant="light">
            {job.error_message}
          </Alert>
        )}

        {isCancellable && (
          <Group justify="flex-end">
            <Button
              variant="outline"
              color="red"
              size="xs"
              onClick={handleCancel}
              loading={cancelJobMutation.isPending}
            >
              {t('jobs.cancel') || 'Cancel Job'}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
