import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import { notifications } from '@mantine/notifications';
import type { LorebookEntry, SingleResponse, UpdateLorebookEntryPayload } from '../types';
import { useI18n } from '../i18n';

const updateLorebookEntry = async ({
  entryId,
  data,
}: {
  entryId: string;
  data: UpdateLorebookEntryPayload;
}): Promise<SingleResponse<LorebookEntry>> => {
  const response = await apiClient.put(`/entries/${entryId}`, data);
  return response.data;
};

export const useUpdateLorebookEntry = (projectId: string) => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: updateLorebookEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', projectId] });
      notifications.show({
        title: t('entries.updatedTitle') || 'Entry Updated',
        message: t('entries.updatedMsg') || 'The lorebook entry has been updated successfully.',
        color: 'green',
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({
        title: t('common.error') || 'Error',
        message: `${t('entries.failedToUpdate') || 'Failed to update entry'}: ${error.response?.data?.detail || error.message}`,
        color: 'red',
      });
    },
  });
};

const deleteLorebookEntry = async (entryId: string): Promise<void> => {
  await apiClient.delete(`/entries/${entryId}`);
};

export const useDeleteLorebookEntry = (projectId: string) => {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: deleteLorebookEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', projectId] });
      notifications.show({
        title: t('entries.deletedTitle') || 'Entry Deleted',
        message: t('entries.deletedMsg') || 'The lorebook entry has been successfully deleted.',
        color: 'green',
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({
        title: t('common.error') || 'Error',
        message: `${t('entries.failedToDelete') || 'Failed to delete entry'}: ${error.response?.data?.detail || error.message}`,
        color: 'red',
      });
    },
  });
};
