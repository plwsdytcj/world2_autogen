import {
  Container,
  Title,
  TextInput,
  Button,
  Stack,
  Paper,
  SegmentedControl,
  Text,
  Collapse,
  Group,
  Slider,
  Select,
  Alert,
  Progress,
  Anchor,
  Tabs,
  Badge,
  Checkbox,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconRocket, IconSettings, IconBrandX, IconBrandFacebook, IconWorld, IconCheck, IconAlertCircle, IconPlus, IconFilePlus, IconInfoCircle, IconPlayerPlay } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { quickCreateApi } from '../services/api';
import { useCredentials } from '../hooks/useCredentials';
import { useAuthStore } from '../stores/authStore';
import { useProjects } from '../hooks/useProjects';
import { useI18n } from '../i18n';
import { useTourStore } from '../stores/tourStore';
import { getQuickCreateTourSteps } from '../tours/quickCreateTour';

interface QuickCreateFormValues {
  url: string;
  projectType: 'character' | 'character_lorebook';
  credentialId: string;
  modelName: string;
  temperature: number;
  tweetsLimit: number;
}

interface QuickAppendFormValues {
  projectId: string;
  url: string;
  tweetsLimit: number;
  alsoGenerateLorebook: boolean;
}

interface QuickCreateResponse {
  data: {
    project_id: string;
    project_name: string;
    fetch_job_id: string;
    message: string;
  };
}

interface JobStatus {
  data: {
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress_current?: number;
    progress_total?: number;
    error_message?: string;
  };
}

function detectUrlType(url: string): 'twitter' | 'facebook' | 'web' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'twitter';
  }
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) {
    return 'facebook';
  }
  return 'web';
}

function getUrlTypeIcon(type: 'twitter' | 'facebook' | 'web') {
  switch (type) {
    case 'twitter':
      return <IconBrandX size={20} />;
    case 'facebook':
      return <IconBrandFacebook size={20} />;
    default:
      return <IconWorld size={20} />;
  }
}

