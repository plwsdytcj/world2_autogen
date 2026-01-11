import { useEffect, useState, useCallback } from 'react';
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

  const updatePosition = useCallback(() => {
    if (!currentStepData?.target) return;

    const element = document.querySelector(currentStepData.target);
    if (!element) {
      // Element not found, try again after a short delay
      setTimeout(updatePosition, 100);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    setTargetRect({
      top: rect.top - padding + window.scrollY,
      left: rect.left - padding + window.scrollX,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate popover position
    const popoverWidth = 340;
    const popoverHeight = 180;
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
              border: '4px solid var(--mantine-color-pink-5)',
              borderRadius: '8px',
              boxShadow: '0 0 0 6px rgba(236, 72, 153, 0.35), 0 10px 30px rgba(0,0,0,0.35)',
              background: 'rgba(236, 72, 153, 0.15)',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {/* Popover */}
      <Paper
        shadow="xl"
        p="md"
        radius="md"
        style={{
          position: 'absolute',
          top: popoverPosition.top,
          left: popoverPosition.left,
          width: 340,
          zIndex: 9999,
          border: '1px solid var(--mantine-color-gray-3)',
        }}
      >
        <Group justify="space-between" mb="xs">
          <Badge size="sm" color="pink" variant="filled">
            {currentStep + 1} / {steps.length}
          </Badge>
          <CloseButton onClick={closeTour} size="sm" />
        </Group>

        <Text fw={600} size="lg" mb="xs">
          {currentStepData.title}
        </Text>

        <Text size="sm" c="dimmed" mb="md" style={{ whiteSpace: 'pre-line' }}>
          {currentStepData.content}
        </Text>

        <Group justify="space-between">
          <Button
            variant="subtle"
            size="xs"
            onClick={skipTour}
            c="dimmed"
          >
            {t('tour.skip') || 'Skip tour'}
          </Button>

          <Group gap="xs">
            <Button
              variant="default"
              size="sm"
              leftSection={<IconChevronLeft size={16} />}
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              {t('tour.prev') || 'Previous'}
            </Button>
            <Button
              size="sm"
              rightSection={currentStep < steps.length - 1 ? <IconChevronRight size={16} /> : null}
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
