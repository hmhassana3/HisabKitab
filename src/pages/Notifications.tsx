import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { IconBell, IconTrash } from '../components/icons'
import { formatDateTime, daysFromToday } from '../lib/date'
import type { AppNotification } from '../types'

export function Notifications() {
  const { data, markNotificationRead, markAllNotificationsRead, clearNotifications } = useApp()
  const { t } = useI18n()

  const list = useMemo(
    () => Object.values(data.notifications.items).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    [data],
  )
  const unread = list.filter((n) => !n.read).length

  const color: Record<AppNotification['type'], 'red' | 'green' | 'amber' | 'blue' | 'gray'> = {
    payment_due: 'amber',
    overdue: 'red',
    payment_received: 'green',
    reminder_sent: 'blue',
    sync_failed: 'red',
    upload_failed: 'red',
    info: 'gray',
    expense: 'gray',
  }

  return (
    <div>
      <PageHeader
        title={t('notif_title')}
        subtitle={unread > 0 ? `${unread} unread` : ''}
        actions={
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={markAllNotificationsRead}>{t('notif_markAll')}</Button>
            <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t('misc_confirmDelete'))) clearNotifications() }}><IconTrash width={14} height={14} /></Button>
          </div>
        }
      />

      {list.length === 0 && <Card><EmptyState icon={<IconBell width={40} height={40} />} text={t('notif_empty')} /></Card>}

      <div className="space-y-2">
        {list.map((n) => (
          <Card key={n.id} className={`p-3.5 ${n.read ? 'opacity-70' : 'border-brand-200 dark:border-brand-800'}`} onClick={() => { markNotificationRead(n.id); if (n.customerId) window.location.hash = `#/customers/${n.customerId}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{n.title}</p>
                  <Badge color={color[n.type]}>{n.type}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{n.body}</p>
                <p className="mt-1 text-[10px] text-ink-400">{formatDateTime(n.createdAt)}</p>
              </div>
              {n.customerId && <span className="shrink-0 text-[11px] font-bold text-brand-600">{t('customers_open')} →</span>}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-center text-[10px] text-ink-300">{t('notif_title')} — {t('misc_poweredBy')}</p>
    </div>
  )
}
