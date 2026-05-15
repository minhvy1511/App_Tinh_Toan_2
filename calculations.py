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
                "od": {"procedure": "Phakic IOL", "warnings": []},
                "os": {"procedure": "Phakic IOL", "warnings": []},
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


ICL_SIZES = (12.1, 12.6, 13.2, 13.7)


def _nearest_icl_size(value):
    """Round a continuous sizing estimate to the nearest available STAAR ICL size."""
    return min(ICL_SIZES, key=lambda size: abs(size - value))


def _round_to_half_diopter(value):
    return round(value * 2) / 2


def predict_vault(selected_size, ata):
    """Predict approximate postoperative ICL vault from selected size and ATA.

    Args:
        selected_size: Chosen STAAR ICL overall diameter in mm.
        ata: Angle-to-angle diameter measured by AS-OCT in mm.

    Returns:
        dict with predicted_vault_um and vault_warning. Returns None values when
        ATA is not provided.
    """
    selected_size = _number(selected_size, None)
    ata = _number(ata, None) if ata not in (None, "") else None
    if selected_size is None or ata is None:
        return {"predicted_vault_um": None, "vault_warning": None, "vault_level": "none"}
    if selected_size <= 0 or ata <= 0:
        raise ValueError("Selected size and ATA must be positive numbers.")

    vault = round((selected_size - ata) * 500)
    if vault < 250:
        return {
            "predicted_vault_um": vault,
            "vault_warning": "Nguy cơ Low Vault: vault dự kiến < 250 um.",
            "vault_level": "warning",
        }
    if vault > 750:
        return {
            "predicted_vault_um": vault,
            "vault_warning": "Nguy cơ High Vault: vault dự kiến > 750 um.",
            "vault_level": "danger",
        }
    return {"predicted_vault_um": vault, "vault_warning": None, "vault_level": "success"}


def calculate_icl_sizing(wtw, acd, ata=None):
    """Estimate EVO ICL overall diameter from WTW/ACD and optional ATA.

    This is a clinical-support simulation, not the official STAAR OCOS algorithm.

    Args:
        wtw: Horizontal white-to-white corneal diameter in mm.
        acd: True anterior chamber depth in mm.
        ata: Optional angle-to-angle diameter in mm from AS-OCT. When present,
            an ATA-based recommendation is calculated as ATA + 0.7 mm and rounded
            to the nearest available STAAR size.

    Returns:
        dict with recommended_size, base_size_by_wtw_acd, ata_size, predicted
        vault, and warnings.
    """
    wtw = _number(wtw, None)
    acd = _number(acd, None)
    ata_value = _number(ata, None) if ata not in (None, "") else None
    warnings = []

    if wtw is None or acd is None:
        raise ValueError("WTW and ACD are required for ICL sizing.")
    if wtw <= 0 or acd <= 0:
        raise ValueError("WTW and ACD must be positive numbers.")

    # Base OCOS-like estimate: four fixed STAAR overall diameters.
    if wtw < 11.5:
        base_size = 12.1
    elif wtw < 12.0:
        base_size = 12.6
    elif wtw < 12.5:
        base_size = 13.2
    else:
        base_size = 13.7

    # Shallow chambers tend to be less tolerant of high vault; deep chambers may
    # tolerate upsizing. Keep the adjustment conservative: one size step only.
    if acd < 2.8:
        warnings.append("ACD < 2.8 mm: ngoài ngưỡng an toàn thường dùng cho EVO ICL, cần đánh giá chỉ định.")
    if acd < 3.0 and base_size > 12.1:
        base_size = ICL_SIZES[ICL_SIZES.index(base_size) - 1]
        warnings.append("ACD nông: đã hạ 1 size trong mô phỏng để giảm nguy cơ High Vault/góc hẹp.")
    elif acd > 3.5 and base_size < 13.7:
        base_size = ICL_SIZES[ICL_SIZES.index(base_size) + 1]
        warnings.append("ACD sâu: đã tăng 1 size trong mô phỏng để hạn chế nguy cơ Low Vault.")

    ata_size = None
    ata_ideal_size = None
    if ata_value is not None:
        if ata_value <= 0:
            raise ValueError("ATA must be a positive number when provided.")
        ata_ideal_size = round(ata_value + 0.7, 2)
        ata_size = _nearest_icl_size(ata_ideal_size)

        size_gap = round(ata_size - base_size, 1)
        if abs(size_gap) >= 0.6:
            if size_gap > 0:
                warnings.append(
                    "ATA gợi ý size lớn hơn WTW/ACD: nếu chọn theo WTW có nguy cơ Low Vault."
                )
            else:
                warnings.append(
                    "ATA gợi ý size nhỏ hơn WTW/ACD: nếu chọn theo WTW có nguy cơ High Vault."
                )

    recommended_size = ata_size if ata_size is not None else base_size
    vault_result = predict_vault(recommended_size, ata_value)
    if vault_result["vault_warning"]:
        warnings.append(vault_result["vault_warning"])

    return {
        "recommended_size": recommended_size,
        "base_size_by_wtw_acd": base_size,
        "ata_size": ata_size,
        "ata_ideal_size": ata_ideal_size,
        "predicted_vault_um": vault_result["predicted_vault_um"],
        "vault_warning": vault_result["vault_warning"],
        "vault_level": vault_result["vault_level"],
        "warnings": warnings,
    }


