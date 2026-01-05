import { useState } from 'react';
import {
  Stack,
  Text,
  Button,
  Group,
  Table,
  Loader,
  Alert,
  ActionIcon,
  Pagination,
  TextInput,
  Center,
  Paper,
  Badge,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconDownload, IconPencil, IconTrash, IconSearch, IconDeviceMobile, IconSparkles } from '@tabler/icons-react';
import { useProjectEntries } from '../../hooks/useProjectEntries';
import type { LorebookEntry, Project } from '../../types';
import apiClient from '../../services/api';
import { notifications } from '@mantine/notifications';
import { useModals } from '@mantine/modals';
import { useDeleteLorebookEntry } from '../../hooks/useLorebookEntryMutations';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { LorebookEntryModal } from './LorebookEntryModal';
import { ExportToMobileModal } from '../common/ExportToMobileModal';
import { useGenerateLorebookEntriesJob } from '../../hooks/useJobMutations';
import { useLatestJob } from '../../hooks/useProjectJobs';
import { JobStatusIndicator } from '../common/JobStatusIndicator';
import { useI18n } from '../../i18n';

interface CharacterLorebookEntriesProps {
  project: Project;
}

const PAGE_SIZE = 20;

export function CharacterLorebookEntries({ project }: CharacterLorebookEntriesProps) {
  const { t } = useI18n();
  const [activePage, setPage] = useState(1);
  const [filterText, setFilterText] = useState('');
  const [debouncedFilterText] = useDebouncedValue(filterText, 300);

  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [exportMobileOpened, setExportMobileOpened] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LorebookEntry | null>(null);

  const {
    data: entriesResponse,
    isLoading,
    isFetching,
    isError,
    error,
  } = useProjectEntries(project.id, {
    page: activePage,
    pageSize: PAGE_SIZE,
    searchQuery: debouncedFilterText,
  });

  const handleOpenEditModal = (entry: LorebookEntry) => {
    setSelectedEntry(entry);
    openEditModal();
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const modals = useModals();
  const deleteEntryMutation = useDeleteLorebookEntry(project.id);
  
  const generateLorebookMutation = useGenerateLorebookEntriesJob();
  const { job: generateLorebookJob } = useLatestJob(project.id, 'generate_lorebook_entries');
  const isGeneratingLorebook = generateLorebookJob?.status === 'pending' || generateLorebookJob?.status === 'in_progress';
  
  const handleGenerateLorebook = () => {
    generateLorebookMutation.mutate({ project_id: project.id });
  };

  const openDeleteModal = (entryId: string, entryTitle: string) =>
    modals.openConfirmModal({
      title: t('completed.deleteTitle') || 'Delete Lorebook Entry',
      centered: true,
      children: (
        <Text size="sm" dangerouslySetInnerHTML={{ __html: (t('completed.deleteConfirm') || 'Are you sure you want to delete the entry "{title}"? This action is irreversible.').replace('{title}', `<strong>${entryTitle}</strong>`) }} />
      ),
      labels: { confirm: t('completed.deleteBtn') || 'Delete Entry', cancel: t('common.cancel') || 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteEntryMutation.mutate(entryId),
    });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await apiClient.get(`/projects/${project.id}/lorebook/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project.id}-lorebook.json`);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: (t('completed.downloadStartedTitle') || 'Download Started'),
        message: (t('completed.downloadStartedMsg') || 'Your lorebook is being downloaded.'),
        color: 'green',
      });
    } catch (err) {
      console.error('Download failed:', err);
      notifications.show({
        title: (t('completed.downloadFailedTitle') || 'Download Failed'),
        message: (t('completed.downloadFailedMsg') || 'Could not download the lorebook file.'),
        color: 'red',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const entries = entriesResponse?.data || [];
  const totalItems = entriesResponse?.meta.total_items || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  if (isError) {
    return (
      <Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red">
        Failed to load lorebook entries: {error.message}
      </Alert>
    );
  }

  return (
    <>
      <LorebookEntryModal opened={editModalOpened} onClose={closeEditModal} entry={selectedEntry} />
      <ExportToMobileModal
        opened={exportMobileOpened}
        onClose={() => setExportMobileOpened(false)}
        projectId={project.id}
        contentType="lorebook"
        defaultFormat="json"
      />
      <Paper p="md" withBorder>
        <Stack>
          <Group justify="space-between">
            <Group>
              <Title order={4}>{t('characterLorebook.title') || 'Lorebook Entries'}</Title>
              <Badge color="blue">{totalItems}</Badge>
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                leftSection={<IconDeviceMobile size={14} />}
                onClick={() => setExportMobileOpened(true)}
                disabled={totalItems === 0}
                variant="light"
              >
                {t('characterLorebook.exportMobile') || 'Export to Mobile'}
              </Button>
              <Button
                size="xs"
                leftSection={<IconDownload size={14} />}
                onClick={handleDownload}
                loading={isDownloading}
                disabled={totalItems === 0}
                variant="light"
              >
                {t('characterLorebook.download') || 'Download'}
              </Button>
            </Group>
          </Group>

          <TextInput
            placeholder={t('completed.searchPh') || 'Search entries by title, keyword, or content...'}
            leftSection={<IconSearch size={14} />}
            rightSection={isFetching ? <Loader size="xs" /> : null}
            value={filterText}
            onChange={(event) => setFilterText(event.currentTarget.value)}
            size="xs"
          />

          {generateLorebookJob && (
            <JobStatusIndicator job={generateLorebookJob} title={t('characterLorebook.jobStatus') || 'Lorebook Generation Status'} />
          )}

          {isLoading ? (
            <Center p="xl">
              <Loader />
            </Center>
          ) : totalItems === 0 ? (
            <Stack align="center" p="md" gap="sm">
              <Text c="dimmed" size="sm">
                {t('characterLorebook.emptyDesc') || 'No lorebook entries yet.'}
              </Text>
              <Button
                leftSection={<IconSparkles size={16} />}
                onClick={handleGenerateLorebook}
                loading={isGeneratingLorebook}
                disabled={isGeneratingLorebook}
                variant="light"
              >
                {t('characterLorebook.generate') || 'Generate Lorebook Entries'}
              </Button>
            </Stack>
          ) : (
            <>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('completed.table.title') || 'Title'}</Table.Th>
                    <Table.Th>{t('completed.table.keywords') || 'Keywords'}</Table.Th>
                    <Table.Th>{t('completed.table.actions') || 'Actions'}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entries.map((entry) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td>
                        <Text size="sm">{entry.title}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={1}>{entry.keywords.join(', ')}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="center">
                          <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => handleOpenEditModal(entry)}>
                            <IconPencil size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => openDeleteModal(entry.id, entry.title)}
                            loading={deleteEntryMutation.isPending && deleteEntryMutation.variables === entry.id}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {totalPages > 1 && (
                <Group justify="center" mt="xs">
                  <Pagination value={activePage} onChange={setPage} total={totalPages} size="sm" />
                </Group>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </>
  );
}

