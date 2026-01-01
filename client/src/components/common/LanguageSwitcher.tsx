import { SegmentedControl, Group } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import type { Lang } from '../../i18n';
import { useI18n } from '../../i18n';

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <Group gap="xs">
      <IconLanguage size={18} style={{ opacity: 0.7 }} />
      <SegmentedControl
        size="sm"
      value={lang}
        onChange={(v) => setLang(v as Lang)}
        data={LANG_OPTIONS}
        styles={{
          root: {
            background: 'var(--mantine-color-dark-6)',
            border: '1px solid var(--mantine-color-dark-4)',
          },
          label: {
            fontWeight: 500,
            padding: '4px 12px',
          },
          indicator: {
            background: 'linear-gradient(135deg, rgba(255,182,193,0.5), rgba(186,85,211,0.4))',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          },
        }}
    />
    </Group>
  );
}
