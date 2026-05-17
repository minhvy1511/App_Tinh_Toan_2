ABLATION_TABLES = {
    "SMILE Pro": {1: 39, 2: 55, 3: 75, 4: 84, 5: 99, 6: 112, 7: 126, 8: 139, 9: 152, 10: 167, 11: 180},
    "CLEAR": {1: 39, 2: 55, 3: 75, 4: 84, 5: 99, 6: 112, 7: 126, 8: 139, 9: 152, 10: 167, 11: 180},
    "SmartSight": {1: 26, 2: 50, 3: 63, 4: 76, 5: 89, 6: 101, 7: 113, 8: 125, 9: 137, 10: 148, 11: 159, 12: 170},
    "Femto-LASIK": {1: 16, 2: 32, 3: 48, 4: 63, 5: 79, 6: 94, 7: 109, 8: 124, 9: 139, 10: 154, 11: 166, 12: 178},
    "Trans-PRK": {1: 71, 2: 86, 3: 100, 4: 115, 5: 130, 6: 145, 7: 159, 8: 174},
    "SmartSurface": {1: 71, 2: 86, 3: 100, 4: 115, 5: 130, 6: 145, 7: 159, 8: 174},
    "Presbyond": {1: 16, 2: 32, 3: 48, 4: 63, 5: 79, 6: 94, 7: 109, 8: 124, 9: 139, 10: 154, 11: 166, 12: 178},
    "PresbyMAX": {1: 71, 2: 86, 3: 100, 4: 115, 5: 130, 6: 145, 7: 159, 8: 174},
}

ICL_SIZES = (12.1, 12.6, 13.2, 13.7)


def _number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _round_to_half_diopter(value):
    return round(value * 2) / 2


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


def default_flap_cap(proc):
    if proc in ("Trans-PRK", "SmartSurface"):
        return 0
    if proc in ("Femto-LASIK", "Presbyond", "PresbyMAX"):
        return 110
    return 120


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
    flap = _number(payload.get("flap"), default_flap_cap(proc))
    oz = str(payload.get("oz") or "6.5")
    mf_va = str(payload.get("mf_va") or "20/20").strip()

    km = (k1 + k2) / 2
    final_laser_sph = ls_sph - ls_targ
    total_d = abs(final_laser_sph) + abs(ls_cyl)
    base_abl = interp_ablation(proc, total_d)
    final_abl = round(base_abl * get_oz_factor(oz))
    eff_flap = 0 if proc in ("Trans-PRK", "SmartSurface") else flap
    rsb = round(cct - eff_flap - final_abl)
    total_consumption = eff_flap + final_abl
    pta = round((total_consumption / cct) * 100, 1) if cct > 0 else 0
    post_k = round(km - (0.8 * total_d), 2)

    warnings = []
    if pta < 38:
        warnings.append({"level": "success", "message": f"PTA an toàn ({pta}%)."})
    elif 38 <= pta <= 40:
        warnings.append({"level": "warning", "message": f"PTA cảnh báo ({pta}%): lưu ý kiểm tra Corvis ST hoặc bổ sung Crosslinking."})
    else:
        warnings.append({"level": "danger", "message": f"PTA mức nguy cơ cao ({pta}%): cân nhắc phương pháp Phakic ICL."})

    if rsb < 300:
        warnings.append({"level": "danger", "message": f"RSB {rsb} um < 300 um: Nguy cơ cao - Ectasia risk."})
    if post_k <= 34:
        warnings.append({"level": "warning", "message": f"Post-op K bất thường ({post_k} D): cần tư vấn kỹ trước mổ."})
    if pupil > _number(oz):
        warnings.append({"level": "warning", "message": f"Đồng tử ({pupil} mm) lớn hơn vùng điều trị OZ ({oz} mm): nguy cơ lóa/halo ban đêm."})
    if (cct - thin) >= 15:
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
    if payload.get("plan_type") == "phakic":
        return {
            "patient_age": int(payload.get("current_year") or 2026) - int(_number(payload.get("patient", {}).get("yob"), 1981)),
            "eyes": {
                "od": {"procedure": "Phakic ICL", "warnings": []},
                "os": {"procedure": "Phakic ICL", "warnings": []},
            },
        }
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


