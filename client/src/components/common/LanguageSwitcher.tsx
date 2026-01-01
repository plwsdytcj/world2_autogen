import { Select } from '@mantine/core';
import { useI18n, Lang } from '../../i18n';

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <Select
      size="xs"
      value={lang}
      onChange={(v) => v && setLang(v as Lang)}
      data={[
        { value: 'en', label: 'EN' },
        { value: 'zh', label: '中文' },
        { value: 'ja', label: '日本語' },
      ]}
      aria-label="Language"
      style={{ width: 90 }}
    />
  );
}

