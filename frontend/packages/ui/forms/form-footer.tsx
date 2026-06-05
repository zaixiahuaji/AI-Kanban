'use client'

import Link from 'next/link'
import type React from 'react'

export function FormFooter({
  cta,
  link,
  title
}: {
  cta: string
  link: string
  title: string
}) {
  const actionLink = (
    <Link
      href={link}
      className="font-medium text-gray-900 transition-colors hover:text-gray-700"
    >
      {title}
    </Link>
  )

  return (
    <p className="mt-6 text-center text-sm text-gray-500">
      {cta} {actionLink}
    </p>
  )
}
