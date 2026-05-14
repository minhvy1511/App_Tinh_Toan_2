ABLATION_TABLES = {
    "SMILE Pro": {1: 39, 2: 55, 3: 75, 4: 84, 5: 99, 6: 112, 7: 126, 8: 139, 9: 152, 10: 167, 11: 180},
    "SmartSight": {1: 26, 2: 50, 3: 63, 4: 76, 5: 89, 6: 101, 7: 113, 8: 125, 9: 137, 10: 148, 11: 159, 12: 170},
    "Femto-LASIK": {1: 16, 2: 32, 3: 48, 4: 63, 5: 79, 6: 94, 7: 109, 8: 124, 9: 139, 10: 154, 11: 166, 12: 178},
    "SmartSurface": {1: 71, 2: 86, 3: 100, 4: 115, 5: 130, 6: 145, 7: 159, 8: 174},
}


def _number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def interp_ablation(proc, d):
    table = ABLATION_TABLES.get(proc, {})
    if not table or d <= 0:
        return 0
    lo = int(d)
    hi = lo + 1
    v_lo = table.get(lo, 0)
    v_hi = table.get(hi, table.get(lo, 0))
    return v_lo + (v_hi - v_lo) * (d - lo)


def get_oz_factor(oz):
    factors = {"6.8": 1.087, "6.2": 1 / 1.081, "6.5": 1.0}
    return factors.get(str(oz), 1.0)


def suggested_target(patient_age, is_dominant):
    return -1.0 if patient_age >= 40 and not is_dominant else 0.0


def calculate_eye(payload):
    thin = _number(payload.get("thin"), 510)
    cct = _number(payload.get("cct"), 520)
    k1 = _number(payload.get("k1"), 43)
    k2 = _number(payload.get("k2"), 44)
    pupil = _number(payload.get("pupil"), 6)
    ls_sph = _number(payload.get("ls_sph"), -5)
    ls_cyl = _number(payload.get("ls_cyl"), -1)
    ls_targ = _number(payload.get("ls_targ"), 0)
    proc = payload.get("proc") or "SMILE Pro"
    flap = _number(payload.get("flap"), 120)
    oz = str(payload.get("oz") or "6.5")
    mf_va = str(payload.get("mf_va") or "20/20").strip()

    km = (k1 + k2) / 2
    final_laser_sph = ls_sph - ls_targ
    total_d = abs(final_laser_sph) + abs(ls_cyl)
    base_abl = interp_ablation(proc, total_d)
    final_abl = round(base_abl * get_oz_factor(oz))
    eff_flap = 0 if proc == "SmartSurface" else flap
    rsb = round(thin - eff_flap - final_abl)
    total_consumption = eff_flap + final_abl
    pta = round((total_consumption / cct) * 100, 1) if cct > 0 else 0
    post_k = round(km - (0.8 * total_d), 2)

    warnings = []
    if pta < 38:
        warnings.append({"level": "success", "message": f"PTA an toàn ({pta}%)."})
    elif 38 <= pta <= 43:
        warnings.append({"level": "warning", "message": f"PTA cảnh báo ({pta}%): lưu ý kiểm tra Corvis ST hoặc bổ sung Crosslinking."})
    else:
        warnings.append({"level": "danger", "message": f"PTA mức nguy cơ cao ({pta}%): cân nhắc phương pháp Phakic ICL."})

    if rsb < 280:
        warnings.append({"level": "warning", "message": f"RSB mỏng ({rsb} um): cân nhắc giảm Cap/OZ hoặc chuyển Phakic ICL."})
    if post_k <= 34:
        warnings.append({"level": "warning", "message": f"Post-op K bất thường ({post_k} D): cần tư vấn kỹ trước mổ."})
    if pupil > _number(oz):
        warnings.append({"level": "warning", "message": f"Đồng tử ({pupil} mm) lớn hơn vùng điều trị OZ ({oz} mm): nguy cơ lóa/halo ban đêm."})
    if (cct - thin) > 15:
        warnings.append({"level": "danger", "message": f"CCT ({cct} um) chênh lệch Thinnest ({thin} um) trên 15 um: cần đánh giá kỹ nguy cơ giác mạc."})
    if mf_va != "20/20":
        warnings.append({"level": "warning", "message": f"Thị lực thử kính VA = {mf_va}, không đạt tối đa 20/20."})

    if ls_targ > 0:
        target_note = "Mục tiêu viễn thị - cộng thêm vào laser điều trị."
    elif ls_targ < 0:
        target_note = "Thị lực nhìn gần / Monovision - trừ bớt laser điều trị."
    else:
        target_note = "Thị lực nhìn xa tối đa."

    return {
        "final_laser_sph": round(final_laser_sph, 2),
        "total_d": round(total_d, 2),
        "ablation_depth": final_abl,
        "rsb": rsb,
        "pta": pta,
        "post_k": post_k,
        "target_note": target_note,
        "warnings": warnings,
    }


def calculate_plan(payload):
    current_year = int(payload.get("current_year") or 2026)
    yob = int(_number(payload.get("patient", {}).get("yob"), 1981))
    dominant_eye = payload.get("patient", {}).get("dominant_eye") or "OD"
    patient_age = current_year - yob

    eyes = {}
    for side in ("od", "os"):
        data = dict(payload.get(side) or {})
        data.setdefault("ls_targ", suggested_target(patient_age, dominant_eye.lower() == side))
        eyes[side] = calculate_eye(data)

    return {"patient_age": patient_age, "eyes": eyes}
