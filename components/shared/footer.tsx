"use client"

import { Sparkles } from "lucide-react"
import {useTranslations} from 'next-intl'

export default function Footer() {
  const t = useTranslations('Footer');
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-bold">CreatorHub</span>
            </div>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{t('title.product')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  {t('links.features')}
                </a>
              </li>
              <li>
                <a href="/pricing" className="hover:text-foreground transition-colors">
                  {t('links.pricing')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.templates')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{t('title.resources')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.blog')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.tutorials')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.support')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{t('title.company')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.about')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.contact')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  {t('links.privacy')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>{t('copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
