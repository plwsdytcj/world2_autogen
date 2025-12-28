import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Select,
  TextInput,
  Loader,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../services/api';
import QRCode from 'qrcode';
import { notifications } from '@mantine/notifications';

type ContentType = 'character' | 'lorebook';
type ExportFormat = 'json' | 'png';

interface ExportToMobileModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  contentType: ContentType;
  defaultFormat?: ExportFormat; // default png for character, json for lorebook
}

export function ExportToMobileModal({ opened, onClose, projectId, contentType, defaultFormat }: ExportToMobileModalProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultFormat || (contentType === 'character' ? 'png' : 'json'));
  const [creating, setCreating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [schemeLink, setSchemeLink] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setExportFormat(defaultFormat || (contentType === 'character' ? 'png' : 'json'));
    setShareLink(null);
    setSchemeLink(null);
  }, [opened, contentType, defaultFormat]);

  const isCharacter = contentType === 'character';
  const canPickFormat = isCharacter; // lorebook 固定 json

  const createShare = async () => {
    setCreating(true);
    try {
      const payload = {
        project_id: projectId,
        content_type: contentType,
        export_format: exportFormat,
        expires_in_s: 3600,
        max_uses: 3,
      };
      const { data } = await apiClient.post('/shares', payload);
      const universalPath: string = data.links?.universal || '';
      const scheme: string | undefined = data.links?.scheme;
      const base = window.location.origin; // 前端拼接域名
      const full = universalPath.startsWith('http') ? universalPath : `${base}${universalPath}`;
      setShareLink(full);
      setSchemeLink(scheme || null);

      // 生成 QR
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, full, { width: 220, margin: 1 });
      }
      notifications.show({ title: 'Share Link Created', message: 'Scan the QR in your iOS app to import.', color: 'green' });
    } catch (err) {
      console.error(err);
      notifications.show({ title: 'Failed', message: 'Could not create a mobile share link.', color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      notifications.show({ title: 'Copied', message: 'Link copied to clipboard', color: 'blue' });
    } catch {}
  };

  const downloadQr = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lorecard-share-qr.png';
    a.click();
  };

  const formatOptions = useMemo(() => {
    if (!canPickFormat) return [{ value: 'json', label: 'JSON' }];
    return [
      { value: 'png', label: 'PNG (Chara Card v2)' },
      { value: 'json', label: 'JSON' },
    ];
  }, [canPickFormat]);

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Export to Mobile</Text>} centered size="lg">
      <Stack gap="md">
        <Group grow>
          <TextInput label="Project ID" value={projectId} readOnly />
          <TextInput label="Content Type" value={contentType} readOnly />
          <Select label="Format" value={exportFormat} data={formatOptions} onChange={(v) => setExportFormat((v as ExportFormat) || exportFormat)} disabled={!canPickFormat} />
        </Group>

        <Group>
          <Button onClick={createShare} loading={creating} leftSection={creating ? <Loader size="xs" /> : undefined}>
            Generate Link & QR
          </Button>
          {shareLink && (
            <>
              <Button variant="light" onClick={handleCopy}>Copy Link</Button>
              <Button variant="default" onClick={() => shareLink && window.open(shareLink, '_blank')}>Open</Button>
            </>
          )}
        </Group>

        {shareLink && (
          <>
            <Divider label="Scan with iOS App" />
            <Group align="flex-start" wrap="nowrap">
              <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
              <Stack gap={6} style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  Universal Link
                </Text>
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  {shareLink}
                </Text>
                {schemeLink && (
                  <>
                    <Text size="sm" fw={500}>
                      URL Scheme (fallback)
                    </Text>
                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                      {schemeLink}
                    </Text>
                  </>
                )}
                <Group>
                  <Tooltip label="Download QR as image" withArrow>
                    <ActionIcon onClick={downloadQr} variant="subtle" aria-label="Download QR">
                      ⤓
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Stack>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