def calculate_icl_size(wtw, acd, ata=None):
    """Backward-compatible alias for older route code."""
    return calculate_icl_sizing(wtw, acd, ata)


def calculate_icl_power(p_pre, k1, k2, acd, vertex_mm=12.0):
    """Estimate ICL spherical power using a simplified vergence model.

    Args:
        p_pre: Spectacle-plane refraction in diopters, usually spherical
            equivalent from maximum spectacle refraction.
        k1, k2: Keratometry values in diopters.
        acd: Anterior chamber depth in mm, used as a simplified effective lens
            plane distance in aqueous.
        vertex_mm: Spectacle vertex distance in mm, typically 12.0 or 12.5.

    Returns:
        dict with calculated_power and intermediate values.
    """
    p_pre = _number(p_pre, None)
    k1 = _number(k1, None)
    k2 = _number(k2, None)
    acd = _number(acd, None)
    vertex_mm = _number(vertex_mm, 12.0)
    if p_pre is None or k1 is None or k2 is None or acd is None:
        raise ValueError("p_pre, k1, k2, and ACD are required for ICL power calculation.")
    if vertex_mm <= 0:
        raise ValueError("Vertex distance must be a positive number.")

    vertex_distance_m = vertex_mm / 1000
    n_v = 1.336
    p_corneal_plane = p_pre / (1 - vertex_distance_m * p_pre)
    p_cornea = (k1 + k2) / 2

    # Simplified thick-lens vergence approximation. The ACD is converted to an
    # aqueous optical distance. This keeps the model stable for clinical UI use.
    effective_lens_distance_m = (acd / 1000) / n_v
    p_icl_raw = p_corneal_plane / (1 - effective_lens_distance_m * p_corneal_plane)
    p_icl = _round_to_half_diopter(p_icl_raw)

    return {
        "calculated_power": p_icl,
        "raw_power": round(p_icl_raw, 2),
        "spectacle_plane_power": round(p_pre, 2),
        "corneal_plane_power": round(p_corneal_plane, 2),
        "mean_corneal_power": round(p_cornea, 2),
        "vertex_distance_mm": vertex_mm,
        "aqueous_refractive_index": n_v,
    }


def calculate_phakic_eye(payload):
    """Calculate ICL sizing and power for one eye payload from the Phakic form."""
    size_result = calculate_icl_sizing(
        payload.get("wtw"),
        payload.get("acd"),
        payload.get("ata", payload.get("sts")),
    )
    max_sph = _number(payload.get("max_sph", payload.get("p_pre", payload.get("icl_sph", payload.get("sph")))), None)
    max_cyl = _number(payload.get("max_cyl", payload.get("icl_cyl", 0)), 0)
    if max_sph is None:
        p_pre = None
    else:
        # Use spherical equivalent from maximum spectacle refraction for the
        # simplified ICL spherical power estimate. Toric planning can still use
        # max_cyl/max_axis separately on the clinical UI.
        p_pre = max_sph + (max_cyl / 2)
    target_axis = _number(payload.get("max_axis"), None)
    calculated_cyl_power = _round_to_half_diopter(max_cyl) if max_cyl is not None else 0
    power_result = calculate_icl_power(
        p_pre,
        payload.get("k1"),
        payload.get("k2"),
        payload.get("acd"),
        payload.get("vertex", 12.0),
    )

    angle = _number(payload.get("angle"), None)
    aqd = _number(payload.get("aqd"), None)
    warnings = list(size_result["warnings"])
    if angle is not None and angle < 30:
        warnings.append("Góc tiền phòng < 30 độ: cần đánh giá nguy cơ đóng góc trước khi đặt Phakic ICL.")
    if aqd is not None and aqd < 2.8:
        warnings.append("AqD < 2.8 mm: cần kiểm tra lại an toàn khoảng cách nội nhãn.")

    return {
        "recommended_size": size_result["recommended_size"],
        "base_size_by_wtw_acd": size_result["base_size_by_wtw_acd"],
        "ata_size": size_result["ata_size"],
        "ata_ideal_size": size_result["ata_ideal_size"],
        "predicted_vault_um": size_result["predicted_vault_um"],
        "vault_warning": size_result["vault_warning"],
        "vault_level": size_result["vault_level"],
        "calculated_power": power_result["calculated_power"],
        "calculated_cyl_power": calculated_cyl_power,
        "target_axis": target_axis,
        "max_refraction": {
            "sph": max_sph,
            "cyl": max_cyl,
            "axis": target_axis,
            "va": payload.get("max_va"),
            "vertex": power_result["vertex_distance_mm"],
            "spherical_equivalent": round(p_pre, 2) if p_pre is not None else None,
        },
        "power_detail": power_result,
        "vault_warnings": warnings,
    }
