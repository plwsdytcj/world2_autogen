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
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();

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
      
      // Get avatar URL - prefer backend's processed avatar (which handles local→public conversion)
      let avatar: string | undefined = undefined;
      
      // First try to get avatar from backend response (already processed)
      if (scheme) {
        try {
          const qm = scheme.indexOf('?');
          if (qm >= 0) {
            const qs = scheme.slice(qm + 1);
            const p = new URLSearchParams(qs);
            const v = p.get('avatar');
            if (v) {
              try {
                avatar = decodeURIComponent(v);
              } catch {
                avatar = v;
              }
            }
          }
        } catch {}
      }
      
      // Fallback to card's avatar_url if backend didn't provide one
      if (!avatar && cardResp?.data?.avatar_url) {
        avatar = cardResp.data.avatar_url;
      }
      
      // If avatar is a relative path, convert to full URL
      if (avatar && avatar.startsWith('/')) {
        // Use production URL for external app access
        const prodBase = 'https://world2-autogen.onrender.com';
        avatar = `${prodBase}${avatar}`;
      }
      // Avoid double-encoding avatar by removing it from Universal Link used inside deep link
      let fullNoAvatar = full;
      try {
        const u = new URL(full);
        u.searchParams.delete('avatar');
        fullNoAvatar = u.toString();
      } catch {
        // Fallback string removal if URL parsing fails
        fullNoAvatar = full.replace(/([?&])avatar=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
      }
      const deep = `poki://import?url=${encodeURIComponent(fullNoAvatar)}${avatar ? `&avatar=${encodeURIComponent(avatar)}` : ''}`;
      setDeepLink(deep);
      notifications.show({ title: (t('export.shareCreatedTitle') || 'Share Link Created'), message: (t('export.shareCreatedMsg') || 'Scan the QR in your iOS app to import.'), color: 'green' });
    } catch (err) {
      console.error(err);
      notifications.show({ title: (t('export.failedTitle') || 'Failed'), message: (t('export.failedMsg') || 'Could not create a mobile share link.'), color: 'red' });
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
      notifications.show({ title: (t('export.copiedTitle') || 'Copied'), message: (t('export.copiedMsg') || 'Link copied to clipboard'), color: 'blue' });
    } catch {}
  };

  const downloadQr = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world2-share-qr.png';
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
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>{t('export.title')}</Text>} centered size="lg">
      <Stack gap="md">
        <Group grow>
          <TextInput label={t('export.projectId')} value={projectId} readOnly />
          <TextInput label={t('export.contentType')} value={contentType} readOnly />
          <Select label={t('export.format')} value={exportFormat} data={formatOptions} onChange={(v) => setExportFormat((v as ExportFormat) || exportFormat)} disabled={!canPickFormat} />
        </Group>

        <Group>
          <Button onClick={createShare} loading={creating} leftSection={creating ? <Loader size="xs" /> : undefined}>
            {t('export.generate')}
          </Button>
          {shareLink && (
            <>
              <Button variant="light" onClick={handleCopy}>{t('export.copy')}</Button>
              <Button variant="default" onClick={() => shareLink && window.open(shareLink, '_blank')}>{t('export.open')}</Button>
            </>
          )}
        </Group>

        {shareLink && (
          <>
            <Divider label={t('export.scan')} />
            <Group align="flex-start" wrap="nowrap">
              <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
              <Stack gap={6} style={{ flex: 1 }}>
                {deepLink && (
                  <>
                    <Text size="sm" fw={500}>{t('export.deepLink')}</Text>
                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>{deepLink}</Text>
                  </>
                )}
                <Text size="sm" fw={500}>{t('export.universal')}</Text>
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  {shareLink}
                </Text>
                {schemeLink && (
                  <>
                    <Text size="sm" fw={500}>{t('export.scheme')}</Text>
                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                      {schemeLink}
                    </Text>
                  </>
                )}
                <Group>
                  <Tooltip label={t('export.downloadQr')} withArrow>
                    <ActionIcon onClick={downloadQr} variant="subtle" aria-label={t('export.downloadQr') || 'Download QR'}>
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
