import json
import os
from datetime import datetime

from flask import Flask, jsonify, render_template, request

from calculations import ABLATION_TABLES, calculate_eye, calculate_phakic_eye, calculate_plan, suggested_target


app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
PLANS_FILE = os.path.join(INSTANCE_DIR, "plans.json")


def _ensure_storage():
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    if not os.path.exists(PLANS_FILE):
        with open(PLANS_FILE, "w", encoding="utf-8") as file:
            json.dump([], file)


def _read_plans():
    _ensure_storage()
    try:
        with open(PLANS_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _write_plans(plans):
    _ensure_storage()
    with open(PLANS_FILE, "w", encoding="utf-8") as file:
        json.dump(plans, file, ensure_ascii=False, indent=2)


def _plan_record(plan_id, payload, result, notes=""):
    patient = payload.get("patient", {})
    return {
        "id": plan_id,
        "patient_name": patient.get("name") or "Chua nhap",
        "patient_id": patient.get("id") or "",
        "surgeon": patient.get("surgeon") or "",
        "payload": payload,
        "result": result,
        "notes": notes or "",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }


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


@app.post("/api/calculate-phakic")
def calculate_phakic():
    payload = request.get_json(silent=True) or {}
    results = {}
    errors = {}

    for side in ("od", "os"):
        eye_payload = payload.get(side)
        if not eye_payload:
            continue
        try:
            results[side] = calculate_phakic_eye(eye_payload)
        except ValueError as exc:
            errors[side] = str(exc)

    if errors:
        return jsonify({"errors": errors, "results": results}), 400
    if not results:
        return jsonify({"error": "Missing od/os payload."}), 400
    return jsonify({"results": results})


@app.post("/api/target")
def target():
    payload = request.get_json(silent=True) or {}
    age = int(payload.get("age") or 0)
    is_dominant = bool(payload.get("is_dominant"))
    return jsonify({"target": suggested_target(age, is_dominant)})


@app.get("/api/plans")
def plans():
    records = sorted(_read_plans(), key=lambda item: item.get("created_at", ""), reverse=True)
    return jsonify(records)


@app.post("/api/plans")
def create_plan():
    payload = request.get_json(silent=True) or {}
    result = calculate_plan(payload)
    records = _read_plans()
    next_id = max([int(item.get("id") or 0) for item in records] or [0]) + 1
    record = _plan_record(next_id, payload, result, payload.get("notes") or "")
    records.append(record)
    _write_plans(records)
    return jsonify(record), 201


@app.put("/api/plans/<int:plan_id>")
def revise_plan(plan_id):
    payload = request.get_json(silent=True) or {}
    result = calculate_plan(payload)
    records = _read_plans()
    for index, record in enumerate(records):
        if int(record.get("id") or 0) == plan_id:
            updated = _plan_record(plan_id, payload, result, payload.get("notes") or "")
            updated["created_at"] = record.get("created_at") or updated["created_at"]
            records[index] = updated
            _write_plans(records)
            return jsonify(updated)
    return jsonify({"error": "Plan not found"}), 404


@app.delete("/api/plans/<int:plan_id>")
def remove_plan(plan_id):
    records = _read_plans()
    kept = [record for record in records if int(record.get("id") or 0) != plan_id]
    if len(kept) == len(records):
        return jsonify({"error": "Plan not found"}), 404
    _write_plans(kept)
    return "", 204


if __name__ == "__main__":
    app.run(debug=True)
