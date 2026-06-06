from django.contrib import admin
from django.urls import include, path
from django.views.i18n import set_language
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .admin_views import (
    AdminStatsView,
    AdminStatsTrendView,
    AdminTaskDetailView,
    AdminTaskListView,
    AdminUserDetailView,
    AdminUserListView,
    HealthCheckView,
)
from .api import BoardColumnViewSet, SendCodeView, StatisticsView, TagViewSet, TaskViewSet, UserViewSet

router = routers.DefaultRouter()
router.register("users", UserViewSet, basename="api-users")
router.register("columns", BoardColumnViewSet, basename="api-columns")
router.register("tags", TagViewSet, basename="api-tags")
router.register("tasks", TaskViewSet, basename="api-tasks")

urlpatterns = [
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
    ),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/email/send-code/", SendCodeView.as_view(), name="send-code"),
    path("api/statistics/", StatisticsView.as_view(), name="api-statistics"),
    # 管理端 API
    path("api/admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("api/admin/stats/trend/", AdminStatsTrendView.as_view(), name="admin-stats-trend"),
    path("api/admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("api/admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("api/admin/tasks/", AdminTaskListView.as_view(), name="admin-tasks"),
    path("api/admin/tasks/<uuid:pk>/", AdminTaskDetailView.as_view(), name="admin-task-detail"),
    path("api/admin/health/", HealthCheckView.as_view(), name="admin-health"),
    path("api/", include(router.urls)),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("admin/", admin.site.urls),
    path("i18n/setlang/", set_language, name="set_language"),
]