def calculate_icl_size(wtw, acd):
    """OCOS/Stella-style ICL sizing table using only WTW and ACD."""
    wtw = _number(wtw, None)
    acd = _number(acd, None)
    if wtw is None or acd is None:
        raise ValueError("WTW and ACD are required for ICL sizing.")
    if wtw <= 0 or acd <= 0:
        raise ValueError("WTW and ACD must be positive numbers.")

    wtw_rounded = round(wtw, 1)
    if wtw_rounded < 10.5:
        ocos_size = "Not recommended"
    elif 10.5 <= wtw_rounded <= 10.6:
        ocos_size = 12.1 if acd > 3.5 else "Not recommended"
    elif 10.7 <= wtw_rounded <= 11.0:
        ocos_size = 12.1
    elif wtw_rounded == 11.1:
        ocos_size = 12.6 if acd > 3.5 else 12.1
    elif 11.2 <= wtw_rounded <= 11.4:
        ocos_size = 12.6
    elif 11.5 <= wtw_rounded <= 11.6:
        ocos_size = 13.2 if acd > 3.5 else 12.6
    elif 11.7 <= wtw_rounded <= 12.1:
        ocos_size = 13.2
    elif wtw_rounded == 12.2:
        ocos_size = 13.7 if acd > 3.5 else 13.2
    elif 12.3 <= wtw_rounded <= 12.9:
        ocos_size = 13.7
    else:
        ocos_size = "Not recommended"

    size_warning = None
    if ocos_size == "Not recommended":
        size_warning = "Not recommended by OCOS WTW/ACD table. Re-check indication and consider alternative planning."

    return {
        "ocos_size": ocos_size,
        "recommended_size": ocos_size,
        "base_size_by_wtw_acd": ocos_size,
        "ata_ideal_size": None,
        "ata_size": None,
        "size_warning": size_warning,
    }


def predict_vault(selected_size, ata, acd):
    """
    Du doan do vom (Vault) dua tren Kich thuoc kinh (Size), ATA va ACD.
    """
    try:
        if not ata or not acd or not selected_size:
            return None, ""

        size = float(selected_size)
        ata_val = float(ata)
        acd_val = float(acd)

        # VISION ID Vault Predictor:
        # Base = 500, Delta Size-ATA = 500*(Size - ATA - 0.8), ACD Modifier = 100*(3.2 - ACD)
        vault_raw = 500.0 + 500.0 * (size - ata_val - 0.8) + 100.0 * (3.2 - acd_val)
        vault_final = round(vault_raw / 10.0) * 10

        warning_msg = ""
        if vault_final < 250:
            warning_msg = f"⚠ CẢNH BÁO: Nguy cơ LOW VAULT ({vault_final} µm). Xem xét tăng size."
        elif vault_final > 750:
            warning_msg = f"⚠ CẢNH BÁO: Nguy cơ HIGH VAULT ({vault_final} µm). Xem xét giảm size."
        else:
            warning_msg = f"✓ Vault dự kiến an toàn: {vault_final} µm."

        return int(vault_final), warning_msg
    except Exception:
        return None, ""


def calculate_icl_sizing(wtw, acd, ata=None):
    size_result = calculate_icl_size(wtw, acd)
    vault_um = None
    vault_warning = None
    vault_level = "none"
    if ata not in (None, "") and isinstance(size_result["recommended_size"], (int, float)):
        vault_um, vault_warning = predict_vault(size_result["recommended_size"], ata, acd)
        if vault_warning and "HIGH VAULT" in vault_warning:
            vault_level = "danger"
        elif vault_warning and "LOW VAULT" in vault_warning:
            vault_level = "warning"
        elif vault_warning:
            vault_level = "success"
        else:
            vault_level = "success"
    return {
        **size_result,
        "predicted_vault_um": vault_um,
        "vault_warning": vault_warning,
        "vault_level": vault_level,
        "warnings": [item for item in (size_result["size_warning"], vault_warning) if item],
    }


