import { Title, Table, Group, Text, ActionIcon, Stack, Skeleton, Button } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import type { Credential } from '../types';
import { useModals } from '@mantine/modals';
import { formatDate } from '../utils/formatDate';
import { useCredentials } from '../hooks/useCredentials';
import { CredentialModal } from '../components/credentials/CredentialModal';
import { useI18n } from '../i18n';
import { useDeleteCredential } from '../hooks/useCredentialsMutations';

export function CredentialsPage() {
  const { data: credentials, isLoading, error } = useCredentials();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const modals = useModals();
  const deleteCredentialMutation = useDeleteCredential();
  const { t } = useI18n();

  const openDeleteModal = (credential: Credential) =>
    modals.openConfirmModal({
      title: t('credentials.deleteTitle'),
      centered: true,
      children: (
        <Text size="sm">{t('credentials.deleteConfirm')}</Text>
      ),
      labels: { confirm: t('credentials.deleteConfirmBtn'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteCredentialMutation.mutate(credential.id),
    });

  const handleOpenCreateModal = () => {
    setSelectedCredential(null);
    openModal();
  };

  const handleOpenEditModal = (credential: Credential) => {
    setSelectedCredential(credential);
    openModal();
  };

  const rows = credentials?.map((cred) => (
    <Table.Tr key={cred.id}>
      <Table.Td>
        <Text fw={500}>{cred.name}</Text>
      </Table.Td>
      <Table.Td>{cred.provider_type}</Table.Td>
      <Table.Td>{formatDate(cred.updated_at)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => handleOpenEditModal(cred)} aria-label={`Edit ${cred.name}`}>
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => openDeleteModal(cred)}
            aria-label={`Delete ${cred.name}`}
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
      </Table.Td>
      <Table.Td>
        <Skeleton height={8} mt={6} width="50%" radius="xl" />
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
      <CredentialModal opened={modalOpened} onClose={closeModal} credential={selectedCredential} />
      <Stack>
        <Group justify="space-between">
          <Title order={1}>{t('nav.credentials')}</Title>
          <Button onClick={handleOpenCreateModal}>{t('credentials.create')}</Button>
        </Group>

        {error && <Text color="red">{t('credentials.loadFailed')}: {error.message}</Text>}

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('common.name')}</Table.Th>
              <Table.Th>{t('credentials.providerType')}</Table.Th>
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
                  <Text c="dimmed" ta="center">{t('credentials.empty')}</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </>
  );
}
