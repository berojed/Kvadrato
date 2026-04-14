import { useI18n } from '@/context/I18nContext'

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--color-border)] mt-auto bg-[var(--color-background)]">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400 font-medium">
            {t('footer.copyright', { year })}
          </p>
          <p className="text-xs text-gray-400">
            {t('footer.thesis')}
          </p>
        </div>
      </div>
    </footer>
  )
}
