import { useEffect, useState, useCallback, useRef } from 'react';
import { Paper, Text, Button, Group, Badge, CloseButton, Portal, Box } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useTourStore } from '../../stores/tourStore';
import { useI18n } from '../../i18n';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour() {
  const { t } = useI18n();
  const { isOpen, currentStep, steps, nextStep, prevStep, closeTour, skipTour } = useTourStore();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  const currentStepData = steps[currentStep];
  const ensureAttemptRef = useRef<{ target?: string; attempts: number }>({ attempts: 0 });

  const updatePosition = useCallback(() => {
    if (!currentStepData?.target) return;

    const element = document.querySelector(currentStepData.target);
    if (!element) {
      // Try to reveal target by opening related UI (advanced options, append tab, etc.)
      const target = currentStepData.target;
      const last = ensureAttemptRef.current;
      if (last.target !== target) {
        ensureAttemptRef.current = { target, attempts: 0 };
      }
      if (ensureAttemptRef.current.attempts < 10) {
        ensureAttemptRef.current.attempts++;
        // Advanced options panel
        const advancedSelectors = new Set([
          '[data-tour="credential-select"]',
          '[data-tour="model-name"]',
          '[data-tour="temperature"]',
        ]);
        if (advancedSelectors.has(target)) {
          const advToggle = document.querySelector('[data-tour="advanced-options"]') as HTMLElement | null;
          advToggle?.click();
        }
        // Append tab
        const appendSelectors = new Set([
          '[data-tour="append-project"]',
          '[data-tour="append-url"]',
          '[data-tour="append-submit"]',
        ]);
        if (appendSelectors.has(target)) {
          const appendTab = document.querySelector('[data-tour="append-tab"]') as HTMLElement | null;
          appendTab?.click();
        }
      }
      // Element not found yet, try again after a short delay
      setTimeout(updatePosition, 120);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 12;

    setTargetRect({
      top: rect.top - padding + window.scrollY,
      left: rect.left - padding + window.scrollX,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate popover position
    const popoverWidth = 420;
    const popoverHeight = 220;
    const placement = currentStepData.placement || 'bottom';

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = rect.top + window.scrollY - popoverHeight - 20;
        left = rect.left + window.scrollX + rect.width / 2 - popoverWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + window.scrollY + 20;
        left = rect.left + window.scrollX + rect.width / 2 - popoverWidth / 2;
        break;
      case 'left':
        top = rect.top + window.scrollY + rect.height / 2 - popoverHeight / 2;
        left = rect.left + window.scrollX - popoverWidth - 20;
        break;
      case 'right':
        top = rect.top + window.scrollY + rect.height / 2 - popoverHeight / 2;
        left = rect.right + window.scrollX + 20;
        break;
    }

    // Ensure popover stays within viewport
    const maxLeft = window.innerWidth - popoverWidth - 20;
    const maxTop = window.innerHeight + window.scrollY - popoverHeight - 20;
    left = Math.max(20, Math.min(left, maxLeft));
    top = Math.max(20, Math.min(top, maxTop));

    setPopoverPosition({ top, left });

    // Scroll element into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStepData]);

  useEffect(() => {
    if (isOpen && currentStepData) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [isOpen, currentStepData, updatePosition]);

  if (!isOpen || !currentStepData) return null;

  return (
    <Portal>
      {/* Overlay */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      >
        {/* Solid dim overlay (no cutout) */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(2px)',
          }}
        />

        {/* Highlight border */}
        {targetRect && (
          <Box
            style={{
              position: 'absolute',
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              border: '6px solid var(--mantine-color-pink-5)',
              borderRadius: 10,
              boxShadow: '0 0 0 8px rgba(236, 72, 153, 0.35), 0 12px 36px rgba(0,0,0,0.4)',
              background: 'rgba(236, 72, 153, 0.2)',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {/* Popover */}
      <Paper
        shadow="xl"
        p="lg"
        radius="lg"
        style={{
          position: 'absolute',
          top: popoverPosition.top,
          left: popoverPosition.left,
          width: 420,
          zIndex: 9999,
          border: '1px solid var(--mantine-color-gray-3)',
        }}
      >
        <Group justify="space-between" mb="sm">
          <Badge size="md" color="pink" variant="filled">
            {currentStep + 1} / {steps.length}
          </Badge>
          <CloseButton onClick={closeTour} size="md" />
        </Group>

        <Text fw={700} size="xl" mb="sm">
          {currentStepData.title}
        </Text>

        <Text size="md" c="dimmed" mb="lg" style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>
          {currentStepData.content}
        </Text>

        <Group justify="space-between">
          <Button
            variant="subtle"
            size="sm"
            onClick={skipTour}
            c="dimmed"
          >
            {t('tour.skip') || 'Skip tour'}
          </Button>

          <Group gap="xs">
            <Button
              variant="default"
              size="md"
              leftSection={<IconChevronLeft size={18} />}
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              {t('tour.prev') || 'Previous'}
            </Button>
            <Button
              size="md"
              rightSection={currentStep < steps.length - 1 ? <IconChevronRight size={18} /> : null}
              onClick={nextStep}
            >
              {currentStep < steps.length - 1 
                ? (t('tour.next') || 'Next') 
                : (t('tour.finish') || 'Finish')}
            </Button>
          </Group>
        </Group>
      </Paper>
    </Portal>
  );
}
