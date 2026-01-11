import { Title, Table, Group, Text, ActionIcon, Badge, Stack, Skeleton, Button, Tooltip, Box } from '@mantine/core';
import { useProjects } from '../hooks/useProjects';
import { IconEye, IconPencil, IconTrash, IconHelp } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../utils/formatDate';
import { ProjectModal } from '../components/projects/ProjectModal';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import type { Project } from '../types';
import { useModals } from '@mantine/modals';
import { useI18n } from '../i18n';
import { useDeleteProject } from '../hooks/useProjectMutations';

const statusColors: Record<string, string> = {
  draft: 'gray',
  selector_generated: 'blue',
  links_extracted: 'cyan',
  processing: 'yellow',
  completed: 'green',
  failed: 'red',
};

export function ProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const modals = useModals();
  const deleteProjectMutation = useDeleteProject();
  const { t } = useI18n();

  const openDeleteModal = (project: Project) =>
    modals.openConfirmModal({
      title: t('projects.deleteTitle'),
      centered: true,
      children: (
        <Text size="sm">{t('projects.deleteConfirm')}</Text>
      ),
      labels: { confirm: t('projects.deleteConfirmBtn'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteProjectMutation.mutate(project.id),
    });

  const handleOpenCreateModal = () => {
    setSelectedProject(null);
    openModal();
  };

  const handleOpenEditModal = (project: Project) => {
    setSelectedProject(project);
    openModal();
  };

  const rows = data?.data.map((project) => (
    <Table.Tr key={project.id}>
      <Table.Td>
        <Text fw={500}>{project.name}</Text>
        <Text size="xs" c="dimmed">
          {project.id}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={statusColors[project.status]} variant="light">
          {t(`status.${project.status}`) || project.status.replace('_', ' ')}
        </Badge>
      </Table.Td>
      <Table.Td>{formatDate(project.updated_at)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            component={Link}
            to={`/projects/${project.id}`}
            variant="subtle"
            aria-label={(t('aria.viewProject') || 'View project {name}').replace('{name}', project.name)}
          >
            <IconEye size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            onClick={() => handleOpenEditModal(project)}
            aria-label={(t('aria.editItem') || 'Edit {name}').replace('{name}', project.name)}
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => openDeleteModal(project)}
            aria-label={(t('aria.deleteItem') || 'Delete {name}').replace('{name}', project.name)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  const loadingRows = Array.from({ length: 3 }).map((_, index) => (
    <Table.Tr key={index}>
      <Table.Td>
        <Skeleton height={8} mt={6} width="70%" radius="xl" />
        <Skeleton height={8} mt={6} width="40%" radius="xl" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={12} mt={6} width="50px" radius="xl" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={8} mt={6} width="60%" radius="xl" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={16} width={16} radius="sm" />
        <Skeleton height={16} ml={8} width={16} radius="sm" />
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <ProjectModal opened={modalOpened} onClose={closeModal} project={selectedProject} />
      <Stack>
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={1}>{t('nav.projects')}</Title>
            <Tooltip 
              label={
                <Box style={{ whiteSpace: 'pre-line' }}>
                  {t('guide.projects') || '📋 **Projects Page**\n\n• Click "Create New Project" to start\n• Choose Character Card for simple profiles\n• Choose Character + Lorebook for detailed backgrounds\n• Add URLs (Twitter, Facebook, websites) as sources\n• View/Edit projects anytime'}
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
          <Button onClick={handleOpenCreateModal} data-tour="create-project">{t('projects.create')}</Button>
        </Group>

        {error && <Text color="red">{t('projects.loadFailed')}: {error.message}</Text>}

        <Table striped highlightOnHover data-tour="projects-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('common.nameId')}</Table.Th>
              <Table.Th>{t('common.status')}</Table.Th>
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
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center">{t('projects.empty')}</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </>
  );
}
