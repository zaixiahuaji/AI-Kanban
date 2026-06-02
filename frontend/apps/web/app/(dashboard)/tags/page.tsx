import { getTags } from '@/actions/tag-actions'
import { TagsPageClient } from './tags-page-client'

export default async function TagsPage() {
  const result = await getTags()
  const tags = result.success ? (result.data?.results || []) : []

  return <TagsPageClient initialTags={tags} />
}
