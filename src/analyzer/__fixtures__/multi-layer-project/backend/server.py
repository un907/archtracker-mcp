from routes import router
from db import get_connection

app = create_app()
app.include_router(router)