export function QuickCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const { startTour } = useTourStore();
  const [advancedOpened, { toggle: toggleAdvanced }] = useDisclosure(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [fetchJobId, setFetchJobId] = useState<string | null>(null);
  const [generatingCharacter, setGeneratingCharacter] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('create');

  const { data: credentials } = useCredentials();
  const { data: projectsData } = useProjects();

  const form = useForm<QuickCreateFormValues>({
    initialValues: {
      url: '',
      projectType: 'character',
      credentialId: '',
      modelName: 'google/gemini-2.0-flash-001',
      temperature: 0.7,
      tweetsLimit: 20,
    },
    validate: {
      url: (value) => {
        if (!value.trim()) return t('quickCreate.urlRequired') || 'URL is required';
        // Basic URL validation
        if (!value.includes('.')) return t('quickCreate.urlInvalid') || 'Please enter a valid URL';
        return null;
      },
    },
  });

  const appendForm = useForm<QuickAppendFormValues>({
    initialValues: {
      projectId: '',
      url: '',
      tweetsLimit: 20,
      alsoGenerateLorebook: false,
    },
    validate: {
      projectId: (value) => (!value ? (t('quickCreate.append.selectProjectRequired') || 'Please select a project') : null),
      url: (value) => {
        if (!value.trim()) return t('quickCreate.urlRequired') || 'URL is required';
        if (!value.includes('.')) return t('quickCreate.urlInvalid') || 'Please enter a valid URL';
        return null;
      },
    },
  });

  // Set default credential when credentials load
  useEffect(() => {
    if (credentials?.length && !form.values.credentialId) {
      const defaultCred = credentials.find(c => 
        c.provider_type === 'openrouter' || c.provider_type === 'openai' || c.provider_type === 'gemini'
      ) || credentials[0];
      form.setFieldValue('credentialId', defaultCred.id);
    }
  }, [credentials, form]);

  const quickCreateMutation = useMutation({
    mutationFn: async (values: QuickCreateFormValues) => {
      const response = await apiClient.post<QuickCreateResponse>('/quick-create', {
        url: values.url,
        project_type: values.projectType,
        credential_id: values.credentialId || undefined,
        model_name: values.modelName || undefined,
        temperature: values.temperature,
        tweets_limit: values.tweetsLimit,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setCreatedProjectId(data.data.project_id);
      setFetchJobId(data.data.fetch_job_id);
      notifications.show({
        title: t('quickCreate.started') || 'Started!',
        message: (t('quickCreate.startedMsg') || 'Creating {name}...').replace('{name}', data.data.project_name),
        color: 'blue',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      notifications.show({
        title: t('quickCreate.error') || 'Error',
        message: error.response?.data?.detail || error.message,
        color: 'red',
      });
    },
  });

  const quickAppendMutation = useMutation({
    mutationFn: async (values: QuickAppendFormValues) => {
      return quickCreateApi.appendContent(values.projectId, {
        url: values.url,
        auto_regenerate: true,
        also_generate_lorebook: values.alsoGenerateLorebook,
        tweets_limit: values.tweetsLimit,
      });
    },
    onSuccess: (data) => {
      setCreatedProjectId(data.project_id);
      setFetchJobId(data.fetch_job_id);
      notifications.show({
        title: t('append.started') || 'Appending Content',
        message: data.message,
        color: 'blue',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      notifications.show({
        title: t('quickCreate.error') || 'Error',
        message: error.response?.data?.detail || error.message,
        color: 'red',
      });
    },
  });

  // Poll job status
  const { data: jobStatus } = useQuery<JobStatus>({
    queryKey: ['job', fetchJobId],
    queryFn: async () => {
      const response = await apiClient.get(`/jobs/${fetchJobId}`);
      return response.data;
    },
    enabled: !!fetchJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === 'completed' || status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Auto-trigger character generation when fetch completes
  useEffect(() => {
    if (jobStatus?.data?.status === 'completed' && createdProjectId && !generatingCharacter) {
      setGeneratingCharacter(true);
      // Trigger character generation
      apiClient.post('/jobs/generate-character', {
        project_id: createdProjectId,
      }).then(() => {
        notifications.show({
          title: t('quickCreate.generatingCharacterCardNotification') || 'Generating Character Card',
          message: t('quickCreate.contentFetchedNotification') || 'Content fetched! Now generating character card...',
          color: 'blue',
        });
        // Navigate to project page to see progress
        setTimeout(() => {
          navigate(`/projects/${createdProjectId}`);
        }, 1500);
      }).catch((err) => {
        notifications.show({
          title: t('quickCreate.error') || 'Error',
          message: err.response?.data?.detail || (t('quickCreate.failedToStartGeneration') || 'Failed to start character generation'),
          color: 'red',
        });
      });
    }
  }, [jobStatus, createdProjectId, generatingCharacter, navigate]);

  const urlType = detectUrlType(form.values.url);
  const appendUrlType = detectUrlType(appendForm.values.url);
  const isProcessing = quickCreateMutation.isPending || quickAppendMutation.isPending || !!fetchJobId;
  const jobProgress = jobStatus?.data?.progress_current && jobStatus?.data?.progress_total
    ? (jobStatus.data.progress_current / jobStatus.data.progress_total) * 100
    : undefined;

  const handleSubmit = (values: QuickCreateFormValues) => {
    setCreatedProjectId(null);
    setFetchJobId(null);
    setGeneratingCharacter(false);
    quickCreateMutation.mutate(values);
  };

  const handleAppendSubmit = (values: QuickAppendFormValues) => {
    setCreatedProjectId(null);
    setFetchJobId(null);
    setGeneratingCharacter(false);
    quickAppendMutation.mutate(values);
  };

  // Get projects for append dropdown
  const projectOptions = projectsData?.data?.map(p => ({
    value: p.id,
    label: `${p.name} (${p.project_type === 'character_lorebook' ? '🎭📚' : '🎭'})`,
  })) || [];

  // Check if selected project is character-only (no lorebook)
  const selectedProject = projectsData?.data?.find(p => p.id === appendForm.values.projectId);
  const isCharacterOnly = selectedProject?.project_type === 'character';

  if (!user) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconRocket size={48} stroke={1.5} color="var(--mantine-color-pink-5)" />
            <Title order={2}>{t('quickCreate.title') || 'Quick Create'}</Title>
            <Text c="dimmed" ta="center">
              {t('quickCreate.signInPrompt') || 'Generate character cards from Twitter, Facebook, or any URL in seconds.'}
            </Text>
            <Button
              component="a"
              href="/api/auth/google/login"
              size="lg"
              leftSection={<IconRocket size={20} />}
            >
              {t('quickCreate.signInButton') || 'Sign in to Get Started'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div style={{ textAlign: 'center' }}>
          <IconRocket size={48} stroke={1.5} color="var(--mantine-color-pink-5)" />
          <Group justify="center" gap="xs" mt="sm">
            <Title order={1}>{t('quickCreate.title') || 'Quick Create'}</Title>
            <Tooltip label={t('tour.startTour') || 'Start Tour'}>
              <ActionIcon 
                variant="subtle" 
                color="pink" 
                size="sm"
                onClick={() => startTour('quick-create', getQuickCreateTourSteps(t))}
              >
                <IconPlayerPlay size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Text c="dimmed" size="lg">
            {t('quickCreate.subtitle') || 'Paste a URL → Get a character card'}
          </Text>
        </div>

        <Paper p="xl" radius="md" withBorder>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List grow mb="md">
              <Tabs.Tab value="create" leftSection={<IconPlus size={16} />}>
                {t('quickCreate.tabNewProject') || 'New Project'}
              </Tabs.Tab>
              <Tabs.Tab value="append" leftSection={<IconFilePlus size={16} />} data-tour="append-tab">
                {t('quickCreate.tabAppend') || 'Append to Existing'}
                {projectOptions.length > 0 && (
                  <Badge size="xs" ml={6} variant="light">{projectOptions.length}</Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

            {/* New Project Tab */}
            <Tabs.Panel value="create">
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                  <Group gap="xs" align="flex-start" data-tour="url-input">
                    <TextInput
                      size="lg"
                      placeholder={t('quickCreate.urlPlaceholder') || 'https://x.com/elonmusk'}
                      leftSection={getUrlTypeIcon(urlType)}
                      {...form.getInputProps('url')}
                      disabled={isProcessing}
                      autoFocus
                      style={{ flex: 1 }}
                    />
                    <Tooltip label={t('quickCreate.urlTooltip') || 'Supported URLs: Twitter/X profiles (x.com/username), Facebook pages (facebook.com/page), or any website URL'} multiline w={300}>
                      <ActionIcon variant="subtle" color="gray" size="lg" mt={4}>
                        <IconInfoCircle size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  <Group gap="xs" align="flex-start" data-tour="project-type">
                    <SegmentedControl
                      fullWidth
                      data={[
                        { label: `🎭 ${t('quickCreate.characterCard') || 'Character Card'}`, value: 'character' },
                        { label: `🎭📚 ${t('quickCreate.characterLorebook') || 'Character + Lorebook'}`, value: 'character_lorebook' },
                      ]}
                      {...form.getInputProps('projectType')}
                      disabled={isProcessing}
                      style={{ flex: 1 }}
                    />
                    <Tooltip 
                      label={
                        form.values.projectType === 'character'
                          ? (t('quickCreate.characterCardTooltip') || 'Generate only a character card with personality, description, and example messages')
                          : (t('quickCreate.characterLorebookTooltip') || 'Generate both a character card and lorebook entries with detailed background information')
                      } 
                      multiline 
                      w={300}
                    >
                      <ActionIcon variant="subtle" color="gray" size="lg" mt={4}>
                        <IconInfoCircle size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  {/* Progress display */}
                  {isProcessing && activeTab === 'create' && (
                    <Stack gap="xs">
                      <Group gap="xs">
                        {jobStatus?.data?.status === 'completed' ? (
                          <IconCheck size={16} color="var(--mantine-color-green-5)" />
                        ) : (
                          <div className="animate-spin" style={{ width: 16, height: 16 }}>⏳</div>
                        )}
                        <Text size="sm">
                          {!jobStatus && (t('quickCreate.starting') || 'Starting...')}
                          {jobStatus?.data?.status === 'pending' && (t('quickCreate.waiting') || 'Waiting...')}
                          {jobStatus?.data?.status === 'in_progress' && (t('quickCreate.fetchingContent') || 'Fetching content...')}
                          {jobStatus?.data?.status === 'completed' && (t('quickCreate.generatingCharacterCard') || 'Generating character card...')}
                          {jobStatus?.data?.status === 'failed' && (t('common.failed') || 'Failed')}
                        </Text>
                      </Group>
                      <Progress 
                        value={jobProgress || (jobStatus?.data?.status === 'completed' ? 100 : 30)} 
                        animated={jobStatus?.data?.status !== 'completed' && jobStatus?.data?.status !== 'failed'}
                        color={jobStatus?.data?.status === 'failed' ? 'red' : 'pink'}
                      />
                      {jobStatus?.data?.status === 'failed' && (
                        <Alert color="red" icon={<IconAlertCircle size={16} />}>
                          {jobStatus.data.error_message || 'An error occurred'}
                        </Alert>
                      )}
                    </Stack>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={isProcessing && activeTab === 'create'}
                    leftSection={!isProcessing && <IconRocket size={20} />}
                    data-tour="generate-btn"
                  >
                    {isProcessing && activeTab === 'create' 
                      ? (t('quickCreate.processing') || 'Processing...') 
                      : (t('quickCreate.generate') || 'Generate')}
                  </Button>

                  {/* Advanced options toggle */}
                  <Group justify="center" data-tour="advanced-options">
                    <Tooltip label={t('quickCreate.advancedOptionsTooltip') || 'Fine-tune API settings, model selection, and generation parameters'} multiline w={300}>
                      <Anchor
                        component="button"
                        type="button"
                        size="sm"
                        c="dimmed"
                        onClick={toggleAdvanced}
                      >
                        <Group gap={4}>
                          <IconSettings size={14} />
                          {advancedOpened 
                            ? (t('quickCreate.hideAdvanced') || 'Hide Advanced Options')
                            : (t('quickCreate.showAdvanced') || 'Show Advanced Options')}
                        </Group>
                      </Anchor>
                    </Tooltip>
                  </Group>

                  <Collapse in={advancedOpened}>
                    <Stack gap="md" pt="md">
                  <Select
                    label={t('quickCreate.apiCredential') || 'API Credential'}
                    placeholder={t('quickCreate.selectCredential') || 'Select credential'}
                    data={credentials?.map(c => ({
                      value: c.id,
                      label: `${c.name} (${c.provider_type})`,
                    })) || []}
                    {...form.getInputProps('credentialId')}
                    disabled={isProcessing}
                  />

                  <TextInput
                    label={t('quickCreate.modelName') || 'Model Name'}
                    placeholder="google/gemini-2.0-flash-001"
                    {...form.getInputProps('modelName')}
                    disabled={isProcessing}
                  />

                  <div>
                    <Group gap="xs" mb="xs">
                      <Text size="sm" fw={500}>{t('quickCreate.temperature') || 'Temperature'}: {form.values.temperature}</Text>
                      <Tooltip label={t('quickCreate.temperatureTooltip') || 'Controls randomness: Lower (0-0.5) = more consistent, Higher (1-2) = more creative'} multiline w={300}>
                        <ActionIcon variant="subtle" color="gray" size="sm">
                          <IconInfoCircle size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                        <Slider
                          min={0}
                          max={2}
                          step={0.1}
                          marks={[
                            { value: 0, label: '0' },
                            { value: 1, label: '1' },
                            { value: 2, label: '2' },
                          ]}
                          {...form.getInputProps('temperature')}
                          disabled={isProcessing}
                        />
                      </div>

                      {(urlType === 'twitter' || urlType === 'facebook') && (
                        <div>
                          <Group gap="xs" mb="xs">
                            <Text size="sm" fw={500}>
                              {t('quickCreate.tweetsLimit') || 'Posts to fetch'}: {form.values.tweetsLimit}
                            </Text>
                            <Tooltip label={t('quickCreate.tweetsLimitTooltip') || 'Number of recent posts/tweets to fetch from social media profiles. More posts = richer character data'} multiline w={300}>
                              <ActionIcon variant="subtle" color="gray" size="sm">
                                <IconInfoCircle size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                          <Slider
                            min={5}
                            max={50}
                            step={5}
                            marks={[
                              { value: 5, label: '5' },
                              { value: 25, label: '25' },
                              { value: 50, label: '50' },
                            ]}
                            {...form.getInputProps('tweetsLimit')}
                            disabled={isProcessing}
                          />
                        </div>
                      )}
                    </Stack>
                  </Collapse>
                </Stack>
              </form>
            </Tabs.Panel>

            {/* Append to Existing Tab */}
            <Tabs.Panel value="append">
              <form onSubmit={appendForm.onSubmit(handleAppendSubmit)}>
                <Stack gap="md">
                  <div>
                    <Group gap="xs" mb={4}>
                      <Text size="sm" fw={500}>{t('quickCreate.append.selectProject') || 'Select Project'}</Text>
                      <Tooltip label={t('quickCreate.appendTooltip') || 'Add new content to an existing project. The AI will intelligently merge new information without losing existing details.'} multiline w={300}>
                        <ActionIcon variant="subtle" color="gray" size="sm">
                          <IconInfoCircle size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    <Select
                      size="lg"
                      placeholder={t('quickCreate.append.selectProjectPlaceholder') || 'Choose a project to append to'}
                      data={projectOptions}
                      searchable
                      {...appendForm.getInputProps('projectId')}
                      disabled={isProcessing}
                    />
                  </div>

                  <div>
                    <Group gap="xs" mb={4}>
                      <Text size="sm" fw={500}>{t('quickCreate.append.newUrlLabel') || 'New URL to Add'}</Text>
                      <Tooltip label={t('quickCreate.urlTooltip') || 'Supported URLs: Twitter/X profiles (x.com/username), Facebook pages (facebook.com/page), or any website URL'} multiline w={300}>
                        <ActionIcon variant="subtle" color="gray" size="sm">
                          <IconInfoCircle size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    <TextInput
                      size="lg"
                      placeholder={t('quickCreate.urlPlaceholder') || 'https://x.com/username'}
                      leftSection={getUrlTypeIcon(appendUrlType)}
                      {...appendForm.getInputProps('url')}
                      disabled={isProcessing}
                    />
                  </div>

                  {(appendUrlType === 'twitter' || appendUrlType === 'facebook') && (
                    <div>
                      <Group gap="xs" mb="xs">
                        <Text size="sm" fw={500}>
                          {t('quickCreate.tweetsLimit') || 'Posts to fetch'}: {appendForm.values.tweetsLimit}
                        </Text>
                        <Tooltip label={t('quickCreate.tweetsLimitTooltip') || 'Number of recent posts/tweets to fetch from social media profiles. More posts = richer character data'} multiline w={300}>
                          <ActionIcon variant="subtle" color="gray" size="sm">
                            <IconInfoCircle size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                      <Slider
                        min={5}
                        max={50}
                        step={5}
                        marks={[
                          { value: 5, label: '5' },
                          { value: 25, label: '25' },
                          { value: 50, label: '50' },
                        ]}
                        {...appendForm.getInputProps('tweetsLimit')}
                        disabled={isProcessing}
                      />
                    </div>
                  )}

                  {/* Show lorebook option for character-only projects */}
                  {isCharacterOnly && (
                    <Tooltip label={t('quickCreate.alsoGenerateLorebookTooltip') || 'Even if your project was created as "Character Card" only, you can add lorebook entries now'} multiline w={300}>
                      <Checkbox
                        label={t('quickCreate.append.alsoGenerateLorebook') || 'Also generate Lorebook entries 📚'}
                        description={t('quickCreate.append.alsoGenerateLorebookDesc') || 'Create lorebook entries even though this project doesn\'t have them yet'}
                        {...appendForm.getInputProps('alsoGenerateLorebook', { type: 'checkbox' })}
                        disabled={isProcessing}
                      />
                    </Tooltip>
                  )}

                  <Alert variant="light" color="blue" icon={<IconFilePlus size={16} />}>
                    <Text size="sm">
                      {selectedProject?.project_type === 'character_lorebook' ? (
                        <>{t('quickCreate.append.infoWithLorebook') || 'Append mode will add new content to your existing character card and lorebook without losing existing information.'}</>
                      ) : appendForm.values.alsoGenerateLorebook ? (
                        <>{t('quickCreate.append.infoCreateLorebook') || 'Will append to character card and create new lorebook entries.'}</>
                      ) : (
                        <>{t('quickCreate.append.infoCharacterOnly') || 'Will only append to character card. Check the box above to also generate lorebook entries.'}</>
                      )}
                    </Text>
                  </Alert>

                  {/* Progress display */}
                  {isProcessing && activeTab === 'append' && (
                    <Stack gap="xs">
                      <Group gap="xs">
                        {jobStatus?.data?.status === 'completed' ? (
                          <IconCheck size={16} color="var(--mantine-color-green-5)" />
                        ) : (
                          <div className="animate-spin" style={{ width: 16, height: 16 }}>⏳</div>
                        )}
                        <Text size="sm">
                          {!jobStatus && (t('quickCreate.starting') || 'Starting...')}
                          {jobStatus?.data?.status === 'pending' && (t('quickCreate.waiting') || 'Waiting...')}
                          {jobStatus?.data?.status === 'in_progress' && (t('quickCreate.append.fetchingNewContent') || 'Fetching new content...')}
                          {jobStatus?.data?.status === 'completed' && (t('quickCreate.append.mergingWithExisting') || 'Merging with existing card...')}
                          {jobStatus?.data?.status === 'failed' && (t('common.failed') || 'Failed')}
                        </Text>
                      </Group>
                      <Progress 
                        value={jobProgress || (jobStatus?.data?.status === 'completed' ? 100 : 30)} 
                        animated={jobStatus?.data?.status !== 'completed' && jobStatus?.data?.status !== 'failed'}
                        color={jobStatus?.data?.status === 'failed' ? 'red' : 'green'}
                      />
                      {jobStatus?.data?.status === 'failed' && (
                        <Alert color="red" icon={<IconAlertCircle size={16} />}>
                          {jobStatus.data.error_message || (t('quickCreate.anErrorOccurred') || 'An error occurred')}
                        </Alert>
                      )}
                    </Stack>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    color="green"
                    loading={isProcessing && activeTab === 'append'}
                    leftSection={!isProcessing && <IconFilePlus size={20} />}
                    disabled={projectOptions.length === 0}
                  >
                    {projectOptions.length === 0
                      ? (t('quickCreate.append.noProjects') || 'No projects yet - create one first')
                      : isProcessing && activeTab === 'append'
                        ? (t('quickCreate.processing') || 'Processing...')
                        : (t('quickCreate.append.appendContent') || 'Append Content')}
                  </Button>
                </Stack>
              </form>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>
    </Container>
  );
}

