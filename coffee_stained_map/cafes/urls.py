from rest_framework.routers import DefaultRouter
from .views import CafeViewSet

router = DefaultRouter()
router.register(r'cafes', CafeViewSet)

urlpatterns = router.urls
