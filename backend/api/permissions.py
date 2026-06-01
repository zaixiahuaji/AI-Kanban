from rest_framework.permissions import BasePermission


class IsOwnerOrAdmin(BasePermission):
    """
    普通用户只能操作自己的数据，
    管理员可以操作所有数据。
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return getattr(obj, "user", None) == request.user
