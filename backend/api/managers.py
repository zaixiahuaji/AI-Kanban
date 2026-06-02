from django.db import models


class TaskManager(models.Manager):
    """任务查询管理器，默认排除已删除的任务"""

    def active(self):
        return self.get_queryset().filter(is_deleted=False)

    def deleted(self):
        return self.get_queryset().filter(is_deleted=True)
