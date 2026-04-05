"use client";

import { Card } from '@/components/ui/card';
import { Framework } from '@/lib/constants/content-strategy';
import { useTranslations } from 'next-intl';

interface TemplateCardProps {
  framework: Framework;
  isSelected: boolean;
  onClick: () => void;
  onHover?: (framework: Framework | null) => void;
}

export default function TemplateCard({ framework, isSelected, onClick, onHover }: TemplateCardProps) {
  const t = useTranslations('CreatePage.createSection.strategySelector');
  const Icon = framework.icon;

  // Lấy title và description đầy đủ từ translation hoặc fallback
  const fullTitle = t(`frameworks.${framework.slug}.title`, { defaultValue: framework.title });
  const fullDescription = t(`frameworks.${framework.slug}.description`, { defaultValue: framework.description });

  return (
    <div 
      className="relative group"
      onMouseEnter={() => onHover?.(framework)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Card
        onClick={onClick}
        className={`
          cursor-pointer transition-all duration-200 p-4 h-full
          hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5
          ${isSelected 
            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-lg shadow-primary/20' 
            : 'border-input bg-secondary/30 hover:bg-secondary/60'
          }
        `}
      >
        <div className="space-y-1.5">
          {/* Hàng đầu: Icon + Title, căn giữa theo chiều dọc */}
          <div className="flex items-center gap-3">
            <div className={`
              flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
              ${isSelected 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted text-muted-foreground'
              }
            `}>
              <Icon className="w-5 h-5" />
            </div>
            <h4 className={`
              font-bold text-sm line-clamp-2
              ${isSelected ? 'text-primary' : 'text-foreground'}
            `}>
              {fullTitle}
            </h4>
          </div>

          {/* Dòng mô tả luôn bắt đầu cùng một vị trí bên dưới hàng icon+title */}
          <p className="text-xs text-muted-foreground line-clamp-2 ml-[52px]">
            {fullDescription}
          </p>
        </div>
      </Card>
    </div>
  );
}
