from .models import ErrorLog


class ErrorCaptureMiddleware:
    """捕获 500+ 状态码的响应，写入 ErrorLog 表"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if response.status_code >= 500:
            try:
                user = request.user if request.user.is_authenticated else None
                message = ""
                if hasattr(response, "content"):
                    try:
                        message = response.content.decode("utf-8")[:1000]
                    except Exception:
                        pass
                ErrorLog.objects.create(
                    method=request.method,
                    path=request.get_full_path()[:500],
                    status_code=response.status_code,
                    message=message,
                    user=user,
                )
            except Exception:
                pass  # 日志错误不应影响正常响应

        return response
