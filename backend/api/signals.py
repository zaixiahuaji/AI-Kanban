from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BoardColumn, User


DEFAULT_COLUMNS = [
    {"slug": "todo", "name": "待办", "position": 0},
    {"slug": "in_progress", "name": "进行中", "position": 1},
    {"slug": "done", "name": "已完成", "position": 2},
]


@receiver(post_save, sender=User)
def create_default_columns(sender, instance, created, **kwargs):
    """新用户注册时自动创建默认三列"""
    if created:
        for col in DEFAULT_COLUMNS:
            BoardColumn.objects.create(
                name=col["name"],
                slug=col["slug"],
                position=col["position"],
                created_by=instance,
            )
