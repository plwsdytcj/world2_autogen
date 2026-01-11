import type { TourStep } from '../stores/tourStore';

export const getQuickCreateTourSteps = (t: (key: string) => string): TourStep[] => [
  {
    target: '[data-tour="url-input"]',
    title: t('tour.quickCreate.step1.title') || 'Step 1: Enter URL',
    content: t('tour.quickCreate.step1.content') || 'Paste a URL here - Twitter/X profile, Facebook page, or any website. We\'ll extract content from it.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="project-type"]',
    title: t('tour.quickCreate.step2.title') || 'Step 2: Choose Type',
    content: t('tour.quickCreate.step2.content') || 'Select what you want to generate:\n• Character Card: Basic profile with personality\n• Character + Lorebook: Full profile with detailed background entries',
    placement: 'bottom',
  },
  {
    target: '[data-tour="generate-btn"]',
    title: t('tour.quickCreate.step3.title') || 'Step 3: Generate!',
    content: t('tour.quickCreate.step3.content') || 'Click Generate to start! We\'ll fetch content from the URL and use AI to create your character card.',
    placement: 'top',
  },
  {
    target: '[data-tour="advanced-options"]',
    title: t('tour.quickCreate.step4.title') || 'Advanced Options',
    content: t('tour.quickCreate.step4.content') || 'Need more control? Click here to customize:\n• API credentials\n• Model selection\n• Temperature settings\n• Posts limit for social media',
    placement: 'top',
  },
  {
    target: '[data-tour="append-tab"]',
    title: t('tour.quickCreate.step5.title') || 'Append Mode',
    content: t('tour.quickCreate.step5.content') || 'Already have a project? Use this tab to add more content to existing character cards without losing previous data.',
    placement: 'bottom',
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
];