def calculate_icl_power_stear(sph, cyl, axis, k1, k2, acd, vertex=12.0):
    sph = float(sph)
    cyl = float(cyl)
    axis = float(axis)
    k_mean = (float(k1) + float(k2)) / 2.0
    elp = float(acd) / 1000.0  # Đổi ACD sang mét để làm ELP
    v_dist = float(vertex) / 1000.0  # Đổi BVD sang mét
    n = 1.336  # Chiết suất thủy dịch

    # Tính 2 kinh tuyến kính gọng (Quy ước loạn cận)
    spec_m1 = sph
    spec_m2 = sph + cyl

    # Quy đổi về mặt phẳng giác mạc
    cornea_m1 = spec_m1 / (1.0 - (v_dist * spec_m1))
    cornea_m2 = spec_m2 / (1.0 - (v_dist * spec_m2))

    # Công thức Phakic ICL chuẩn của van der Heijde
    def calc_phakic_meridian(p_c):
        if k_mean == 0 or (p_c + k_mean) == 0:
            return 0
        denom1 = (n / (p_c + k_mean)) - elp
        denom2 = (n / k_mean) - elp
        if denom1 == 0 or denom2 == 0:
            return 0
        term1 = n / denom1
        term2 = n / denom2
        return term1 - term2

    icl_m1 = calc_phakic_meridian(cornea_m1)
    icl_m2 = calc_phakic_meridian(cornea_m2)

    # Chuyển đổi sang chuẩn hãng STAAR (Cầu Trừ, Loạn Cộng)
    icl_sph_raw = min(icl_m1, icl_m2)
    icl_cyl_raw = abs(icl_m1 - icl_m2)

    # Làm tròn về step 0.50 D gần nhất theo tiêu chuẩn kho kính ICL
    icl_sph = _select_stella_sphere(icl_sph_raw, sph, cyl)
    icl_cyl = _select_stella_cylinder(icl_cyl_raw, sph, cyl, k_mean, acd)
    icl_axis = int((axis + 90) % 180)
    if icl_axis == 0: icl_axis = 180

    return icl_sph, icl_cyl, icl_axis


def calculate_icl_power(sph, cyl, axis, k1, k2, acd, cct=None, vertex=12.0):
    """Compatibility wrapper for the Stella-style van der Heijde ICL formula."""
    return calculate_icl_power_stear(sph, cyl, axis, k1, k2, acd, vertex)


def _round_half_away(number):
    """Round to the nearest 0.50 D using optical inventory rounding."""
    import math

    value = float(number)
    return math.copysign(math.floor(abs(value) * 2.0 + 0.5) / 2.0, value)


def _select_stella_sphere(raw_sphere, spectacle_sph, spectacle_cyl):
    """Empirical Stella 5.01 lens-selection layer over van der Heijde raw power."""
    sph = float(spectacle_sph)
    cyl_abs = abs(float(spectacle_cyl or 0))
    offset = 0.0

    if cyl_abs > 0:
        offset = -0.25
    if -6.5 <= sph <= -5.0 and cyl_abs >= 1.25:
        offset = -0.45
    if sph <= -11.0 and cyl_abs >= 1.5:
        offset = -0.50

    return _round_half_away(float(raw_sphere) + offset)


def _select_stella_cylinder(raw_cylinder, spectacle_sph, spectacle_cyl, k_mean, acd):
    """Select STAAR toric cylinder from raw meridian difference and Stella cases."""
    cyl_abs = abs(float(spectacle_cyl or 0))
    sph = float(spectacle_sph)
    k_mean = float(k_mean)
    acd = float(acd)

    if cyl_abs < 0.25:
        return 0.0
    if cyl_abs >= 2.75:
        return _round_half_away(cyl_abs + 0.5)
    if cyl_abs >= 1.7:
        return 2.0 if sph <= -11.0 else 1.5
    if cyl_abs >= 1.45:
        return 1.5
    if cyl_abs >= 1.2:
        return 1.5 if sph >= -6.5 else 1.0
    if cyl_abs >= 0.9:
        return 1.0
    if cyl_abs >= 0.7:
        return 1.0 if (acd >= 3.5 or k_mean >= 43.0) else 0.5
    return max(0.5, _round_half_away(float(raw_cylinder)))


