import { Stack, Text, Textarea, Button, Paper, Group } from '@mantine/core';
import type { Project, SearchParams } from '../../types';
import { useGenerateSearchParamsJob } from '../../hooks/useJobMutations';
import { useLatestJob } from '../../hooks/useProjectJobs';
import { JobStatusIndicator } from '../common/JobStatusIndicator';
import { useForm } from '@mantine/form';
import { useUpdateProject } from '../../hooks/useProjectMutations';
import { useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../../i18n';

interface StepProps {
  project: Project;
}

interface FormValues {
  prompt: string;
  search_params: SearchParams;
}

export function StepGenerateSearchParams({ project }: StepProps) {
  const generateSearchParams = useGenerateSearchParamsJob();
  const updateProjectMutation = useUpdateProject();
  const { job } = useLatestJob(project.id, 'generate_search_params');
  const { t } = useI18n();

  const form = useForm<FormValues>({
    initialValues: {
      prompt: project.prompt || '',
      search_params: project.search_params || { purpose: '', extraction_notes: '', criteria: '' },
    },
  });

  // Re-sync form when project data changes from outside (e.g., after generation)
  useEffect(() => {
    form.setValues({
      prompt: project.prompt || '',
      search_params: project.search_params || { purpose: '', extraction_notes: '', criteria: '' },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const handleGenerate = () => {
    generateSearchParams.mutate({ project_id: project.id });
  };

  const handleSaveChanges = (values: FormValues) => {
    updateProjectMutation.mutate(
      { projectId: project.id, data: values },
      {
        onSuccess: () => {
          notifications.show({
            title: t('common.saved') || 'Saved',
            message: t('common.savedMsg') || 'Your changes have been saved successfully.',
            color: 'green',
          });
        },
      }
    );
  };

  const hasBeenGenerated = !!project.search_params;
  const isDirty = form.isDirty();
  const isJobActive = job?.status === 'pending' || job?.status === 'in_progress';

  return (
    <form onSubmit={form.onSubmit(handleSaveChanges)}>
      <Stack>
        <Text>{t('searchParams.tip') || 'Use AI to analyze your prompt and generate structured search parameters.'}</Text>
        <Textarea
          label={t('searchParams.promptLabel') || 'Your high-level prompt'}
          placeholder={t('searchParams.promptPh') || "e.g., 'All major and minor locations in Skyrim'"}
          autosize
          minRows={2}
          {...form.getInputProps('prompt')}
        />
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={handleGenerate}
            loading={generateSearchParams.isPending || isJobActive}
            disabled={!form.values.prompt || generateSearchParams.isPending || isJobActive || isDirty}
            title={isDirty ? (t('common.unsaved') || 'You have unsaved changes') : ''}
          >
            {isJobActive
              ? (t('searchParams.generating') || 'Generating...')
              : hasBeenGenerated
                ? (t('searchParams.regen') || 'Re-generate Parameters')
                : (t('searchParams.generate') || 'Generate Search Parameters')}
          </Button>
          {isDirty && (
            <Button type="submit" loading={updateProjectMutation.isPending}>
              {t('btn.save')}
            </Button>
          )}
        </Group>

        <JobStatusIndicator job={job} title={t('searchParams.statusTitle') || 'Generation Job Status'} />

        {hasBeenGenerated && (
          <Paper withBorder p="md" mt="md">
            <Stack>
              <Textarea
                label={t('searchParams.generatedPurpose') || 'Generated Purpose'}
                autosize
                minRows={2}
                {...form.getInputProps('search_params.purpose')}
              />
              <Textarea
                label={t('searchParams.generatedNotes') || 'Generated Extraction Notes'}
                autosize
                minRows={3}
                {...form.getInputProps('search_params.extraction_notes')}
              />
              <Textarea
                label={t('searchParams.generatedCriteria') || 'Generated Criteria'}
                autosize
                minRows={2}
                {...form.getInputProps('search_params.criteria')}
              />
            </Stack>
          </Paper>
        )}
      </Stack>
    </form>
  );
}
