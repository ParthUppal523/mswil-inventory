from fastapi import FastAPI

app = FastAPI(title="MSWIL Inventory System API")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Motherson Sumi Wiring India Ltd. Inventory System API"
    }
