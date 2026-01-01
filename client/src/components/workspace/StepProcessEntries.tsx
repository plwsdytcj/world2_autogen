import { useState, useEffect, useMemo } from 'react';
import {
  Stack,
  Text,
  Button,
  Group,
  Table,
  Badge,
  Pagination,
  Tooltip,
  Loader,
  Checkbox,
  Modal,
  Textarea,
} from '@mantine/core';
import { useProcessProjectEntriesJob } from '../../hooks/useJobMutations';
import { useLatestJob } from '../../hooks/useProjectJobs';
import { useProjectLinks } from '../../hooks/useProjectLinks';
import type { Project } from '../../types';
import { JobStatusIndicator } from '../common/JobStatusIndicator';
import { useSearchParams } from 'react-router-dom';
import { useModals } from '@mantine/modals';
import apiClient from '../../services/api';
import { notifications } from '@mantine/notifications';
import { IconPlayerPlay, IconTrash, IconPlus } from '@tabler/icons-react';
import { useDeleteLinksBulk } from '../../hooks/useLinkMutations';
import { useDisclosure } from '@mantine/hooks';
import { useConfirmLinksJob } from '../../hooks/useJobMutations';
import { useI18n } from '../../i18n';

interface StepProps {
  project: Project;
}

const PAGE_SIZE = 50;
const URL_PARAM_KEY = 'processing_page';

const statusColors: Record<string, string> = {
  pending: 'gray',
  processing: 'yellow',
  completed: 'green',
  failed: 'red',
  skipped: 'yellow',
};

function AddLinksModal({
  opened,
  onClose,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  onAdd: (urls: string[]) => void;
}) {
  const [urlsToAdd, setUrlsToAdd] = useState('');
  const urls = useMemo(
    () =>
      urlsToAdd
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean),
    [urlsToAdd]
  );

  const handleAdd = () => {
    if (urls.length > 0) {
      onAdd(urls);
    }
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={useI18n().t('entries.addManualTitle') || 'Add Manual Links'} centered>
      <Stack>
        <Textarea
          label={useI18n().t('entries.linksLabel') || 'Links'}
          description={useI18n().t('entries.linksDesc') || 'Enter one URL per line.'}
          placeholder="https://example.com/page1&#10;https://example.com/page2"
          autosize
          minRows={4}
          value={urlsToAdd}
          onChange={(e) => setUrlsToAdd(e.currentTarget.value)}
        />
        <Button onClick={handleAdd} disabled={urls.length === 0}>
          {(useI18n().t('entries.addNLinks') || 'Add {n} Links').replace('{n}', String(urls.length))}
        </Button>
      </Stack>
    </Modal>
  );
}

