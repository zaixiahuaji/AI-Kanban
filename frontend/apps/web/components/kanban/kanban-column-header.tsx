'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface KanbanColumnHeaderProps {
  title: string
  count: number
  onRename?: () => void
  onDelete?: () => void
}

export function KanbanColumnHeader({
  title,
  count,
  onRename,
  onDelete,
}: KanbanColumnHeaderProps) {
  const t = useTranslations('kanban')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      <div className="flex items-center gap-1">
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
          {count}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onRename?.()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                ✏️ {t('renameColumn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete?.()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                🗑️ {t('deleteColumn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
