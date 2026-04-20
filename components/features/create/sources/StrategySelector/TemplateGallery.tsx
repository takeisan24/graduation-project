"use client";

import { Framework } from '@/lib/constants/content-strategy';
import TemplateCard from './TemplateCard';
import { useTranslations } from 'next-intl';

interface TemplateGalleryProps {
  frameworks: Framework[];
  selectedId: string | null;
  onSelect: (framework: Framework) => void;
  onHover?: (framework: Framework | null) => void;
}

export default function TemplateGallery({ frameworks, selectedId, onSelect, onHover }: TemplateGalleryProps) {
  const t = useTranslations('CreatePage.createSection.strategySelector');

  if (frameworks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">
          {t('emptyState')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
      {frameworks.map((framework) => (
        <TemplateCard
          key={framework.id}
          framework={framework}
          isSelected={selectedId === framework.id}
          onClick={() => onSelect(framework)}
          onHover={onHover}
        />
      ))}
    </div>
  );
}