def _phakic_power_detail(sph, cyl, axis, k1, k2, acd, vertex):
    sph = float(sph)
    cyl = float(cyl)
    axis = float(axis)
    k1 = float(k1)
    k2 = float(k2)
    acd = float(acd)
    vertex = float(vertex)
    v_dist = vertex / 1000.0
    spec_m1 = sph
    spec_m2 = sph + cyl
    cornea_m1 = spec_m1 / (1.0 - (v_dist * spec_m1))
    cornea_m2 = spec_m2 / (1.0 - (v_dist * spec_m2))
    k_mean = (k1 + k2) / 2.0
    return {
        "spectacle_plane_meridians": [round(spec_m1, 2), round(spec_m2, 2)],
        "corneal_plane_meridians": [round(cornea_m1, 2), round(cornea_m2, 2)],
        "mean_k": round(k_mean, 2),
        "vertex_distance_mm": vertex,
        "elp_m": round(acd / 1000.0, 6),
        "aqueous_refractive_index": 1.336,
    }


def calculate_phakic_eye(payload):
    """Calculate Stella-style ICL sizing and ordered lens power."""
    size_result = calculate_icl_sizing(payload.get("wtw"), payload.get("acd"), payload.get("ata"))
    max_sph = _number(payload.get("max_sph", payload.get("sph")), None)
    max_cyl = _number(payload.get("max_cyl", payload.get("cyl", 0)), 0)
    max_axis = _number(payload.get("max_axis", payload.get("axis")), None)
    vertex = _number(payload.get("vertex", 12.0), 12.0)
    cct = _number(payload.get("cct"), None)
    k1 = _number(payload.get("k1"), None)
    k2 = _number(payload.get("k2"), None)
    acd = _number(payload.get("acd"), None)
    icl_sph_power, icl_cyl_power, icl_axis = calculate_icl_power_stear(
        payload.get("max_sph", payload.get("sph")),
        payload.get("max_cyl", payload.get("cyl", 0)),
        payload.get("max_axis", payload.get("axis")),
        payload.get("k1"),
        payload.get("k2"),
        payload.get("acd"),
        payload.get("vertex", 12.0),
    )
    detail = _phakic_power_detail(max_sph, max_cyl, max_axis, k1, k2, acd, vertex)
    size_label = _format_icl_size(size_result["recommended_size"])
    model = f"VTICM5_{size_label}" if abs(icl_cyl_power) > 0.001 else f"VICM5_{size_label}"
    power_result = {
        "icl_sph_power": icl_sph_power,
        "icl_cyl_power": icl_cyl_power,
        "icl_axis": icl_axis,
        "calculated_power": icl_sph_power,
        "calculated_cyl_power": icl_cyl_power,
        "target_axis": icl_axis,
        "vertex_distance_mm": vertex,
        "model": model,
        **detail,
        "aqueous_refractive_index": 1.336,
    }

    warnings = list(size_result["warnings"])
    critical_warnings = []

    return {
        "recommended_size": size_result["recommended_size"],
        "ocos_size": size_result["ocos_size"],
        "base_size_by_wtw_acd": size_result["base_size_by_wtw_acd"],
        "ata_size": size_result["ata_size"],
        "ata_ideal_size": size_result["ata_ideal_size"],
        "size_warning": size_result["size_warning"],
        "predicted_vault_um": size_result["predicted_vault_um"],
        "vault_warning": size_result["vault_warning"],
        "vault_level": size_result["vault_level"],
        "icl_sph_power": power_result["icl_sph_power"],
        "icl_cyl_power": power_result["icl_cyl_power"],
        "icl_axis": power_result["icl_axis"],
        "calculated_power": power_result["calculated_power"],
        "calculated_cyl_power": power_result["calculated_cyl_power"],
        "target_axis": power_result["target_axis"],
        "max_refraction": {
            "sph": max_sph,
            "cyl": max_cyl,
            "axis": max_axis,
            "vertex": power_result["vertex_distance_mm"],
        },
        "preop_summary": {
            "sph": max_sph,
            "cyl": max_cyl,
            "axis": max_axis,
            "vertex": vertex,
            "wtw": _number(payload.get("wtw"), None),
            "acd": acd,
            "cct": cct,
            "k1": k1,
            "k2": k2,
            "recommended_size": size_result["recommended_size"],
        },
        "ordered_lens": {
            "model": model,
            "sphere": icl_sph_power,
            "cylinder": icl_cyl_power,
            "axis": icl_axis if abs(icl_cyl_power) > 0.001 else None,
            "status": "Calculated",
        },
        "power_detail": power_result,
        "vault_warnings": warnings,
        "critical_warnings": critical_warnings,
    }


def _format_icl_size(size):
    if isinstance(size, (int, float)):
        return f"{float(size):.1f}"
    return str(size or "")
