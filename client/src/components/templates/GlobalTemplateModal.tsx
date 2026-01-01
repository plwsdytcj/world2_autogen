import { Modal, TextInput, Button, Group, Stack, Text, Tooltip, ActionIcon } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import type { GlobalTemplate } from '../../types';
import { useCreateGlobalTemplate, useUpdateGlobalTemplate } from '../../hooks/useGlobalTemplatesMutations';
import { useDefaultGlobalTemplates } from '../../hooks/useGlobalTemplates';
import { LazyMonacoEditorInput } from '../common/LazyMonacoEditorInput';
import { IconRefresh } from '@tabler/icons-react';
import { useI18n } from '../../i18n';

interface GlobalTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  template: GlobalTemplate | null;
}

interface TemplateFormValues {
  id: string;
  name: string;
  content: string;
}

export function GlobalTemplateModal({ opened, onClose, template }: GlobalTemplateModalProps) {
  const isEditMode = !!template;
  const createTemplateMutation = useCreateGlobalTemplate();
  const updateTemplateMutation = useUpdateGlobalTemplate();
  const { data: defaultTemplates } = useDefaultGlobalTemplates();
  const { t } = useI18n();

  const form = useForm<TemplateFormValues>({
    initialValues: {
      id: '',
      name: '',
      content: '',
    },
    validate: {
      id: (value) => (/^[a-z0-9-]+$/.test(value) ? null : (t('templates.validId') || 'Invalid ID')),
      name: (value) => (value.trim().length > 0 ? null : (t('templates.nameRequired') || 'Name is required')),
      content: (value) => (value.trim().length > 0 ? null : (t('templates.contentRequired') || 'Content cannot be empty')),
    },
  });

  useEffect(() => {
    if (isEditMode && template) {
      form.setValues(template);
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, opened]);

  const handleSubmit = (values: TemplateFormValues) => {
    if (isEditMode && template) {
      const { name, content } = values;
      updateTemplateMutation.mutate({ templateId: template.id, data: { name, content } }, { onSuccess: onClose });
    } else {
      createTemplateMutation.mutate(values, { onSuccess: onClose });
    }
  };

  const isLoading = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  const handleResetContent = () => {
    if (template && defaultTemplates && defaultTemplates[template.id]) {
      form.setFieldValue('content', defaultTemplates[template.id]);
    }
  };

  const hasDefaultTemplate = isEditMode && template && defaultTemplates && !!defaultTemplates[template.id];

  const renderTemplateLabel = (label: string) => (
    <Group justify="space-between" w="100%">
      <Text component="span" size="sm" fw={500}>
        {label}
      </Text>
      <Tooltip label={t('templates.resetDefault')} withArrow position="top-end">
        <ActionIcon onClick={handleResetContent} variant="subtle" size="xs" aria-label={`Reset ${label} to default`}>
          <IconRefresh size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{isEditMode ? t('templates.edit') : t('templates.create')}</Text>}
      size="xl"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            withAsterisk
            label={t('templates.id')}
            placeholder="e.g., my-custom-entry-prompt"
            {...form.getInputProps('id')}
            disabled={isEditMode}
          />
          <TextInput
            withAsterisk
            label={t('templates.name')}
            placeholder="e.g., My Custom Entry Prompt"
            {...form.getInputProps('name')}
          />
          <LazyMonacoEditorInput
            label={hasDefaultTemplate ? renderTemplateLabel(t('templates.content')) : t('templates.content')}
            language="handlebars"
            height={400}
            {...form.getInputProps('content')}
            error={form.errors.content}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={isLoading}>
              {isEditMode ? t('btn.save') : t('templates.create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
