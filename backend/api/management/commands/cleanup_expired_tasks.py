from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Task


class Command(BaseCommand):
    help = "Permanently delete tasks that have been in trash for more than 30 days"

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        result = Task.objects.deleted().filter(deleted_at__lt=cutoff).delete()
        count = result[0]
        self.stdout.write(self.style.SUCCESS(f"Successfully cleaned up {count} expired tasks"))
