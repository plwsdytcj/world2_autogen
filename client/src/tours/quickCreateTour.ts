import type { TourStep } from '../stores/tourStore';

export const getQuickCreateTourSteps = (t: (key: string) => string): TourStep[] => [
  {
    target: '[data-tour="url-input"]',
    title: t('tour.quickCreate.step1.title') || 'Step 1: Enter URL',
    content:
      t('tour.quickCreate.step1.content') ||
      'Paste a URL here (Twitter/X, Facebook, or any website). Tip: Use a public profile or page for best results.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="project-type"]',
    title: t('tour.quickCreate.step2.title') || 'Step 2: Choose Type',
    content:
      t('tour.quickCreate.step2.content') ||
      'Choose what to generate:\n• Character Card: name, persona, example messages\n• Character + Lorebook: card plus detailed background entries',
    placement: 'bottom',
  },
  {
    target: '[data-tour="generate-btn"]',
    title: t('tour.quickCreate.step3.title') || 'Step 3: Generate',
    content:
      t('tour.quickCreate.step3.content') ||
      'Click Generate. The app fetches content and then creates a character card automatically. You can watch progress here.',
    placement: 'top',
  },
  {
    target: '[data-tour="advanced-options"]',
    title: t('tour.quickCreate.step4.title') || 'Advanced Options',
    content:
      t('tour.quickCreate.step4.content') ||
      'Click to reveal expert settings. Next steps cover credential, model and temperature controls.',
    placement: 'top',
  },
  {
    target: '[data-tour="credential-select"]',
    title: t('tour.quickCreate.credential.title') || 'API Credential',
    content:
      t('tour.quickCreate.credential.content') ||
      'Pick which provider/key to use. If empty, add one under Credentials. Different providers unlock different models.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="model-name"]',
    title: t('tour.quickCreate.model.title') || 'Model Name',
    content:
      t('tour.quickCreate.model.content') ||
      'Override the default model if you need a specific provider/model string. Leave as-is if unsure.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="temperature"]',
    title: t('tour.quickCreate.temperature.title') || 'Temperature',
    content:
      t('tour.quickCreate.temperature.content') ||
      'Controls randomness. Lower (0–0.5) = more consistent; Higher (1–2) = more creative. 0.7 is a good starting point.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="append-tab"]',
    title: t('tour.quickCreate.step5.title') || 'Append Mode',
    content:
      t('tour.quickCreate.step5.content') ||
      'Already have a project? Switch to this tab to add more content without losing existing details.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="append-project"]',
    title: t('tour.quickCreate.append.selectProject.title') || 'Select Project',
    content: t('tour.quickCreate.append.selectProject.content') || 'Choose which existing project to append new content to.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="append-url"]',
    title: t('tour.quickCreate.append.newUrl.title') || 'New URL',
    content:
      t('tour.quickCreate.append.newUrl.content') ||
      'Paste an additional URL to merge. The app fetches and integrates the content intelligently.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="append-submit"]',
    title: t('tour.quickCreate.append.submit.title') || 'Append Content',
    content:
      t('tour.quickCreate.append.submit.content') ||
      'Click to append and optionally regenerate the card and lorebook. Progress appears here just like in Quick Create.',
    placement: 'top',
  },
];

export const getProjectsTourSteps = (t: (key: string) => string): TourStep[] => [
  {
    target: '[data-tour="create-project"]',
    title: t('tour.projects.step1.title') || 'Create Project',
    content: t('tour.projects.step1.content') || 'Click here to create a new project. You can choose between Character Card or Character + Lorebook.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="projects-table"]',
    title: t('tour.projects.step2.title') || 'Your Projects',
    content: t('tour.projects.step2.content') || 'All your projects appear here. Click the eye icon to view/edit, or delete projects you no longer need.',
    placement: 'top',
  },
];

export const getCredentialsTourSteps = (t: (key: string) => string): TourStep[] => [
  {
    target: '[data-tour="create-credential"]',
    title: t('tour.credentials.step1.title') || 'Add Credentials',
    content: t('tour.credentials.step1.content') || 'Add your API keys here. You\'ll need:\n• An AI provider (OpenAI, Anthropic, Google, etc.)\n• Optionally, Apify token for Twitter/Facebook scraping',
    placement: 'bottom',
  },
  {
    target: '[data-tour="credentials-table"]',
    title: t('tour.credentials.table.title') || 'Your Credentials',
    content: t('tour.credentials.table.content') || 'All saved keys appear here. Use the pencil to edit or the trash to remove.',
    placement: 'top',
  },
];

export const getCharacterTourSteps = (t: (key: string) => string): TourStep[] => [
  {
    target: '[data-tour="sources-section"]',
    title: t('tour.character.step1.title') || 'Content Sources',
    content: t('tour.character.step1.content') || 'Add URLs as sources. Click "Fetch" to download content. Select sources to use for character generation.',
    placement: 'right',
  },
  {
    target: '[data-tour="character-editor"]',
    title: t('tour.character.step2.title') || 'Character Editor',
    content: t('tour.character.step2.content') || 'Edit your character card here. Click individual fields to regenerate them with AI, or regenerate the entire card.',
    placement: 'left',
  },
  {
    target: '[data-tour="append-button"]',
    title: t('tour.character.step3.title') || 'Append Content',
    content: t('tour.character.step3.content') || 'Want to add more information? Click here to add new URLs and merge content with your existing character.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="generate-character"]',
    title: t('tour.character.generate.title') || 'Generate Card',
    content: t('tour.character.generate.content') || 'Create or regenerate the full character card from selected sources. Enable by selecting at least one fetched source.',
    placement: 'left',
  },
  {
    target: '[data-tour="save-character"]',
    title: t('tour.character.save.title') || 'Save Changes',
    content: t('tour.character.save.content') || 'Save manual edits or AI-regenerated fields. This also clears the dirty state.',
    placement: 'left',
  },
  {
    target: '[data-tour="export-card"]',
    title: t('tour.character.exportPng.title') || 'Export Card (PNG)',
    content: t('tour.character.exportPng.content') || 'Download a character card image compatible with many chat apps.',
    placement: 'left',
  },
  {
    target: '[data-tour="export-json"]',
    title: t('tour.character.exportJson.title') || 'Export JSON',
    content: t('tour.character.exportJson.content') || 'Export raw character data as JSON for custom workflows.',
    placement: 'left',
  },
  {
    target: '[data-tour="export-mobile"]',
    title: t('tour.character.exportMobile.title') || 'Export to Mobile',
    content: t('tour.character.exportMobile.content') || 'Open a modal to create links/QR for the World2 iOS app to import directly.',
    placement: 'left',
  },
];
