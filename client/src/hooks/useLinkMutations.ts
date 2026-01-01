import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../i18n';

interface BulkDeleteLinksPayload {
  projectId: string;
  link_ids: string[];
}

const deleteLinksBulk = async ({ projectId, link_ids }: BulkDeleteLinksPayload): Promise<void> => {
  await apiClient.post(`/projects/${projectId}/links/delete-bulk`, { link_ids });
};

export const useDeleteLinksBulk = (projectId: string) => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: deleteLinksBulk,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['links', projectId] });
      notifications.show({ title: t('entries.linksDeletedTitle') || 'Links Deleted', message: (t('entries.linksDeletedMsg') || '{n} links have been successfully deleted.').replace('{n}', String(variables.link_ids.length)), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('entries.deleteFailed') || 'Failed to delete links'}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};
