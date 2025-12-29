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
import { useCharacterCard } from '../../hooks/useCharacterCard';
import * as QRCode from 'qrcode';
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
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { data: cardResp } = useCharacterCard(projectId);

  useEffect(() => {
    setExportFormat(defaultFormat || (contentType === 'character' ? 'png' : 'json'));
    setShareLink(null);
    setSchemeLink(null);
    setDeepLink(null);
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
      // Prefer avatar from card; fallback to "avatar" query in scheme returned by backend
      let avatar = cardResp?.data?.avatar_url || undefined;
      if (!avatar && scheme) {
        try {
          const qm = scheme.indexOf('?');
          if (qm >= 0) {
            const qs = scheme.slice(qm + 1);
            const p = new URLSearchParams(qs);
            const v = p.get('avatar');
            if (v) avatar = v;
          }
        } catch {}
      }
      const deep = `poki://import?url=${encodeURIComponent(full)}${avatar ? `&avatar=${encodeURIComponent(avatar)}` : ''}`;
      setDeepLink(deep);
      notifications.show({ title: 'Share Link Created', message: 'Scan the QR in your iOS app to import.', color: 'green' });
    } catch (err) {
      console.error(err);
      notifications.show({ title: 'Failed', message: 'Could not create a mobile share link.', color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  // 在 shareLink 更新且 canvas 已渲染后再绘制二维码
  useEffect(() => {
    const draw = async () => {
      const value = deepLink || shareLink;
      if (!value || !canvasRef.current) return;
      try {
        // 清空画布
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        await QRCode.toCanvas(canvasRef.current, value, { width: 220, margin: 1 });
      } catch (e) {
        console.error('QR render failed', e);
      }
    };
    draw();
  }, [shareLink, deepLink]);

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
                {deepLink && (
                  <>
                    <Text size="sm" fw={500}>Deep Link (QR content)</Text>
                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>{deepLink}</Text>
                  </>
                )}
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
