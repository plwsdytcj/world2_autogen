import { SegmentedControl, Tooltip } from '@mantine/core';
import type { Lang } from '../../i18n';
import { useI18n } from '../../i18n';

const LANG_OPTIONS: { value: Lang; label: string; tooltip: string }[] = [
  { value: 'en', label: 'EN', tooltip: 'English' },
  { value: 'zh', label: '中', tooltip: '中文' },
  { value: 'ja', label: '日', tooltip: '日本語' },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <Tooltip.Group openDelay={300} closeDelay={100}>
      <SegmentedControl
        size="xs"
        value={lang}
        onChange={(v) => setLang(v as Lang)}
        data={LANG_OPTIONS.map((opt) => ({
          value: opt.value,
          label: (
            <Tooltip label={opt.tooltip} withArrow>
              <span style={{ padding: '0 4px' }}>{opt.label}</span>
            </Tooltip>
          ),
        }))}
        styles={{
          root: {
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          indicator: {
            background: 'linear-gradient(135deg, rgba(255,182,193,0.4), rgba(186,85,211,0.3))',
          },
        }}
      />
    </Tooltip.Group>
  );
}
