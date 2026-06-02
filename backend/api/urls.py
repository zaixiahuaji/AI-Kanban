from django.contrib import admin
from django.urls import include, path
from django.views.i18n import set_language
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .api import SendCodeView, TagViewSet, TaskViewSet, UserViewSet

router = routers.DefaultRouter()
router.register("users", UserViewSet, basename="api-users")
router.register("tags", TagViewSet, basename="api-tags")
router.register("tasks", TaskViewSet, basename="api-tasks")

urlpatterns = [
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
    ),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/email/send-code/", SendCodeView.as_view(), name="send-code"),
    path("api/", include(router.urls)),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("admin/", admin.site.urls),
    path("i18n/setlang/", set_language, name="set_language"),
]
