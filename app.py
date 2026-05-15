from flask import Flask, jsonify, render_template, request

from calculations import ABLATION_TABLES, calculate_eye, calculate_plan, suggested_target
from database import delete_plan, init_db, list_plans, save_plan, update_plan


app = Flask(__name__)
init_db()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/config")
def config():
    return jsonify({"procedures": list(ABLATION_TABLES.keys()), "optical_zones": ["6.2", "6.5", "6.8"]})


@app.post("/api/calculate/quick")
def quick_calculate():
    return jsonify(calculate_eye(request.get_json(silent=True) or {}))


@app.post("/api/calculate/plan")
def plan_calculate():
    return jsonify(calculate_plan(request.get_json(silent=True) or {}))


@app.post("/api/target")
def target():
    payload = request.get_json(silent=True) or {}
    age = int(payload.get("age") or 0)
    is_dominant = bool(payload.get("is_dominant"))
    return jsonify({"target": suggested_target(age, is_dominant)})


@app.get("/api/plans")
def plans():
    return jsonify(list_plans())


@app.post("/api/plans")
def create_plan():
    payload = request.get_json(silent=True) or {}
    result = calculate_plan(payload)
    record = save_plan(payload, result, payload.get("notes") or "")
    return jsonify(record), 201


@app.put("/api/plans/<int:plan_id>")
def revise_plan(plan_id):
    payload = request.get_json(silent=True) or {}
    result = calculate_plan(payload)
    record = update_plan(plan_id, payload, result, payload.get("notes") or "")
    if not record:
        return jsonify({"error": "Plan not found"}), 404
    return jsonify(record)


@app.delete("/api/plans/<int:plan_id>")
def remove_plan(plan_id):
    if not delete_plan(plan_id):
        return jsonify({"error": "Plan not found"}), 404
    return "", 204


if __name__ == "__main__":
    app.run(debug=True)