export function StepProcessEntries({ project }: StepProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get(URL_PARAM_KEY) || '1', 10);
  const [activePage, setPage] = useState(isNaN(pageFromUrl) ? 1 : pageFromUrl);
  const [isFetchingCount, setIsFetchingCount] = useState(false);
  const modals = useModals();
  const [addLinksModalOpened, { open: openAddLinksModal, close: closeAddLinksModal }] = useDisclosure(false);
  const confirmLinks = useConfirmLinksJob();
  const { t } = useI18n();

  const startGeneration = useProcessProjectEntriesJob();
  const { job: processingJob } = useLatestJob(project.id, 'process_project_entries');
  const { data: linksResponse, isLoading: isLoadingLinks } = useProjectLinks(project.id, {
    page: activePage,
    pageSize: PAGE_SIZE,
  });

  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const deleteLinksMutation = useDeleteLinksBulk(project.id);
  const processEntriesMutation = useProcessProjectEntriesJob();

  useEffect(() => {
    const newPageFromUrl = parseInt(searchParams.get(URL_PARAM_KEY) || '1', 10);
    const validPage = isNaN(newPageFromUrl) ? 1 : newPageFromUrl;
    if (validPage !== activePage) {
      setPage(validPage);
    }
  }, [searchParams, activePage]);

  // Reset selection when page changes
  useEffect(() => {
    setSelectedLinkIds([]);
  }, [activePage, linksResponse]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams(
      (prev) => {
        prev.set(URL_PARAM_KEY, newPage.toString());
        return prev;
      },
      { replace: true }
    );
  };

  const links = useMemo(() => linksResponse?.data || [], [linksResponse]);
  const totalItems = linksResponse?.meta.total_items || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const isJobActive = processingJob?.status === 'pending' || processingJob?.status === 'in_progress';

  const processableSelectedLinks = useMemo(
    () =>
      links.filter(
        (link) => selectedLinkIds.includes(link.id) && (link.status === 'pending' || link.status === 'failed')
      ),
    [links, selectedLinkIds]
  );

  const handleStartAll = async () => {
    setIsFetchingCount(true);
    try {
      const response = await apiClient.get<{ data: { count: number } }>(
        `/projects/${project.id}/links/processable-count`
      );
      const processableCount = response.data.data.count;

      if (processableCount === 0) {
        notifications.show({ title: t('entries.noneToProcessTitle'), message: t('entries.noneToProcessMsg'), color: 'blue' });
        return;
      }

      modals.openConfirmModal({
        title: t('entries.confirmGenTitle'),
        centered: true,
        children: (
          <Stack>
            <Text size="sm">{t('entries.confirmGenMsg1').replace('{n}', String(processableCount))}</Text>
            <Text size="sm">{t('entries.confirmGenMsg2').replace('{n}', String(processableCount)).replace('{model}', String(project.model_name))}</Text>
            <Text size="sm" fw={700}>{t('sources.deepCrawlConfirm')}</Text>
          </Stack>
        ),
        labels: { confirm: t('entries.startGen'), cancel: t('common.cancel') },
        confirmProps: { color: 'blue' },
        onConfirm: () => startGeneration.mutate({ project_id: project.id }),
      });
    } finally {
      setIsFetchingCount(false);
    }
  };

  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: t('entries.deleteSelectedTitle'),
      centered: true,
      children: (
        <Text size="sm">{t('entries.deleteSelectedMsg').replace('{n}', String(selectedLinkIds.length))}</Text>
      ),
      labels: { confirm: t('entries.deleteLinks'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        deleteLinksMutation.mutate(
          { projectId: project.id, link_ids: selectedLinkIds },
          { onSuccess: () => setSelectedLinkIds([]) }
        ),
    });

  const openReprocessModal = () =>
    modals.openConfirmModal({
      title: t('entries.reprocessTitle'),
      centered: true,
      children: (
        <Text size="sm">{t('entries.reprocessMsg').replace('{n}', String(processableSelectedLinks.length))}</Text>
      ),
      labels: { confirm: t('entries.reprocess'), cancel: t('common.cancel') },
      confirmProps: { color: 'blue' },
      onConfirm: () =>
        processEntriesMutation.mutate(
          { project_id: project.id, link_ids: processableSelectedLinks.map((l) => l.id) },
          { onSuccess: () => setSelectedLinkIds([]) }
        ),
    });

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedLinkIds(event.currentTarget.checked ? links.map((link) => link.id) : []);
  };

  const handleAddManualLinks = (urls: string[]) => {
    confirmLinks.mutate({ project_id: project.id, urls });
  };

  if (
    project.status === 'draft' ||
    project.status === 'search_params_generated' ||
    project.status === 'selector_generated'
  ) {
    return <Text c="dimmed">{t('entries.completePrev')}</Text>;
  }

  return (
    <>
      <AddLinksModal opened={addLinksModalOpened} onClose={closeAddLinksModal} onAdd={handleAddManualLinks} />
      <Stack>
        <Text>{t('entries.tip')}</Text>

        <Group>
          <Button
            onClick={handleStartAll}
            loading={startGeneration.isPending || isJobActive || isFetchingCount}
            disabled={isJobActive || isFetchingCount}
          >
            {t('entries.startAll')}
          </Button>
          <Button
            leftSection={<IconPlayerPlay size={14} />}
            disabled={processableSelectedLinks.length === 0 || isJobActive}
            onClick={openReprocessModal}
            loading={processEntriesMutation.isPending}
            variant="outline"
          >
            {t('entries.reprocessSel')} ({processableSelectedLinks.length})
          </Button>
          <Button
            leftSection={<IconTrash size={14} />}
            color="red"
            variant="outline"
            disabled={selectedLinkIds.length === 0 || isJobActive}
            onClick={openDeleteModal}
            loading={deleteLinksMutation.isPending}
          >
            {t('entries.deleteSel')} ({selectedLinkIds.length})
          </Button>
          <Button leftSection={<IconPlus size={14} />} onClick={openAddLinksModal} variant="outline">
            {t('entries.addManual')}
          </Button>
        </Group>

        <JobStatusIndicator job={processingJob} title={t('entries.statusTitle')} />

        {isLoadingLinks && <Loader />}

        {totalItems > 0 && (
          <>
            <Table mt="md" striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>
                    <Checkbox
                      checked={selectedLinkIds.length === links.length && links.length > 0}
                      indeterminate={selectedLinkIds.length > 0 && selectedLinkIds.length < links.length}
                      onChange={handleSelectAll}
                    />
                  </Table.Th>
                  <Table.Th>{t('entries.linkUrl')}</Table.Th>
                  <Table.Th>{t('common.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {links.map((link) => (
                  <Table.Tr key={link.id}>
                    <Table.Td>
                      <Checkbox
                        checked={selectedLinkIds.includes(link.id)}
                        onChange={(event) =>
                          setSelectedLinkIds(
                            event.currentTarget.checked
                              ? [...selectedLinkIds, link.id]
                              : selectedLinkIds.filter((id) => id !== link.id)
                          )
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text truncate>{link.url}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        label={link.skip_reason || link.error_message}
                        disabled={!link.skip_reason && !link.error_message}
                        multiline
                        w={220}
                      >
                        <Badge color={statusColors[link.status]} variant="light">
                          {link.status}
                        </Badge>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination value={activePage} onChange={handlePageChange} total={totalPages} />
              </Group>
            )}
          </>
        )}
      </Stack>
    </>
  );
}
