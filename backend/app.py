from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://localhost:5174"
            ]
        }
    }
)


@app.get("/api/health")
def health_check():
    return jsonify({
        "status": "ok",
        "message": "Booking System API is running"
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)