// 泳道分组工具函数

export type SwimlaneDimension = 'none' | 'tag' | 'priority'

export interface SwimlaneGroup {
  key: string
  label: string
  color?: string
  tasks: Task[]
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  is_overdue: string
  tags: Tag[]
  [key: string]: unknown
}

export function groupTasksByDimension(
  tasks: Task[],
  dimension: SwimlaneDimension,
  allTags: Tag[],
): SwimlaneGroup[] {
  if (dimension === 'none') {
    return [{ key: 'all', label: '', tasks }]
  }

  if (dimension === 'priority') {
    return [
      {
        key: 'high',
        label: '高优先级',
        tasks: tasks.filter((t) => t.priority === 'high'),
      },
      {
        key: 'medium',
        label: '中优先级',
        tasks: tasks.filter((t) => t.priority === 'medium'),
      },
      {
        key: 'low',
        label: '低优先级',
        tasks: tasks.filter((t) => t.priority === 'low'),
      },
    ]
  }

  if (dimension === 'tag') {
    const groups: SwimlaneGroup[] = allTags.map((tag) => ({
      key: tag.id,
      label: tag.name,
      color: tag.color,
      tasks: tasks.filter((t) => t.tags.some((tg) => tg.id === tag.id)),
    }))
    const untagged = tasks.filter((t) => t.tags.length === 0)
    if (untagged.length > 0) {
      groups.push({ key: 'untagged', label: '未分类', tasks: untagged })
    }
    return groups
  }

  return [{ key: 'all', label: '', tasks }]
}

export interface Column {
  id: string
  name: string
  slug: string
  position: number
}
