import { Modal, TextInput, NumberInput, Switch, Stack, Text, Button, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import apiClient from '../../services/api';
import { useI18n } from '../../i18n';
import { IconBrandFacebook } from '@tabler/icons-react';

interface ImportFacebookModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess?: () => void;
}

export function ImportFacebookModal({ opened, onClose, projectId, onSuccess }: ImportFacebookModalProps) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      page_name: '',
      pages: 5,
      auto_generate_card: true,
    },
    validate: {
      page_name: (value) => (!value ? 'Facebook page name is required' : null),
      pages: (value) => (value < 1 || value > 20 ? 'Pages must be between 1 and 20' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/character/import-facebook`,
        values
      );
      
      notifications.show({
        title: 'Facebook Import Started',
        message: 'The Facebook page import has been started. You can track the progress in the job status indicator.',
        color: 'blue',
      });

      form.reset();
      onClose();
      onSuccess?.();
    } catch (error: any) {
      notifications.show({
        title: 'Import Failed',
        message: error.response?.data?.detail || error.message || 'Failed to start Facebook import',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconBrandFacebook size={20} />
          <Text fw={600}>Import from Facebook</Text>
        </Group>
      }
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Import posts from a Facebook page to generate a character card. Enter the page name or ID (e.g., "zuck" or "meta").
          </Text>

          <TextInput
            label="Facebook Page Name or ID"
            placeholder="e.g., zuck, meta, or facebook.com/PageName"
            required
            {...form.getInputProps('page_name')}
          />

          <NumberInput
            label="Number of Pages to Scrape"
            description="Each page contains approximately 25 posts"
            min={1}
            max={20}
            {...form.getInputProps('pages')}
          />

          <Switch
            label="Auto-generate Character Card"
            description="Automatically generate a character card after importing posts"
            {...form.getInputProps('auto_generate_card', { type: 'checkbox' })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} leftSection={<IconBrandFacebook size={16} />}>
              Import
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

