import { Modal, TextInput, Button, Group, Stack, Text, NumberInput, Textarea, Collapse, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import type { ProjectSource, TestSelectorsResult, ProjectType } from '../../types';
import {
  useCreateProjectSource,
  useUpdateProjectSource,
  useTestProjectSourceSelectors,
} from '../../hooks/useProjectSources';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import { useI18n } from '../../i18n';

interface ProjectSourceModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  source: ProjectSource | null;
  projectType: ProjectType; // New prop
}

interface SourceFormValues {
  url: string;
  max_pages_to_crawl: number;
  max_crawl_depth: number;
  link_extraction_selector: string;
  link_extraction_pagination_selector: string;
  url_exclusion_patterns: string;
}

export function ProjectSourceModal({ opened, onClose, projectId, source, projectType }: ProjectSourceModalProps) {
  const isEditMode = !!source;
  const createSourceMutation = useCreateProjectSource(projectId);
  const updateSourceMutation = useUpdateProjectSource(projectId);
  const testSelectorsMutation = useTestProjectSourceSelectors(projectId);
  const [selectorsVisible, { toggle: toggleSelectors }] = useDisclosure(false);
  const [testResult, setTestResult] = useState<TestSelectorsResult | null>(null);
  const { t } = useI18n();

  const form = useForm<SourceFormValues>({
    initialValues: {
      url: '',
      max_pages_to_crawl: 20,
      max_crawl_depth: 1,
      link_extraction_selector: '',
      link_extraction_pagination_selector: '',
      url_exclusion_patterns: '',
    },
    validate: {
      url: (value) => {
        try {
          new URL(value);
          return null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
        } catch (e: any) {
          return t('sources.validUrl');
        }
      },
    },
  });

  useEffect(() => {
    setTestResult(null); // Clear test results when modal opens/changes
    if (isEditMode && source) {
      form.setValues({
        url: source.url,
        max_pages_to_crawl: source.max_pages_to_crawl,
        max_crawl_depth: source.max_crawl_depth,
        link_extraction_selector: (source.link_extraction_selector || []).join('\n'),
        link_extraction_pagination_selector: source.link_extraction_pagination_selector || '',
        url_exclusion_patterns: (source.url_exclusion_patterns || []).join('\n'),
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, opened]);

  const handleSubmit = (values: SourceFormValues) => {
    const payload = {
      ...values,
      link_extraction_selector: values.link_extraction_selector.split('\n').filter(Boolean),
      url_exclusion_patterns: values.url_exclusion_patterns.split('\n').filter(Boolean),
    };

    if (isEditMode && source) {
      updateSourceMutation.mutate({ projectId, sourceId: source.id, data: payload }, { onSuccess: onClose });
    } else {
      createSourceMutation.mutate({ projectId, data: payload }, { onSuccess: onClose });
    }
  };

  const handleTestSelectors = async () => {
    setTestResult(null);
    const { url, link_extraction_selector, link_extraction_pagination_selector } = form.values;
    testSelectorsMutation.mutate(
      {
        projectId,
        data: {
          url,
          content_selectors: link_extraction_selector.split('\n').filter(Boolean),
          pagination_selector: link_extraction_pagination_selector,
        },
      },
      {
        onSuccess: (data) => {
          setTestResult(data);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
          setTestResult({
            error: error.response?.data?.detail || 'An unknown error occurred.',
            link_count: 0,
            content_links: [],
          });
        },
      }
    );
  };

  const isLoading = createSourceMutation.isPending || updateSourceMutation.isPending;
  const isLorebookProject = projectType === 'lorebook';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{isEditMode ? t('sources.edit') : t('sources.add')}</Text>}
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            withAsterisk
            label={t('sources.url')}
            placeholder={
              isLorebookProject
                ? 'e.g., https://elderscrolls.fandom.com/wiki/Category:Skyrim:_Locations'
                : 'e.g., https://facebook.com/nintendo or https://fandom.com/wiki/Character'
            }
            description={t('sources.urlDesc')}
            {...form.getInputProps('url')}
          />

          {isLorebookProject && (
            <>
              <Group grow>
                <NumberInput
                  label={t('sources.maxPages')}
                  description={t('sources.maxPagesDesc')}
                  defaultValue={20}
                  min={1}
                  max={100}
                  {...form.getInputProps('max_pages_to_crawl')}
                />
                <NumberInput
                  label={t('sources.maxDepth')}
                  description={t('sources.maxDepthDesc')}
                  defaultValue={1}
                  min={1}
                  max={5}
                  {...form.getInputProps('max_crawl_depth')}
                />
              </Group>
              <Group grow>
                <Textarea
                  w={'100%'}
                  label={t('sources.exclusions')}
                  description={t('sources.exclusionsDesc')}
                  autosize
                  minRows={3}
                  {...form.getInputProps('url_exclusion_patterns')}
                />
              </Group>

              {isEditMode && (
                <>
                  <Button variant="subtle" size="xs" onClick={toggleSelectors}>
                    {selectorsVisible ? t('common.hide') : t('common.show')} {t('sources.advanced')}
                  </Button>
                  <Collapse in={selectorsVisible}>
                    <Stack>
                      <Textarea
                        label={t('sources.contentSelectors')}
                        description={t('sources.contentSelectorsDesc')}
                        autosize
                        minRows={3}
                        {...form.getInputProps('link_extraction_selector')}
                      />
                      <TextInput
                        label={t('sources.paginationSelector')}
                        description={t('sources.paginationSelectorDesc')}
                        {...form.getInputProps('link_extraction_pagination_selector')}
                      />
                      <Group justify="flex-end">
                        <Button
                          variant="outline"
                          onClick={handleTestSelectors}
                          loading={testSelectorsMutation.isPending}
                          disabled={!form.values.url}
                        >
                          {t('sources.testSelectors')}
                        </Button>
                      </Group>
                      {testResult && (
                        <Alert
                          icon={<IconAlertCircle size="1rem" />}
                          title={t('sources.selectorTestResult')}
                          color={testResult.error ? 'red' : 'green'}
                          withCloseButton
                          onClose={() => setTestResult(null)}
                        >
                          {testResult.error ? (
                            <Text>{testResult.error}</Text>
                          ) : (
                            <Stack>
                              <Text>{t('sources.linksFound').replace('{count}', String(testResult.link_count))}</Text>
                              {testResult.pagination_link ? (
                                <Text>{t('sources.paginationFound').replace('{url}', testResult.pagination_link)}</Text>
                              ) : (
                                <Text>{t('sources.paginationNotFound')}</Text>
                              )}
                              {testResult.content_links.length > 0 && (
                                <Text size="xs" c="dimmed">
                                  {t('sources.firstLink')}: {testResult.content_links[0]}
                                </Text>
                              )}
                            </Stack>
                          )}
                        </Alert>
                      )}
                    </Stack>
                  </Collapse>
                </>
              )}
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={isLoading}>
              {isEditMode ? t('btn.save') : t('sources.add')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
