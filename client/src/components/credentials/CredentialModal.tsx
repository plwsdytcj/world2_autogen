import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Text,
  Select,
  PasswordInput,
  Loader,
  ActionIcon,
  Tooltip,
  SegmentedControl,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useMemo, useState } from 'react';
import { useCreateCredential, useUpdateCredential } from '../../hooks/useCredentialsMutations';
import { useProviders } from '../../hooks/useProviders';
import type { Credential, CreateCredentialPayload, ModelInfo } from '../../types';
import { useFetchProviderModels, useTestCredential } from '../../hooks/useProviderMutations';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../../i18n';
import { IconRefresh } from '@tabler/icons-react';

interface CredentialModalProps {
  opened: boolean;
  onClose: () => void;
  credential: Credential | null;
  onSuccess?: (credential: Credential) => void;
}

export function CredentialModal({ opened, onClose, credential, onSuccess }: CredentialModalProps) {
  const isEditMode = !!credential;
  const createCredentialMutation = useCreateCredential();
  const updateCredentialMutation = useUpdateCredential();
  const testCredentialMutation = useTestCredential();
  const fetchModelsMutation = useFetchProviderModels();
  const { data: providers, isLoading: isLoadingProviders } = useProviders();
  const { t } = useI18n();

  const [testModelName, setTestModelName] = useState('');
  const [localModels, setLocalModels] = useState<ModelInfo[] | null>(null);
  const [jsonMode, setJsonMode] = useState<'api_native' | 'prompt_engineering'>('api_native');

  const form = useForm<CreateCredentialPayload>({
    initialValues: {
      name: '',
      provider_type: '',
      values: {
        api_key: '',
        base_url: '',
      },
    },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : (t('creds.nameRequired') || 'Name is required')),
      provider_type: (value) => (value ? null : (t('creds.providerRequired') || 'Provider is required')),
      values: {
        api_key: (value, values) =>
          !isEditMode && values.provider_type !== 'openai_compatible' && !value ? (t('creds.apiKeyRequired') || 'API Key is required') : null,
        base_url: (value, values) =>
          !isEditMode && values.provider_type === 'openai_compatible' && !value ? (t('creds.baseUrlRequired') || 'Base URL is required') : null,
      },
    },
  });

  const selectedProviderType = form.values.provider_type;

  const selectedProvider = useMemo(
    () => providers?.find((p) => p.id === selectedProviderType),
    [providers, selectedProviderType]
  );

  // The dropdown options now prioritize the locally fetched models
  const modelOptions = useMemo(() => {
    const source = localModels || selectedProvider?.models;
    return source?.map((m) => ({ value: m.id, label: m.name })) || [];
  }, [localModels, selectedProvider]);

  const isOaiCompatible = selectedProviderType === 'openai_compatible';
  const isApify = selectedProviderType === 'apify';

  useEffect(() => {
    if (isEditMode && credential) {
      form.setValues({
        name: credential.name,
        provider_type: credential.provider_type,
        values: { api_key: '', base_url: credential.public_values?.base_url || '' },
      });
    } else {
      form.reset();
    }
    setTestModelName('');
    setLocalModels(null); // Clear local models on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential, opened]);

  // Sync local models with global state when provider changes
  useEffect(() => {
    setLocalModels(selectedProvider?.models || null);
  }, [selectedProvider]);

  const handleSubmit = (values: CreateCredentialPayload) => {
    const filteredValues = { ...values.values };
    if (!filteredValues.api_key) delete filteredValues.api_key;
    if (!filteredValues.base_url && values.provider_type !== 'openai_compatible') {
      delete filteredValues.base_url;
    }
    const payload = { ...values, values: filteredValues };
    if (isEditMode && credential) {
      updateCredentialMutation.mutate({ credentialId: credential.id, data: payload }, { onSuccess: onClose });
    } else {
      createCredentialMutation.mutate(payload, {
        onSuccess: (response) => {
          onClose();
          if (onSuccess) onSuccess(response.data);
        },
      });
    }
  };

  const handleTest = () => {
    if (!testModelName) {
      notifications.show({ title: t('creds.missingModelTitle') || 'Missing Model', message: t('creds.missingModelMsg') || 'Please select a model to run the test.', color: 'yellow' });
      return;
    }
    testCredentialMutation.mutate({
      provider_type: form.values.provider_type,
      values: form.values.values,
      model_name: testModelName,
      credential_id: isEditMode ? credential?.id : undefined,
      json_mode: jsonMode,
    });
  };

  const handleRefreshModels = () => {
    fetchModelsMutation.mutate(
      {
        provider_type: form.values.provider_type,
        values: form.values.values,
        credential_id: isEditMode ? credential?.id : undefined,
        model_name: testModelName,
      },
      {
        onSuccess: (fetchedModels) => {
          setLocalModels(fetchedModels);
          notifications.show({
            title: 'Models Refreshed',
            message: `Found ${fetchedModels.length} models.`,
            color: 'blue',
          });
        },
      }
    );
  };

  const isLoading = createCredentialMutation.isPending || updateCredentialMutation.isPending;
  const isTestable = useMemo(() => {
    if (!form.values.provider_type || !testModelName) return false;
    if (isEditMode) return true;
    if (isOaiCompatible) return !!form.values.values.base_url;
    return !!form.values.values.api_key;
  }, [form.values, testModelName, isEditMode, isOaiCompatible]);

  const canRefresh = useMemo(() => {
    if (!form.values.provider_type) return false;
    if (isEditMode) return true;
    if (isOaiCompatible) return !!form.values.values.base_url;
    return !!form.values.values.api_key;
  }, [form.values, isEditMode, isOaiCompatible]);

  const providerOptions = providers?.map((p) => ({ value: p.id, label: p.name })) || [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{isEditMode ? (t('creds.edit') || 'Edit Credential') : (t('creds.create') || 'Create New Credential')}</Text>}
      size="lg"
      centered
      zIndex={1001}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            withAsterisk
            label={t('creds.name') || 'Credential Name'}
            placeholder="e.g., My Personal Key"
            {...form.getInputProps('name')}
          />
          <Select
            withAsterisk
            label={t('creds.providerType')}
            placeholder={t('creds.selectProvider')}
            data={providerOptions}
            disabled={isLoadingProviders || isEditMode}
            comboboxProps={{ zIndex: 1002 }}
            {...form.getInputProps('provider_type')}
            onChange={(value) => {
              form.setFieldValue('provider_type', value || '');
              setTestModelName('');
              setLocalModels(null);
            }}
          />

          {selectedProviderType && (
            <>
              {isOaiCompatible && (
                <TextInput
                  label={t('creds.baseUrl')}
                  withAsterisk={!isEditMode}
                  placeholder="e.g., http://localhost:11434/v1"
                  {...form.getInputProps('values.base_url')}
                  onBlur={(event) => {
                    const currentValue = event.currentTarget.value;
                    if (form.values.provider_type === 'openai_compatible' && currentValue) {
                      let url = currentValue.trim();
                      url = url.replace(/\/+$/, ''); // remove trailing slashes
                      let finalUrl = url;
                      if (url.endsWith('/chat/completions')) {
                        finalUrl = url.substring(0, url.length - '/chat/completions'.length);
                      }

                      if (finalUrl !== currentValue) {
                        form.setFieldValue('values.base_url', finalUrl);
                        notifications.show({ title: t('creds.baseUrlCorrected') || 'Base URL Corrected', message: t('creds.baseUrlCorrectedMsg') || 'The /chat/completions suffix has been removed automatically.', color: 'blue' });
                      }
                    }
                  }}
                />
              )}
              
              {isApify && (
                <Text size="sm" c="dimmed" mb="xs">
                  {t('creds.apifyDesc') || 'Apify is used for Facebook page scraping. Get your API token from apify.com/account/integrations'}
                </Text>
              )}
              
              <PasswordInput
                label={isApify ? (t('creds.apifyToken') || 'Apify API Token') : t('creds.apiKey')}
                withAsterisk={!isEditMode && !isOaiCompatible}
                placeholder={isEditMode ? 'Leave blank to keep unchanged' : (isApify ? 'apify_api_xxx...' : 'Enter API Key')}
                {...form.getInputProps('values.api_key')}
              />

              {/* Hide model selection and testing for Apify */}
              {!isApify && (
                <>
              <Group justify="space-between" align="flex-end" wrap="nowrap">
                {isOaiCompatible ? (
                  <TextInput
                    label={t('creds.testModel')}
                    description={t('creds.testModelDesc')}
                    placeholder="e.g., llama3"
                    value={testModelName}
                    onChange={(e) => setTestModelName(e.currentTarget.value)}
                    style={{ flexGrow: 1 }}
                  />
                ) : (
                  <Select
                    label={t('creds.testModel')}
                    description={t('creds.testModelDesc')}
                    placeholder={t('creds.selectModel')}
                    data={modelOptions}
                    value={testModelName}
                    onChange={(value) => setTestModelName(value || '')}
                    searchable
                    comboboxProps={{ zIndex: 1002 }}
                    rightSection={isLoadingProviders || fetchModelsMutation.isPending ? <Loader size="xs" /> : null}
                    style={{ flexGrow: 1 }}
                  />
                )}
                <Tooltip label={t('creds.refreshModels')} withArrow zIndex={1002}>
                  <ActionIcon
                    variant="default"
                    size="input-sm"
                    onClick={handleRefreshModels}
                    loading={fetchModelsMutation.isPending}
                    disabled={!canRefresh}
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <Stack gap="xs" mt="sm">
                <Text size="sm" fw={500}>{t('creds.jsonTestMode')}</Text>
                <SegmentedControl
                  fullWidth
                  value={jsonMode}
                  onChange={(value) => setJsonMode(value as 'api_native' | 'prompt_engineering')}
                  data={[
                    { label: t('creds.apiNative'), value: 'api_native' },
                    { label: t('creds.promptEng'), value: 'prompt_engineering' },
                  ]}
                />
              </Stack>
                </>
              )}
            </>
          )}

          <Group justify="flex-end" mt="md">
            {/* Hide test button for Apify (not an LLM provider) */}
            {!isApify && (
            <Button
              variant="outline"
              onClick={handleTest}
              loading={testCredentialMutation.isPending}
              disabled={!isTestable}
            >
              {t('creds.test')}
            </Button>
            )}
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={isLoading}>
              {isEditMode ? (t('btn.save')) : (t('creds.create'))}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
