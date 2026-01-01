import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { GlobalTemplate, SingleResponse } from '../types';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../i18n';

// Types for mutation payloads
interface CreateTemplatePayload {
  id: string;
  name: string;
  content: string;
}

type UpdateTemplatePayload = Partial<Omit<CreateTemplatePayload, 'id'>>;

// --- Create ---
const createGlobalTemplate = async (templateData: CreateTemplatePayload): Promise<SingleResponse<GlobalTemplate>> => {
  const response = await apiClient.post('/global-templates', templateData);
  return response.data;
};

export const useCreateGlobalTemplate = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: createGlobalTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalTemplates'] });
      notifications.show({ title: t('templates.createdTitle'), message: t('templates.createdMsg'), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('templates.createFailed')}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};

// --- Update ---
const updateGlobalTemplate = async ({
  templateId,
  data,
}: {
  templateId: string;
  data: UpdateTemplatePayload;
}): Promise<SingleResponse<GlobalTemplate>> => {
  const response = await apiClient.patch(`/global-templates/${templateId}`, data);
  return response.data;
};

export const useUpdateGlobalTemplate = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: updateGlobalTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalTemplates'] });
      notifications.show({ title: t('templates.updatedTitle'), message: t('templates.updatedMsg'), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('templates.updateFailed')}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};

// --- Delete ---
const deleteGlobalTemplate = async (templateId: string): Promise<void> => {
  await apiClient.delete(`/global-templates/${templateId}`);
};

export const useDeleteGlobalTemplate = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: deleteGlobalTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalTemplates'] });
      notifications.show({ title: t('templates.deletedTitle'), message: t('templates.deletedMsg'), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('templates.deleteFailed')}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};
