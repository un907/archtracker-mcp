from db import get_connection

router = []

def get_data():
    conn = get_connection()
    return conn.execute("SELECT * FROM data")
