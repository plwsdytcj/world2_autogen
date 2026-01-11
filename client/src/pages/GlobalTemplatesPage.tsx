import { Title, Table, Group, Text, ActionIcon, Stack, Skeleton, Button, Pagination, Tooltip, Box } from '@mantine/core';
import { useGlobalTemplates } from '../hooks/useGlobalTemplates';
import { IconPencil, IconTrash, IconHelp } from '@tabler/icons-react';
import { formatDate } from '../utils/formatDate';
import { useDisclosure } from '@mantine/hooks';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GlobalTemplate } from '../types';
import { useModals } from '@mantine/modals';
import { GlobalTemplateModal } from '../components/templates/GlobalTemplateModal';
import { useI18n } from '../i18n';
import { useDeleteGlobalTemplate } from '../hooks/useGlobalTemplatesMutations';

const PAGE_SIZE = 25;

export function GlobalTemplatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
  const [activePage, setPage] = useState(isNaN(pageFromUrl) ? 1 : pageFromUrl);

  const { data: templatesResponse, isLoading, error } = useGlobalTemplates({ page: activePage, pageSize: PAGE_SIZE });

  useEffect(() => {
    const newPageFromUrl = parseInt(searchParams.get('page') || '1', 10);
    const validPage = isNaN(newPageFromUrl) ? 1 : newPageFromUrl;
    if (validPage !== activePage) {
      setPage(validPage);
    }
  }, [searchParams, activePage]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams({ page: newPage.toString() });
  };

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GlobalTemplate | null>(null);
  const modals = useModals();
  const deleteTemplateMutation = useDeleteGlobalTemplate();
  const { t } = useI18n();

  const templates = templatesResponse?.data || [];
  const totalItems = templatesResponse?.meta.total_items || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  const openDeleteModal = (template: GlobalTemplate) =>
    modals.openConfirmModal({
      title: t('templates.deleteTitle'),
      centered: true,
      children: (
        <Text size="sm">{t('templates.deleteConfirm')}</Text>
      ),
      labels: { confirm: t('templates.deleteConfirmBtn'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteTemplateMutation.mutate(template.id),
    });

  const handleOpenCreateModal = () => {
    setSelectedTemplate(null);
    openModal();
  };

  const handleOpenEditModal = (template: GlobalTemplate) => {
    setSelectedTemplate(template);
    openModal();
  };

  const rows = templates.map((template) => {
    // Global templates (user_id is null) are read-only
    const isGlobalTemplate = template.user_id === null || template.user_id === undefined;
    
    return (
      <Table.Tr key={template.id}>
        <Table.Td>
          <Text fw={500}>{template.name}</Text>
          <Text size="xs" c="dimmed">
            {template.id}
            {isGlobalTemplate && (
              <Text component="span" size="xs" c="dimmed" ml="xs">
                (Global)
              </Text>
            )}
          </Text>
        </Table.Td>
        <Table.Td>{formatDate(template.updated_at)}</Table.Td>
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              onClick={() => handleOpenEditModal(template)}
              aria-label={(t('aria.editItem') || 'Edit {name}').replace('{name}', template.name)}
              disabled={isGlobalTemplate}
              title={isGlobalTemplate ? (t('templates.globalTemplateReadOnly') || 'Global templates are read-only') : undefined}
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => openDeleteModal(template)}
              aria-label={(t('aria.deleteItem') || 'Delete {name}').replace('{name}', template.name)}
              disabled={isGlobalTemplate}
              title={isGlobalTemplate ? (t('templates.globalTemplateReadOnly') || 'Global templates are read-only') : undefined}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  const loadingRows = Array.from({ length: 5 }).map((_, index) => (
    <Table.Tr key={index}>
      <Table.Td>
        <Skeleton height={8} mt={6} width="70%" radius="xl" />
        <Skeleton height={8} mt={6} width="40%" radius="xl" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={8} mt={6} width="60%" radius="xl" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={16} width={16} radius="sm" />
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <GlobalTemplateModal opened={modalOpened} onClose={closeModal} template={selectedTemplate} />
      <Stack>
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={1}>{t('templates.title')}</Title>
            <Tooltip 
              label={
                <Box style={{ whiteSpace: 'pre-line' }}>
                  {t('guide.templates') || '📝 **Templates Page**\n\n• Templates control how AI generates content\n• Global templates (📌) are read-only defaults\n• Create custom templates to override defaults\n• Use Jinja2 syntax for dynamic prompts'}
                </Box>
              } 
              multiline 
              w={320}
              position="bottom-start"
            >
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconHelp size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Button onClick={handleOpenCreateModal}>{t('templates.create')}</Button>
        </Group>

        {error && <Text color="red">{t('templates.loadFailed')}: {error.message}</Text>}

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('common.nameId')}</Table.Th>
              <Table.Th>{t('common.lastUpdated')}</Table.Th>
              <Table.Th>{t('common.actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              loadingRows
            ) : rows?.length ? (
              rows
            ) : (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" ta="center">{t('templates.empty')}</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={activePage} onChange={handlePageChange} total={totalPages} />
          </Group>
        )}
      </Stack>
    </>
  );
}
