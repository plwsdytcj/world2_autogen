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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconRocket, IconSettings, IconBrandX, IconBrandFacebook, IconWorld, IconCheck, IconAlertCircle, IconPlus, IconFilePlus } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { quickCreateApi } from '../services/api';
import { useCredentials } from '../hooks/useCredentials';
import { useAuthStore } from '../stores/authStore';
import { useProjects } from '../hooks/useProjects';

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
        if (!value.trim()) return 'URL is required';
        // Basic URL validation
        if (!value.includes('.')) return 'Please enter a valid URL';
        return null;
      },
    },
  });

  const appendForm = useForm<QuickAppendFormValues>({
    initialValues: {
      projectId: '',
      url: '',
      tweetsLimit: 20,
    },
    validate: {
      projectId: (value) => (!value ? 'Please select a project' : null),
      url: (value) => {
        if (!value.trim()) return 'URL is required';
        if (!value.includes('.')) return 'Please enter a valid URL';
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
        title: 'Started!',
        message: `Creating ${data.data.project_name}...`,
        color: 'blue',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      notifications.show({
        title: 'Error',
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
        tweets_limit: values.tweetsLimit,
      });
    },
    onSuccess: (data) => {
      setCreatedProjectId(data.project_id);
      setFetchJobId(data.fetch_job_id);
      notifications.show({
        title: 'Appending Content',
        message: data.message,
        color: 'blue',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      notifications.show({
        title: 'Error',
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
          title: 'Generating Character Card',
          message: 'Content fetched! Now generating character card...',
          color: 'blue',
        });
        // Navigate to project page to see progress
        setTimeout(() => {
          navigate(`/projects/${createdProjectId}`);
        }, 1500);
      }).catch((err) => {
        notifications.show({
          title: 'Error',
          message: err.response?.data?.detail || 'Failed to start character generation',
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
    label: `${p.name} (${p.project_type === 'character_lorebook' ? '📚' : '🎭'})`,
  })) || [];

  if (!user) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconRocket size={48} stroke={1.5} color="var(--mantine-color-pink-5)" />
            <Title order={2}>Quick Create</Title>
            <Text c="dimmed" ta="center">
              Generate character cards from Twitter, Facebook, or any URL in seconds.
            </Text>
            <Button
              component="a"
              href="/api/auth/google/login"
              size="lg"
              leftSection={<IconRocket size={20} />}
            >
              Sign in to Get Started
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
          <Title order={1} mt="sm">Quick Create</Title>
          <Text c="dimmed" size="lg">
            Paste a URL → Get a character card
          </Text>
        </div>

        <Paper p="xl" radius="md" withBorder>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List grow mb="md">
              <Tabs.Tab value="create" leftSection={<IconPlus size={16} />}>
                New Project
              </Tabs.Tab>
              <Tabs.Tab value="append" leftSection={<IconFilePlus size={16} />}>
                Append to Existing
                {projectOptions.length > 0 && (
                  <Badge size="xs" ml={6} variant="light">{projectOptions.length}</Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

            {/* New Project Tab */}
            <Tabs.Panel value="create">
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                  <TextInput
                    size="lg"
                    placeholder="https://x.com/elonmusk"
                    leftSection={getUrlTypeIcon(urlType)}
                    {...form.getInputProps('url')}
                    disabled={isProcessing}
                    autoFocus
                  />

                  <SegmentedControl
                    fullWidth
                    data={[
                      { label: '🎭 Character Card', value: 'character' },
                      { label: '🎭📚 Character + Lorebook', value: 'character_lorebook' },
                    ]}
                    {...form.getInputProps('projectType')}
                    disabled={isProcessing}
                  />

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
                          {!jobStatus && 'Starting...'}
                          {jobStatus?.data?.status === 'pending' && 'Waiting...'}
                          {jobStatus?.data?.status === 'in_progress' && 'Fetching content...'}
                          {jobStatus?.data?.status === 'completed' && 'Generating character card...'}
                          {jobStatus?.data?.status === 'failed' && 'Failed'}
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
                  >
                    {isProcessing && activeTab === 'create' ? 'Processing...' : 'Generate'}
                  </Button>

                  {/* Advanced options toggle */}
                  <Group justify="center">
                    <Anchor
                      component="button"
                      type="button"
                      size="sm"
                      c="dimmed"
                      onClick={toggleAdvanced}
                    >
                      <Group gap={4}>
                        <IconSettings size={14} />
                        {advancedOpened ? 'Hide' : 'Show'} Advanced Options
                      </Group>
                    </Anchor>
                  </Group>

                  <Collapse in={advancedOpened}>
                    <Stack gap="md" pt="md">
                      <Select
                        label="API Credential"
                        placeholder="Select credential"
                        data={credentials?.map(c => ({
                          value: c.id,
                          label: `${c.name} (${c.provider_type})`,
                        })) || []}
                        {...form.getInputProps('credentialId')}
                        disabled={isProcessing}
                      />

                      <TextInput
                        label="Model Name"
                        placeholder="google/gemini-2.0-flash-001"
                        {...form.getInputProps('modelName')}
                        disabled={isProcessing}
                      />

                      <div>
                        <Text size="sm" fw={500} mb="xs">Temperature: {form.values.temperature}</Text>
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
                          <Text size="sm" fw={500} mb="xs">
                            {urlType === 'twitter' ? 'Tweets' : 'Posts'} to fetch: {form.values.tweetsLimit}
                          </Text>
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
                  <Select
                    size="lg"
                    label="Select Project"
                    placeholder="Choose a project to append to"
                    data={projectOptions}
                    searchable
                    {...appendForm.getInputProps('projectId')}
                    disabled={isProcessing}
                  />

                  <TextInput
                    size="lg"
                    label="New URL to Add"
                    placeholder="https://x.com/username"
                    leftSection={getUrlTypeIcon(appendUrlType)}
                    {...appendForm.getInputProps('url')}
                    disabled={isProcessing}
                  />

                  {(appendUrlType === 'twitter' || appendUrlType === 'facebook') && (
                    <div>
                      <Text size="sm" fw={500} mb="xs">
                        {appendUrlType === 'twitter' ? 'Tweets' : 'Posts'} to fetch: {appendForm.values.tweetsLimit}
                      </Text>
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

                  <Alert variant="light" color="blue" icon={<IconFilePlus size={16} />}>
                    <Text size="sm">
                      Append mode will <strong>add</strong> new content to your existing character card 
                      and lorebook without losing existing information.
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
                          {!jobStatus && 'Starting...'}
                          {jobStatus?.data?.status === 'pending' && 'Waiting...'}
                          {jobStatus?.data?.status === 'in_progress' && 'Fetching new content...'}
                          {jobStatus?.data?.status === 'completed' && 'Merging with existing card...'}
                          {jobStatus?.data?.status === 'failed' && 'Failed'}
                        </Text>
                      </Group>
                      <Progress 
                        value={jobProgress || (jobStatus?.data?.status === 'completed' ? 100 : 30)} 
                        animated={jobStatus?.data?.status !== 'completed' && jobStatus?.data?.status !== 'failed'}
                        color={jobStatus?.data?.status === 'failed' ? 'red' : 'green'}
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
                    color="green"
                    loading={isProcessing && activeTab === 'append'}
                    leftSection={!isProcessing && <IconFilePlus size={20} />}
                    disabled={projectOptions.length === 0}
                  >
                    {projectOptions.length === 0
                      ? 'No projects yet - create one first'
                      : isProcessing && activeTab === 'append'
                        ? 'Processing...'
                        : 'Append Content'}
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

