const DONGDO_LOGO_URL = "/static/creator.jpg";
const DONGDO_CREATOR_NAME = "VISION ID";
const DONGDO_CREATOR_TAGLINE = "ĐI ĐẦU CÔNG NGHỆ - ĐỊNH HƯỚNG TƯƠNG LAI";
const DONGDO_PROCEDURES = ["SMILE Pro", "CLEAR", "SmartSight", "Femto-LASIK", "Trans-PRK", "PRESBYOND", "PresbyMAX"];
const DONGDO_NAVY = "#0a3d6b";
const DONGDO_TEAL = "#2ab3b8";
const LS_PLANS = "visionid_plans";
const LS_SHEETS_URL = "visionid_sheets_url";
const SMILE_MIN_THICKNESS_DEFAULT = 15;
const SMILE_MIN_THICKNESS_MIN = 10;
const SMILE_MIN_THICKNESS_MAX = 35;
const TRANS_PRK_EPITHELIAL_DEFAULT = 55;
const TRANS_PRK_EPITHELIAL_MIN = 40;
const TRANS_PRK_EPITHELIAL_MAX = 70;
const TRANS_PRK_MAX_SAFE_DIOPTERS = 7.0;
const TRANS_PRK_TOTAL_TABLE_INCLUDES_EPI = 55;
const TRANS_PRK_TOTAL_ABLATION_TABLE = {1:71, 2:86, 3:100, 4:115, 5:130, 6:145, 7:159, 8:174};
const TRANS_PRK_STROMAL_ABLATION_TABLE = Object.fromEntries(
  Object.entries(TRANS_PRK_TOTAL_ABLATION_TABLE).map(([diopter, totalAblation]) => [
    Number(diopter),
    totalAblation - TRANS_PRK_TOTAL_TABLE_INCLUDES_EPI,
  ])
);
const SMILE_PHYSICAL_SPHERE_MIN = -15;
const SMILE_PHYSICAL_SPHERE_MAX = 8;
const SMILE_PHYSICAL_CYLINDER_LIMIT = 8;
const SMILE_MYOPIA_SPHERE_LIMIT = -10;
const SMILE_MYOPIA_CYLINDER_LIMIT = -5;
const SMILE_MYOPIA_SEQ_LIMIT = -10;
const SMILE_HYPEROPIA_SPHERE_LIMIT = 6;
const SMILE_HYPEROPIA_CYLINDER_LIMIT = 5;
const SMILE_HYPEROPIA_MMP_LIMIT = 7;
const SMILE_HYPEROPIA_TAPER_START = 3.5;
const PRESBYOND_TARGET_DEFAULT = -1.5;
const PRESBYOND_TARGET_MIN = -2.5;
const PRESBYOND_TARGET_MAX = 0;
const PRESBYOND_FLAP_DEFAULT = 120;
const OZ_BASE_MICRONS_PER_DIOPTER = 14;

const loadLS = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const saveLS = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const snellenToDecimal = (s) => {
  if (!s || !s.trim()) return null;
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  return parseFloat(m[1]) / parseFloat(m[2]);
};

const defaultEye = () => ({
  thinnest_point: "", cct: "", pupil_mesopic: "",
  k1: "", k2: "", wtw: "",
  corvis_status: "normal",
  hoa_rms: "",
  tbut: "",
  ocular_dominance: "Dominant",
  mf_sph: "", mf_cyl: "", mf_axis: "", mf_bcva: "",
  cy_sph: "", cy_cyl: "", cy_axis: "", cy_bcva: "",
  sph: "", cyl: "", axis: "", target_sph: "0", target_cyl: "0",
  procedure: "SmartSight", flap_cap: "", oz: "6.5", incision: "2.0", tz: "", min_thickness: String(SMILE_MIN_THICKNESS_DEFAULT), epithelial_thickness: String(TRANS_PRK_EPITHELIAL_DEFAULT),
});

function isTransPrkProcedure(procedure) {
  return procedure === "TransPRK" || procedure === "Trans-PRK";
}

function isPresbyondProcedure(procedure) {
  return String(procedure || "").toUpperCase() === "PRESBYOND";
}

function defaultFlapCap(procedure) {
  if (isTransPrkProcedure(procedure)) return 0;
  if (isPresbyondProcedure(procedure)) return PRESBYOND_FLAP_DEFAULT;
  if (procedure === "Femto-LASIK" || procedure === "PresbyMAX") return 110;
  return 120;
}

function ozAblationFactor(oz) {
  if (String(oz) === "6.8") return 1.087;
  if (String(oz) === "6.2") return 1 / 1.081;
  return 1.0;
}

function calcAblationDepth(procedure, finalLaserSph, cyl, oz) {
  const totalD = Math.abs(finalLaserSph) + Math.abs(cyl);
  const factor = ozAblationFactor(oz);

  if (isTransPrkProcedure(procedure)) {
    // Bảng SmartSurface/Trans-PRK gốc là Total Ablation đã gồm 55 um biểu mô.
    // Vì UI cho phép nhập Epithelial Thickness riêng, ở đây chỉ trả về phần nhu mô thuần.
    return Math.round(interpolateAblationTable(TRANS_PRK_STROMAL_ABLATION_TABLE, totalD) * factor);
  }

  const tableKey = isTransPrkProcedure(procedure) ? "TransPRK" : procedure;
  const tables = {
    "SMILE Pro": {1:39, 2:55, 3:75, 4:84, 5:99, 6:112, 7:126, 8:139, 9:152, 10:167, 11:180},
    "CLEAR": {1:39, 2:55, 3:75, 4:84, 5:99, 6:112, 7:126, 8:139, 9:152, 10:167, 11:180},
    "SmartSight": {1:26, 2:50, 3:63, 4:76, 5:89, 6:101, 7:113, 8:125, 9:137, 10:148, 11:159, 12:170},
    "Femto-LASIK": {1:16, 2:32, 3:48, 4:63, 5:79, 6:94, 7:109, 8:124, 9:139, 10:154, 11:166, 12:178},
    "Presbyond": {1:16, 2:32, 3:48, 4:63, 5:79, 6:94, 7:109, 8:124, 9:139, 10:154, 11:166, 12:178},
    "PresbyMAX": {1:71, 2:86, 3:100, 4:115, 5:130, 6:145, 7:159, 8:174},
  };
  const table = tables[tableKey] || tables.SmartSight;
  const base = interpolateAblationTable(table, totalD);
  return Math.round(base * factor);
}

function interpolateAblationTable(table, totalDiopters) {
  const totalD = Math.abs(parseFloat(totalDiopters) || 0);
  if (totalD <= 0) return 0;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const minKey = keys[0];
  const maxKey = keys[keys.length - 1];
  if (totalD <= minKey) return table[minKey] * (totalD / minKey);
  if (totalD >= maxKey) return table[maxKey];

  const lo = Math.floor(totalD);
  const hi = Math.ceil(totalD);
  if (lo === hi) return table[lo];
  const vLo = table[lo];
  const vHi = table[hi];
  return vLo + (vHi - vLo) * (totalD - lo);
}

function calculateTransPrkAblation(totalDiopters, epithelialThickness, oz = "6.5") {
  const totalD = Math.abs(parseFloat(totalDiopters) || 0);
  if (totalD > TRANS_PRK_MAX_SAFE_DIOPTERS) {
    return {
      isValid: false,
      totalDiopters: parseFloat(totalD.toFixed(2)),
      stromalAblation: null,
      totalAblation: null,
      warning: `Cảnh báo: Tổng dải độ điều trị (${totalD.toFixed(2)} Diop) vượt quá giới hạn an toàn của Trans-PRK là 7.00 Diop. Nguy cơ sẹo giác mạc (Haze) rất cao. Vui lòng chọn phương pháp khác (Femto-LASIK / Phakic).`,
    };
  }

  const factor = ozAblationFactor(oz);
  const stromalAblation = Math.round(interpolateAblationTable(TRANS_PRK_STROMAL_ABLATION_TABLE, totalD) * factor);
  const epiThickness = clampTransPrkEpithelialThickness(epithelialThickness);
  return {
    isValid: true,
    totalDiopters: parseFloat(totalD.toFixed(2)),
    stromalAblation,
    totalAblation: Math.round(stromalAblation + epiThickness),
    warning: null,
  };
}

function clampPresbyondTarget(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return PRESBYOND_TARGET_DEFAULT;
  return Math.min(PRESBYOND_TARGET_MAX, Math.max(PRESBYOND_TARGET_MIN, parsed));
}

function calculatePresbyondAblation(sphere, cylinder, target, oz = "6.5") {
  const sphereAltered = (parseFloat(sphere) || 0) - clampPresbyondTarget(target);
  const cylinderAltered = parseFloat(cylinder) || 0;
  const totalTreatment = Math.abs(sphereAltered) + Math.abs(cylinderAltered);
  const ozFactor = ozAblationFactor(oz);
  const micronsPerDiopter = OZ_BASE_MICRONS_PER_DIOPTER * ozFactor;
  const ablation = Math.round(totalTreatment * micronsPerDiopter);
  return {
    sphereAltered,
    cylinderAltered,
    totalTreatment,
    ozFactor,
    micronsPerDiopter,
    ablation,
  };
}

function smileHyperopicCylinderLimit(sphere) {
  if (sphere <= SMILE_HYPEROPIA_TAPER_START) return SMILE_HYPEROPIA_CYLINDER_LIMIT;
  if (sphere >= SMILE_HYPEROPIA_SPHERE_LIMIT) return 0;
  const taperSpan = SMILE_HYPEROPIA_SPHERE_LIMIT - SMILE_HYPEROPIA_TAPER_START;
  const remainingSphereRoom = SMILE_HYPEROPIA_SPHERE_LIMIT - sphere;
  return parseFloat(((remainingSphereRoom / taperSpan) * SMILE_HYPEROPIA_CYLINDER_LIMIT).toFixed(2));
}

function validateSmileTreatmentRange(procedure, sphere, cylinder) {
  if (procedure !== "SMILE Pro") return { isValid: true, level: "ok", warning: null };
  const sph = parseFloat(sphere);
  const cyl = parseFloat(cylinder);
  if (!Number.isFinite(sph) || !Number.isFinite(cyl)) {
    return { isValid: false, level: "data-error", warning: "❌ Lỗi dữ liệu: Vui lòng kiểm tra lại trị số khúc xạ nhập vào!" };
  }

  if (
    sph < SMILE_PHYSICAL_SPHERE_MIN ||
    sph > SMILE_PHYSICAL_SPHERE_MAX ||
    Math.abs(cyl) > SMILE_PHYSICAL_CYLINDER_LIMIT
  ) {
    return { isValid: false, level: "data-error", warning: "❌ Lỗi dữ liệu: Vui lòng kiểm tra lại trị số khúc xạ nhập vào!" };
  }

  const seq = sph + (cyl / 2);
  const mmp = Math.max(sph, sph + cyl);
  const cylAbs = Math.abs(cyl);
  const isMyopicPlan = sph <= 0 && cyl <= 0;

  if (isMyopicPlan) {
    const outsideMyopia =
      sph < SMILE_MYOPIA_SPHERE_LIMIT ||
      cyl < SMILE_MYOPIA_CYLINDER_LIMIT ||
      seq < SMILE_MYOPIA_SEQ_LIMIT;
    if (outsideMyopia) {
      return {
        isValid: false,
        level: "zeiss-gray-zone",
        warning: "🚨 Vùng xám Zeiss: Khúc xạ nằm ngoài ranh giới điều trị an toàn của SMILE Pro!",
      };
    }
    return { isValid: true, level: "ok", warning: null, seq, mmp };
  }

  const taperedCylinderLimit = smileHyperopicCylinderLimit(sph);
  const outsideHyperopia =
    sph > SMILE_HYPEROPIA_SPHERE_LIMIT ||
    cylAbs > SMILE_HYPEROPIA_CYLINDER_LIMIT ||
    mmp > SMILE_HYPEROPIA_MMP_LIMIT ||
    cylAbs > taperedCylinderLimit;
  if (outsideHyperopia) {
    return {
      isValid: false,
      level: "zeiss-gray-zone",
      warning: "🚨 Vùng xám Zeiss: Khúc xạ nằm ngoài ranh giới điều trị an toàn của SMILE Pro!",
      seq,
      mmp,
      taperedCylinderLimit,
    };
  }

  return { isValid: true, level: "ok", warning: null, seq, mmp, taperedCylinderLimit };
}

function calcRSB(procedure, cct, flapCap, ablation) {
  const effectiveFlap = isTransPrkProcedure(procedure) ? 0 : flapCap;
  return Math.round(cct - effectiveFlap - ablation);
}

function calcPTA(procedure, flapCap, ablation, cct) {
  const effectiveFlap = isTransPrkProcedure(procedure) ? 0 : flapCap;
  return cct > 0 ? parseFloat((((effectiveFlap + ablation) / cct) * 100).toFixed(1)) : null;
}

function ptaLevel(pta, procedure = "") {
  if (pta === null || isNaN(pta)) return "unknown";
  // Chuẩn hóa ngưỡng cảnh báo cho cả OD/OS: PTA >= 40% luôn là nguy hiểm.
  if (isTransPrkProcedure(procedure)) return pta < 35 ? "safe" : pta < 40 ? "caution" : "danger";
  return pta < 38 ? "safe" : pta < 40 ? "caution" : "danger";
}

function ptaLabel(pta, procedure = "") {
  const level = ptaLevel(pta, procedure);
  if (level === "safe") return "Safe";
  if (level === "caution") return "At Risk";
  if (level === "danger") return "High Risk";
  return "N/A";
}

function nightVisionRisk(mesopic, oz) {
  return mesopic > oz;
}

function clampSmileMinimumThickness(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return SMILE_MIN_THICKNESS_DEFAULT;
  return Math.min(SMILE_MIN_THICKNESS_MAX, Math.max(SMILE_MIN_THICKNESS_MIN, parsed));
}

function clampTransPrkEpithelialThickness(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return TRANS_PRK_EPITHELIAL_DEFAULT;
  return Math.min(TRANS_PRK_EPITHELIAL_MAX, Math.max(TRANS_PRK_EPITHELIAL_MIN, parsed));
}

function calcSmileLenticuleFromMinimum(baseLenticule, minimumThickness) {
  const minThickness = clampSmileMinimumThickness(minimumThickness);
  return Math.round(baseLenticule + (minThickness - SMILE_MIN_THICKNESS_DEFAULT));
}

function isOdToOsSyncedKey(key) {
  // Chỉ đồng bộ đúng các trường theo ghi chú UI: Procedure/OZ/Cap syncs to OS.
  // Minimum Thickness phải độc lập theo từng mắt để Lenticule OD/OS không bị kéo nhầm.
  return ["procedure", "oz", "flap_cap", "epithelial_thickness"].includes(key);
}

function syncOdFieldToOs(key, value) {
  if (!isOdToOsSyncedKey(key)) return;
  dongdoState.os[key] = value;
  const synced = document.querySelector(`[data-dd-eye="os"][data-dd-key="${key}"]`);
  if (synced && synced.value !== value) synced.value = value;
}

function applyPresbyondDefaults(eye, force = false) {
  if (!isPresbyondProcedure(dongdoState[eye]?.procedure)) return;
  if (force || dongdoState[eye].target_sph === "" || dongdoState[eye].target_sph === "0") {
    dongdoState[eye].target_sph = String(PRESBYOND_TARGET_DEFAULT);
  } else {
    dongdoState[eye].target_sph = String(clampPresbyondTarget(dongdoState[eye].target_sph));
  }
  if (force || dongdoState[eye].flap_cap === "") dongdoState[eye].flap_cap = String(PRESBYOND_FLAP_DEFAULT);
}

function hoaLevel(hoa) {
  if (isNaN(hoa) || hoa === null) return null;
  if (hoa < 0.39) return "normal";
  if (hoa >= 0.4 && hoa <= 0.55) return "warning";
  if (hoa < 0.4) return null;
  return "danger";
}

function hoaAlert(hoa) {
  const level = hoaLevel(hoa);
  if (!level) return null;
  if (level === "normal") return { level, text: "✓ Normal HOA (HOA bình thường)" };
  if (level === "warning") return { level, text: "Warning: Elevated HOA — Monitor closely (Cảnh báo: HOA cao)" };
  return { level, text: "Abnormal HOA: Pathological risk (HOA bất thường: Rủi ro bệnh lý)" };
}

function tbutAlert(tbut) {
  if (isNaN(tbut) || tbut === null || tbut === "") return null;
  const v = parseFloat(tbut);
  if (v < 5) return { level: "danger", text: "Severe Dry Eye: Temporary contraindication, treat ocular surface first (Khô mắt nặng)" };
  if (v >= 5 && v <= 7) return { level: "warning", text: "Mild to Moderate Dry Eye: TBUT 5-7 sec (Cần tối ưu bề mặt nhãn cầu)" };
  return { level: "success", text: "✓ Normal tear film (Màng phim nước mắt bình thường)" };
}

function highCylAlert(cyl) {
  const v = parseFloat(cyl);
  if (isNaN(v) || Math.abs(v) < 2.0) return null;
  return "High Astigmatism: Upright manual marking or Iris Registration mandatory (Loạn thị cao: Yêu cầu kích hoạt nhận diện mống mắt trên máy Laser)";
}

// Converted from the supplied React code. Formula steps are preserved.
function calcEye(eye) {
  const sph = parseFloat(eye.sph);
  const cyl = parseFloat(eye.cyl);
  if (isNaN(sph) || isNaN(cyl)) return null;

  const oz = parseFloat(eye.oz) || 6.5;
  const cct = parseFloat(eye.cct);
  const thinnest = parseFloat(eye.thinnest_point);
  const mesopic = parseFloat(eye.pupil_mesopic);
  const flapCap = eye.flap_cap !== "" && !isNaN(parseFloat(eye.flap_cap)) ? parseFloat(eye.flap_cap) : defaultFlapCap(eye.procedure);

  // Final Laser Sphere = Sphere (Input) - Target (Input)
  const target = parseFloat(eye.target_sph) || 0;
  const finalLaserSph = sph - target;

  // Ablation: Total Diopters = |Final Laser Sphere| + |Cylinder|
  const totalD = Math.abs(finalLaserSph) + Math.abs(cyl);
  const smileRangeValidation = validateSmileTreatmentRange(eye.procedure, sph, cyl);
  if (!smileRangeValidation.isValid) {
    return {
      sph,
      cyl,
      finalLaserSph,
      stromalAblation: null,
      epithelialThickness: clampTransPrkEpithelialThickness(eye.epithelial_thickness),
      ablation: null,
      lenticuleZeissForum: null,
      minimumThickness: clampSmileMinimumThickness(eye.min_thickness),
      flapCap,
      rsb: null,
      pta: null,
      nightRisk: false,
      totalD,
      postK1: null,
      postK2: null,
      postKMean: null,
      vaAlerts: [],
      topoAlert: false,
      predictedVA: null,
      smileRangeValidation,
      transPrkValidation: { isValid: true, warning: null },
    };
  }

  const isPresbyond = isPresbyondProcedure(eye.procedure);
  const presbyondTarget = isPresbyond ? clampPresbyondTarget(eye.target_sph) : target;
  const presbyondPlan = isPresbyond ? calculatePresbyondAblation(sph, cyl, presbyondTarget, oz) : null;

  // Với TransPRK, calcAblationDepth là stromal ablation theo khúc xạ.
  // Total Ablation = stromal ablation + epithelial thickness.
  const epithelialThickness = clampTransPrkEpithelialThickness(eye.epithelial_thickness);
  const transPrkAblation = calculateTransPrkAblation(totalD, epithelialThickness, oz);
  const stromalAblation = isTransPrkProcedure(eye.procedure)
    ? transPrkAblation.stromalAblation
    : isPresbyond ? presbyondPlan.ablation : calcAblationDepth(eye.procedure, finalLaserSph, cyl, oz);
  const transPrkInvalid = isTransPrkProcedure(eye.procedure) && !transPrkAblation.isValid;
  const ablation = isTransPrkProcedure(eye.procedure)
    ? transPrkAblation.totalAblation
    : isPresbyond ? presbyondPlan.ablation : stromalAblation;
  const minimumThickness = clampSmileMinimumThickness(eye.min_thickness);
  const lenticuleZeissForum = eye.procedure === "SMILE Pro"
    ? calcSmileLenticuleFromMinimum(stromalAblation, minimumThickness)
    : ablation;
  const ptaTissueDepth = eye.procedure === "SMILE Pro" ? lenticuleZeissForum : ablation;

  const rsb = !transPrkInvalid && !isNaN(thinnest) && !isNaN(cct) ? calcRSB(eye.procedure, cct, flapCap, ptaTissueDepth) : null;
  const pta = !transPrkInvalid && !isNaN(cct) ? calcPTA(eye.procedure, flapCap, ptaTissueDepth, cct) : null;
  const nightRisk = !isNaN(mesopic) ? nightVisionRisk(mesopic, oz) : false;

  const postKDiopters = isPresbyond ? presbyondPlan.totalTreatment : totalD;
  const k1v = parseFloat(eye.k1), k2v = parseFloat(eye.k2);
  const postK1 = !isNaN(k1v) ? parseFloat((k1v - 0.8 * postKDiopters).toFixed(2)) : null;
  const postK2 = !isNaN(k2v) ? parseFloat((k2v - 0.8 * postKDiopters).toFixed(2)) : null;
  const postKMean = !isNaN(k1v) && !isNaN(k2v)
    ? parseFloat((((k1v + k2v) / 2) - (0.8 * postKDiopters)).toFixed(2))
    : null;

  // Predicted VA Logic
  const mfBcva = (eye.mf_bcva || "").trim();
  const predictedVA = mfBcva === "20/20" && target >= 0 ? "20/20" : null;

  const vaAlerts = [];
  if (mfBcva !== "20/20" || target < 0) {
    vaAlerts.push({ level: "orange", msg: "Thị lực sau mổ có thể không đạt tối đa" });
  }

  const topoAlert = !isNaN(thinnest) && !isNaN(cct) && (cct - thinnest) >= 15;
  return {
    sph, cyl, finalLaserSph, stromalAblation, epithelialThickness, ablation, lenticuleZeissForum,
    minimumThickness, flapCap, rsb, pta, nightRisk, totalD, postK1, postK2, postKMean,
    vaAlerts, topoAlert, predictedVA,
    presbyondPlan,
    smileRangeValidation,
    transPrkValidation: isTransPrkProcedure(eye.procedure)
      ? { isValid: transPrkAblation.isValid, warning: transPrkAblation.warning }
      : { isValid: true, warning: null },
  };
}

window.VisionIDSharedState = window.VisionIDSharedState || {
  patient: {},
  surgeon: "",
  od: {},
  os: {},
};

window.VisionIDCalculator = {
  defaultFlapCap,
  calcAblationDepth,
  calculateRSB: calcRSB,
  calculatePTA: calcPTA,
  calcRSB,
  calcPTA,
  calculateTransPrkAblation,
  calculatePresbyondAblation,
  validateSmileTreatmentRange,
  ptaLevel,
  ptaLabel,
  calcEye,
  eyeSafetyAlerts,
};

const dongdoState = {
  activeTab: "planning",
  plans: loadLS(LS_PLANS, []),
  patient: { name: "", id: "", year: "", dominant: "OD" },
  surgeon: "",
  od: defaultEye(),
  os: defaultEye(),
  calcOD: null,
  calcOS: null,
  saveMsg: "",
  sheetsUrl: loadLS(LS_SHEETS_URL, ""),
};

let dongdoRecalcTimer = null;

function syncDongDoSharedState() {
  window.VisionIDSharedState = {
    patient: { ...dongdoState.patient },
    surgeon: dongdoState.surgeon,
    od: { ...dongdoState.od },
    os: { ...dongdoState.os },
    calcOD: dongdoState.calcOD,
    calcOS: dongdoState.calcOS,
  };
}

function applyPlanningSharedState(detail = {}) {
  if (detail.patient) {
    dongdoState.patient = {
      name: detail.patient.name || "",
      id: detail.patient.id || "",
      year: detail.patient.year || "",
      dominant: detail.patient.dominant || "OD",
    };
  }
  if (detail.surgeon !== undefined) dongdoState.surgeon = detail.surgeon;
  if (detail.od) dongdoState.od = { ...dongdoState.od, ...detail.od };
  if (detail.os) dongdoState.os = { ...dongdoState.os, ...detail.os };
  recalcDongDo();
  if (document.getElementById("dongdo")?.classList.contains("active")) renderDongDo();
}

function ddField(label, key, eye, attrs = "") {
  return `<label>${label}<input data-dd-eye="${eye}" data-dd-key="${key}" ${attrs} value="${escapeHtml(dongdoState[eye][key] ?? "")}"></label>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function numOrNull(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function eyeSafetyAlerts(eye, calc) {
  const alerts = [];
  const thinnest = numOrNull(eye.thinnest_point);
  const cct = numOrNull(eye.cct);
  if (thinnest !== null && thinnest < 480) alerts.push({ level: "danger", text: `Thinnest ${thinnest} um: giác mạc quá mỏng, cân nhắc dừng laser hoặc chuyển Phakic ICL.` });
  else if (thinnest !== null && thinnest < 500) alerts.push({ level: "warning", text: `Thinnest ${thinnest} um: vùng cận ngưỡng, cần đánh giá bản đồ giác mạc và Corvis ST.` });
  if (cct !== null && cct < 480) alerts.push({ level: "danger", text: `CCT ${cct} um: nguy cơ an toàn cao, ưu tiên loại trừ laser hoặc cân nhắc Phakic ICL.` });
  else if (cct !== null && cct < 500) alerts.push({ level: "warning", text: `CCT ${cct} um: cần thận trọng khi chọn procedure, flap/cap và OZ.` });
  if (eye.corvis_status === "caution") alerts.push({ level: "warning", text: "Corvis ST cảnh báo: cân nhắc Crosslinking hoặc giảm mức can thiệp mô." });
  if (eye.corvis_status === "danger") alerts.push({ level: "danger", text: "Corvis ST bất thường: cân nhắc dừng laser và chuyển hướng Phakic ICL." });
  if (calc?.pta !== null && calc?.pta >= 40) alerts.push({ level: "danger", text: `PTA ${calc.pta}% ≥ 40%: Nguy cơ cao - Ectasia risk.` });
  const rsbLimit = isTransPrkProcedure(eye.procedure) ? 350 : 300;
  if (calc?.rsb !== null && calc?.rsb < rsbLimit) alerts.push({ level: "danger", text: `RSB ${calc.rsb} um < ${rsbLimit} um: Nguy cơ cao - Ectasia risk.` });
  return alerts;
}

function renderClinicalAlerts(eye, calc) {
  const alerts = eyeSafetyAlerts(eye, calc);
  if (!alerts.length) return "";
  return `<div class="dd-clinical-alerts">${alerts.map((alert) => `<div class="dd-alert ${alert.level}">${alert.text}</div>`).join("")}</div>`;
}

function renderCalculationScreeningAlerts(eye) {
  const alerts = [];
  const thinnest = numOrNull(eye.thinnest_point);
  const cct = numOrNull(eye.cct);
  const hoa = numOrNull(eye.hoa_rms);
  const tbut = numOrNull(eye.tbut);

  // Cảnh báo realtime: chênh lệch pachymetry trung tâm và điểm mỏng nhất.
  if (thinnest !== null && cct !== null && (cct - thinnest) >= 15) {
    alerts.push({
      level: "danger",
      text: "⚠️ Corneal Thickness Risk: CCT - Thinnest Point ≥ 15 um (Check for Ectasia/Keratoconus risk).",
    });
  }

  // Cảnh báo realtime: HOA RMS theo ngưỡng sàng lọc bề mặt giác mạc.
  if (hoa !== null && hoa >= 0.4 && hoa <= 0.55) {
    alerts.push({
      level: "warning",
      text: "⚠️ HOA Warning: High-Order Aberrations (0.40 - 0.55 um) - Monitor corneal surface.",
    });
  } else if (hoa !== null && hoa > 0.55) {
    alerts.push({
      level: "danger",
      text: "🚨 HOA Danger: HOA RMS > 0.55 um - Requires Corneal Topography Re-evaluation.",
    });
  }

  // Cảnh báo realtime: TBUT thấp trước phẫu thuật khúc xạ.
  if (tbut !== null && tbut >= 5 && tbut <= 7) {
    alerts.push({
      level: "warning",
      text: "⚠️ Dry Eye Risk: Mild to Moderate Dry Eye (TBUT 5-7 sec) - Consider Pre-op Lubricants.",
    });
  } else if (tbut !== null && tbut < 5) {
    alerts.push({
      level: "danger",
      text: "🚨 Severe Dry Eye: Severe Dry Eye (TBUT < 5 sec) - Treat ocular surface before refractive surgery.",
    });
  }

  return alerts.map((alert) => `<div class="dd-alert ${alert.level} dd-screening-alert">${alert.text}</div>`).join("");
}

function renderPostKCalculationAlert(calc) {
  const postK = calc?.postKMean;
  if (postK === null || postK === undefined || isNaN(postK) || postK >= 34) return "";
  return `<div class="dd-alert danger dd-screening-alert">🚨 Cảnh báo Post-op K: ${postK} D - Ảnh hưởng chất lượng thị giác</div>`;
}

function ddSelect(label, key, eye, options) {
  const value = dongdoState[eye][key];
  return `<label>${label}<select data-dd-eye="${eye}" data-dd-key="${key}">${options.map((item) => `<option value="${item}" ${item === value ? "selected" : ""}>${item}</option>`).join("")}</select></label>`;
}

function renderTreatmentPlanFields(eye, data) {
  const showGenericTarget = !isPresbyondProcedure(data.procedure);
  return `<div class="dd-grid ${showGenericTarget ? "cols-4" : "cols-3"}">
    ${ddField("Sphere (D)", "sph", eye, 'type="number" step="0.25" placeholder="-3.00"')}
    ${ddField("Cylinder (D)", "cyl", eye, 'type="number" step="0.25" placeholder="-1.00"')}
    ${ddField("Axis", "axis", eye, 'type="number" step="1" placeholder="90"')}
    ${showGenericTarget ? ddField("Target (D)", "target_sph", eye, 'type="number" step="0.25" placeholder="0.00"') : ""}
  </div>`;
}

function renderSmileProDynamicFields(eye, data, calc) {
  const visible = data.procedure === "SMILE Pro";
  const minThickness = clampSmileMinimumThickness(data.min_thickness);
  const lenticule = calc?.lenticuleZeissForum ?? "";
  return `
    <div class="dd-smile-row" data-dd-smile-fields="${eye}" style="${visible ? "" : "display:none"}">
      <label>Minimum Thickness (um)
        <input data-dd-eye="${eye}" data-dd-key="min_thickness" type="number" min="${SMILE_MIN_THICKNESS_MIN}" max="${SMILE_MIN_THICKNESS_MAX}" step="1" value="${escapeHtml(minThickness)}">
      </label>
      <label>Lenticule (Zeiss Forum)
        <output data-dd-lenticule="${eye}">${lenticule !== "" ? `${lenticule} um` : "—"}</output>
      </label>
    </div>
  `;
}

function renderTransPrkDynamicFields(eye, data, calc) {
  const visible = isTransPrkProcedure(data.procedure);
  const epithelialThickness = clampTransPrkEpithelialThickness(data.epithelial_thickness);
  const stromalAblation = calc?.stromalAblation ?? "";
  const totalAblation = calc?.ablation ?? "";
  const invalidWarning = calc?.transPrkValidation?.isValid === false ? calc.transPrkValidation.warning : "";
  return `
    <div class="dd-smile-row" data-dd-transprk-fields="${eye}" style="${visible ? "" : "display:none"}">
      <label>Epithelial Thickness (um)
        <input data-dd-eye="${eye}" data-dd-key="epithelial_thickness" type="number" min="${TRANS_PRK_EPITHELIAL_MIN}" max="${TRANS_PRK_EPITHELIAL_MAX}" step="1" value="${escapeHtml(epithelialThickness)}">
      </label>
      <label>Total Ablation
        <output data-dd-transprk-ablation="${eye}">${totalAblation !== "" && totalAblation !== null ? `${totalAblation} um` : "Không tính"}</output>
      </label>
      <small>Stromal: ${stromalAblation !== "" && stromalAblation !== null ? `${stromalAblation} um` : "—"} + Epi: ${epithelialThickness} um</small>
      ${invalidWarning ? `<div class="dd-alert danger">${invalidWarning}</div>` : ""}
    </div>
  `;
}

function renderPresbyondDynamicFields(eye, data, calc) {
  const visible = isPresbyondProcedure(data.procedure);
  const target = clampPresbyondTarget(data.target_sph);
  const flap = data.flap_cap !== "" && !isNaN(parseFloat(data.flap_cap)) ? parseFloat(data.flap_cap) : PRESBYOND_FLAP_DEFAULT;
  const plan = calc?.presbyondPlan;
  return `
    <div class="dd-smile-row" data-dd-presbyond-fields="${eye}" style="${visible ? "" : "display:none"}">
      <label>Target (D)
        <input data-dd-eye="${eye}" data-dd-key="target_sph" type="number" min="${PRESBYOND_TARGET_MIN}" max="${PRESBYOND_TARGET_MAX}" step="0.25" value="${escapeHtml(target)}">
      </label>
      <label>Flap Thickness (um)
        <input data-dd-eye="${eye}" data-dd-key="flap_cap" type="number" step="1" value="${escapeHtml(flap)}">
      </label>
      <small>Total Treatment: ${plan ? `${plan.totalTreatment.toFixed(2)} D` : "—"} · OZ factor: ${plan ? `${plan.ozFactor.toFixed(3)} × 14 um/D` : "—"}</small>
    </div>
  `;
}

function renderDongDo() {
  const root = document.getElementById("dongdoApp");
  if (!root) return;
  const tabs = [
    ["planning", "Tính toán nhanh"],
    ["history", `Kế hoạch đã lưu (${dongdoState.plans.length})`],
  ];
  root.innerHTML = `
    <div class="dd-header">
      <img src="${DONGDO_LOGO_URL}" alt="Ảnh người sáng tạo">
      <div class="dd-creator-copy">
        <strong>${DONGDO_CREATOR_NAME}</strong>
        <span>${DONGDO_CREATOR_TAGLINE}</span>
      </div>
      <div class="dd-header-actions">
        ${dongdoState.activeTab === "planning" ? `
          <button data-dd-action="save-sync" class="dd-success" tabindex="-1">Lưu kế hoạch</button>
          <button data-dd-action="to-planning" class="dd-primary" tabindex="-1">Chuyển sang Hoạch định PT</button>
          <button data-dd-action="print" class="dd-light" tabindex="-1">Xuất PDF</button>
          <button data-dd-action="sheets" class="dd-icon" title="Google Sheets" tabindex="-1">⚙</button>
        ` : ""}
      </div>
    </div>
    ${dongdoState.saveMsg ? `<div class="notice ${dongdoState.saveMsg.startsWith("✓") ? "success" : "warning"}">${dongdoState.saveMsg}</div>` : ""}
    <div class="dd-tabs">${tabs.map(([key, label]) => `<button class="${dongdoState.activeTab === key ? "active" : ""}" data-dd-tab="${key}" tabindex="-1">${label}</button>`).join("")}</div>
    ${dongdoState.activeTab === "planning" ? renderDongDoPlanning() : ""}
    ${dongdoState.activeTab === "history" ? renderDongDoHistory() : ""}
  `;
  installDongDoTabOrder();
  updateDongDoSmileFields();
}

function renderDongDoPlanning() {
  const yob = parseInt(dongdoState.patient.year, 10);
  const age = isNaN(yob) ? null : 2026 - yob;
  return `
    <section class="dd-panel">
      <div class="dd-panel-title">Patient Information</div>
      <div class="dd-patient-grid">
        <label>Patient Name *<input data-dd-patient="name" value="${escapeHtml(dongdoState.patient.name)}" placeholder="John Doe"></label>
        <label>Patient ID<input data-dd-patient="id" value="${escapeHtml(dongdoState.patient.id)}" placeholder="BN-2026-001"></label>
        <label>Year of Birth<input data-dd-patient="year" type="number" value="${escapeHtml(dongdoState.patient.year)}" placeholder="1996"></label>
        <label>Dominant<select data-dd-patient="dominant"><option value="OD" ${dongdoState.patient.dominant === "OD" ? "selected" : ""}>OD</option><option value="OS" ${dongdoState.patient.dominant === "OS" ? "selected" : ""}>OS</option></select></label>
        <label>Surgeon<input data-dd-surgeon value="${escapeHtml(dongdoState.surgeon)}" placeholder="Tên bác sĩ"></label>
      </div>
    </section>
    ${age !== null && age >= 40 ? `<div class="dd-alert info"><strong>Presbyopia Alert - Age ${age} >= 40</strong><span>Consider Micro-monovision: Target -0.75D to -1.50D in the non-dominant eye.</span></div>` : ""}
    <div class="dd-eye-layout">
      ${renderDongDoEye("od", "Right Eye (OD)", "OD", true)}
      ${renderDongDoEye("os", "Left Eye (OS)", "OS", false)}
    </div>
  `;
}

function renderDongDoEye(eye, title, code, syncNote) {
  const data = dongdoState[eye];
  const calc = eye === "od" ? dongdoState.calcOD : dongdoState.calcOS;
  const hoa = numOrNull(data.hoa_rms);
  const tbut = numOrNull(data.tbut);
  const hoaA = hoa !== null ? hoaAlert(hoa) : null;
  const tbutA = tbut !== null ? tbutAlert(tbut) : null;
  const highCyl = highCylAlert(data.cyl);
  return `
    <section class="dd-eye-card">
      <header><b>${code}</b><strong>${title}${dongdoState.patient.dominant === code ? " ★" : ""}</strong>${syncNote ? "<span>* Procedure/OZ/Cap syncs to OS</span>" : ""}</header>
      <div class="dd-eye-body">
        ${ddGroup("1. Corneal Biometrics", `
          <div class="dd-grid cols-3">
            ${ddField("Thinnest Point (um)", "thinnest_point", eye, 'type="number" placeholder="510"')}
            ${ddField("CCT (um)", "cct", eye, 'type="number" placeholder="520"')}
            ${ddField("Mesopic Pupil (mm)", "pupil_mesopic", eye, 'type="number" step="0.1" placeholder="6.2"')}
            ${ddField("Pre-op K1 (D)", "k1", eye, 'type="number" step="0.01" placeholder="43.50"')}
            ${ddField("Pre-op K2 (D)", "k2", eye, 'type="number" step="0.01" placeholder="44.00"')}
            ${ddField("HOA RMS (um)", "hoa_rms", eye, 'type="number" step="0.01" placeholder="0.35"')}
            ${ddField("White-to-White (mm)", "wtw", eye, 'type="number" step="0.1" placeholder="11.5"')}
            ${ddField("TBUT (sec)", "tbut", eye, 'type="number" step="1" placeholder="10"')}
          </div>
          ${hoaA ? `<div class="dd-alert ${hoaA.level}">${hoaA.text}</div>` : ""}
          ${tbutA ? `<div class="dd-alert ${tbutA.level}">${tbutA.text}</div>` : ""}
          ${renderClinicalAlerts(data, calc)}
          ${renderPostK(calc)}
          ${calc?.topoAlert ? `<div class="dd-alert danger">Monitor Corneal Topography - CCT - Thinnest >= 15 um</div>` : ""}
          <div class="dd-corvit">
            <p>Corvit ST</p>
            <div class="dd-segment">
              ${[
                ["normal", "Normal", "Normal"],
                ["caution", "Warning", "Cảnh báo, xem xét sử dụng thêm Crosslinking"],
                ["danger", "Danger", "Xem xét phương pháp Phakic ICL"],
              ].map(([status, label, note]) => `<button type="button" class="${data.corvis_status === status ? `active ${status}` : status}" data-dd-corvis="${eye}:${status}"><strong>${label}</strong><span>${note}</span></button>`).join("")}
            </div>
          </div>
        `)}
        ${ddGroup("2. Manifest Refraction", `<div class="dd-grid cols-4">
          ${ddField("Sphere (D)", "mf_sph", eye, 'type="number" step="0.25" placeholder="-3.00"')}
          ${ddField("Cylinder (D)", "mf_cyl", eye, 'type="number" step="0.25" placeholder="-1.00"')}
          ${ddField("Axis", "mf_axis", eye, 'type="number" step="1" placeholder="90"')}
          ${ddField("Current BCVA", "mf_bcva", eye, 'placeholder="20/20"')}
        </div>`)}
        ${ddGroup("3. Treatment Plan (Laser Parameters)", `${renderTreatmentPlanFields(eye, data)}
        ${highCyl ? `<div class="dd-alert purple">${highCyl}</div>` : ""}
        ${renderVaAlerts(data)}`)}
        ${ddGroup("4. Surgical Plan", `<div class="dd-grid cols-4">
          ${ddSelect("Procedure", "procedure", eye, DONGDO_PROCEDURES)}
          ${ddField("Cap/Flap (um)", "flap_cap", eye, `type="number" placeholder="${defaultFlapCap(data.procedure)}"`)}
          ${ddSelect("Optical Zone (OZ)", "oz", eye, ["6.2", "6.5", "6.8"])}
          ${ddField("Incision (mm)", "incision", eye, 'type="number" step="0.1" placeholder="2.0"')}
        </div>`)}
        ${renderSmileProDynamicFields(eye, data, calc)}
        ${renderTransPrkDynamicFields(eye, data, calc)}
        ${renderPresbyondDynamicFields(eye, data, calc)}
        <div class="dd-calc-slot" data-dd-results="${eye}">
          ${calc ? renderDongDoResults(calc, data) : `<div class="dd-empty-calc">Fill in Group 4 to view results</div>`}
        </div>
      </div>
    </section>
  `;
}

function ddGroup(title, body) {
  return `<div class="dd-group"><h3>${title}</h3>${body}</div>`;
}

function renderPostK(calc) {
  if (!calc || (calc.postK1 === null && calc.postK2 === null)) return "";
  const item = (label, value) => value === null ? "" : `<div class="dd-mini-metric"><span>${label}</span><strong class="${value < 34 ? "danger" : "success"}">${value} D</strong></div>`;
  return `<div class="dd-mini-grid">${item("Predicted Post-op K1", calc.postK1)}${item("Predicted Post-op K2", calc.postK2)}</div>`;
}

function renderVaAlerts(eye) {
  const alerts = [];
  const bcvaDec = snellenToDecimal(eye.bcva);
  if (bcvaDec !== null && bcvaDec < 1.0) alerts.push("VA not maximum");
  if (!alerts.length) return "";
  return alerts.map((msg) => `<div class="dd-alert warning">${msg}</div>`).join("");
}

function renderDongDoResults(calc, data) {
  const tier = ptaLevel(calc.pta, data.procedure);
  const isSmile = data.procedure === "SMILE Pro";
  const isTransPrk = isTransPrkProcedure(data.procedure);
  const isPresbyond = isPresbyondProcedure(data.procedure);
  const tissueLabel = isSmile || data.procedure === "CLEAR"
    ? "Lenticule (Zeiss Forum)"
    : isTransPrk ? "Total Ablation (Stromal + Epithelium)" : isPresbyond ? "Ablation (OZ Factor)" : "Ablation";
  const tissueValue = isSmile ? calc.lenticuleZeissForum : calc.ablation;
  const rsbLimit = isTransPrk ? 350 : 300;
  const transPrkInvalid = isTransPrk && calc.transPrkValidation?.isValid === false;
  const smileRangeInvalid = isSmile && calc.smileRangeValidation?.isValid === false;
  return `
    <div class="dd-results">
      <div class="dd-results-title">Calculation Results</div>
      <div class="dd-result-grid">
        <div><span>Input Sphere</span><strong>${calc.finalLaserSph >= 0 ? "+" : ""}${calc.finalLaserSph.toFixed(2)} D</strong></div>
        <div><span>Input Cylinder</span><strong>${calc.cyl >= 0 ? "+" : ""}${calc.cyl.toFixed(2)} D</strong></div>
        <div><span>${isPresbyond ? "Total Treatment" : "Total Diopters"}</span><strong>${(isPresbyond ? calc.presbyondPlan.totalTreatment : calc.totalD).toFixed(2)} D</strong></div>
      </div>
      ${smileRangeInvalid ? `<div class="dd-alert danger">${calc.smileRangeValidation.warning}</div>` : ""}
      ${transPrkInvalid ? `<div class="dd-alert danger">${calc.transPrkValidation.warning}</div>` : ""}
      <div class="dd-main-metric ${transPrkInvalid || smileRangeInvalid ? "danger" : ""}"><span>${tissueLabel}</span><strong>${tissueValue !== null ? `${tissueValue} um` : "Không tính"}</strong></div>
      ${isTransPrk ? `<div class="dd-main-metric ${transPrkInvalid ? "danger" : ""}"><span>Stromal Ablation</span><strong>${calc.stromalAblation !== null ? `${calc.stromalAblation} um` : "Không tính"}</strong></div>` : ""}
      ${isPresbyond ? `<div class="dd-main-metric"><span>Sphere Altered</span><strong>${calc.presbyondPlan.sphereAltered >= 0 ? "+" : ""}${calc.presbyondPlan.sphereAltered.toFixed(2)} D</strong></div>` : ""}
      ${calc.rsb !== null ? `<div class="dd-main-metric ${calc.rsb >= rsbLimit ? "safe" : "danger"}"><span>RSB ${calc.rsb < rsbLimit ? "ECTASIA RISK" : ""}</span><strong>${calc.rsb} um</strong></div>` : ""}
      ${calc.pta !== null ? `<div class="dd-main-metric ${tier}"><span>PTA - ${ptaLabel(calc.pta, data.procedure)}</span><strong>${calc.pta}%</strong></div>` : ""}
      ${renderClinicalAlerts(data, calc)}
      ${renderCalculationScreeningAlerts(data)}
      ${renderPostKCalculationAlert(calc)}
      ${tier === "danger" ? `<div class="dd-alert danger">Consider Phakic ICL as an alternative procedure</div>` : ""}
      ${calc.nightRisk ? `<div class="dd-alert warning">Night Vision Risk: Mesopic Pupil > OZ</div>` : ""}
      ${calc.vaAlerts.map((a) => `<div class="dd-alert warning">${a.msg}</div>`).join("")}
      ${smileRangeInvalid ? "" : renderOzOptimization(data, calc)}
    </div>
  `;
}

function renderOzOptimization(data, calc) {
  const rows = ["6.2", "6.5", "6.8"].map((oz) => {
    const totalD = Math.abs(calc.finalLaserSph) + Math.abs(calc.cyl);
    const transPrkAblation = calculateTransPrkAblation(totalD, data.epithelial_thickness, oz);
    const stromalAblation = isTransPrkProcedure(data.procedure)
      ? transPrkAblation.stromalAblation
      : isPresbyondProcedure(data.procedure)
        ? calculatePresbyondAblation(data.sph, data.cyl, data.target_sph, oz).ablation
        : calcAblationDepth(data.procedure, calc.finalLaserSph, calc.cyl, parseFloat(oz));
    const ablation = isTransPrkProcedure(data.procedure)
      ? transPrkAblation.totalAblation
      : stromalAblation;
    const flapCap = data.flap_cap !== "" && !isNaN(parseFloat(data.flap_cap)) ? parseFloat(data.flap_cap) : defaultFlapCap(data.procedure);
    const cct = parseFloat(data.cct);
    const tissueDepth = data.procedure === "SMILE Pro"
      ? calcSmileLenticuleFromMinimum(ablation, data.min_thickness)
      : ablation;
    const isInvalidTransPrk = isTransPrkProcedure(data.procedure) && transPrkAblation.isValid === false;
    const rsb = !isInvalidTransPrk && !isNaN(cct) ? calcRSB(data.procedure, cct, flapCap, tissueDepth) : null;
    const pta = !isInvalidTransPrk && !isNaN(cct) ? calcPTA(data.procedure, flapCap, tissueDepth, cct) : null;
    const ablationCell = isInvalidTransPrk
      ? "Không tính"
      : isTransPrkProcedure(data.procedure) ? `${ablation} um (${stromalAblation}+epi)` : `${ablation} um`;
    return `<tr><td>${oz} mm</td><td>${ablationCell}</td><td>${rsb ?? "—"} um</td><td>${pta ?? "—"}%</td></tr>`;
  }).join("");
  return `<div class="dd-oz"><strong>OZ Optimization</strong><table><thead><tr><th>OZ</th><th>Ablation</th><th>RSB</th><th>PTA</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDongDoHistory() {
  return `<section class="dd-panel"><div class="dd-panel-title">Saved Plans History</div><div class="dd-list">${dongdoState.plans.length ? dongdoState.plans.map(renderDongDoPlan).join("") : `<div class="dd-empty">No saved plans yet. Use Save & Sync in the planning tab.</div>`}</div></section>`;
}

function renderDongDoPlan(plan) {
  const odPta = plan.calcOD?.pta;
  const osPta = plan.calcOS?.pta;
  const odRsb = plan.calcOD?.rsb;
  const osRsb = plan.calcOS?.rsb;
  const odRsbLimit = isTransPrkProcedure(plan.od?.procedure) ? 350 : 300;
  const osRsbLimit = isTransPrkProcedure(plan.os?.procedure) ? 350 : 300;
  const risk = (odPta !== null && odPta !== undefined && odPta >= 40) || (osPta !== null && osPta !== undefined && osPta >= 40) || (odRsb !== null && odRsb !== undefined && odRsb < odRsbLimit) || (osRsb !== null && osRsb !== undefined && osRsb < osRsbLimit);
  return `<article class="dd-row ${risk ? "dd-row-danger" : ""}"><div><strong>${escapeHtml(plan.patient.name)}</strong>${risk ? `<em>Nguy cơ cao - Ectasia risk</em>` : ""}<span>ID: ${escapeHtml(plan.patient.id)} · YOB: ${escapeHtml(plan.patient.year || "—")} · Saved: ${escapeHtml(plan.savedAt)}</span><span>OD PTA/RSB: ${odPta ?? "—"}% / ${odRsb ?? "—"} um · OS PTA/RSB: ${osPta ?? "—"}% / ${osRsb ?? "—"} um</span></div><button data-dd-load-plan="${plan.id}" tabindex="-1">Load</button><button data-dd-delete-plan="${plan.id}" class="dd-delete" tabindex="-1">Delete</button></article>`;
}

function handleDongDoCalculate() {
  dongdoState.calcOD = calcEye(dongdoState.od);
  dongdoState.calcOS = calcEye(dongdoState.os);
  renderDongDo();
}

function recalcDongDo() {
  dongdoState.calcOD = calcEye(dongdoState.od);
  dongdoState.calcOS = calcEye(dongdoState.os);
  syncDongDoSharedState();
}

function refreshDongDoResults() {
  recalcDongDo();
  updateDongDoResultSlots();
}

function scheduleDongDoRefresh() {
  window.clearTimeout(dongdoRecalcTimer);
  dongdoRecalcTimer = window.setTimeout(refreshDongDoResults, 180);
}

function updateDongDoResultSlots() {
  const odSlot = document.querySelector('[data-dd-results="od"]');
  const osSlot = document.querySelector('[data-dd-results="os"]');
  if (odSlot) {
    odSlot.innerHTML = dongdoState.calcOD
      ? renderDongDoResults(dongdoState.calcOD, dongdoState.od)
      : `<div class="dd-empty-calc">Fill in Group 4 to view results</div>`;
  }
  if (osSlot) {
    osSlot.innerHTML = dongdoState.calcOS
      ? renderDongDoResults(dongdoState.calcOS, dongdoState.os)
      : `<div class="dd-empty-calc">Fill in Group 4 to view results</div>`;
  }
}

function updateDongDoSmileFields() {
  ["od", "os"].forEach((eye) => {
    const row = document.querySelector(`[data-dd-smile-fields="${eye}"]`);
    const input = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="min_thickness"]`);
    const output = document.querySelector(`[data-dd-lenticule="${eye}"]`);
    if (!row) return;

    const isSmile = dongdoState[eye].procedure === "SMILE Pro";
    row.style.display = isSmile ? "" : "none";
    if (!isSmile) return;

    const clamped = clampSmileMinimumThickness(dongdoState[eye].min_thickness);
    dongdoState[eye].min_thickness = String(clamped);
    if (input && input.value !== String(clamped)) input.value = String(clamped);

    const calc = calcEye(dongdoState[eye]);
    if (output) output.textContent = calc ? `${calc.lenticuleZeissForum} um` : "—";
  });
  ["od", "os"].forEach((eye) => {
    applyPresbyondDefaults(eye, false);
  });
  updateDongDoTransPrkFields();
  updateDongDoPresbyondFields();
  updateDongDoCornealWarningFields();
  installDongDoTabOrder();
}

function updateDongDoTransPrkFields() {
  ["od", "os"].forEach((eye) => {
    const row = document.querySelector(`[data-dd-transprk-fields="${eye}"]`);
    const input = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="epithelial_thickness"]`);
    const output = document.querySelector(`[data-dd-transprk-ablation="${eye}"]`);
    if (!row) return;

    const isTransPrk = isTransPrkProcedure(dongdoState[eye].procedure);
    row.style.display = isTransPrk ? "" : "none";
    if (!isTransPrk) return;

    const clamped = clampTransPrkEpithelialThickness(dongdoState[eye].epithelial_thickness);
    dongdoState[eye].epithelial_thickness = String(clamped);
    if (input && input.value !== String(clamped)) input.value = String(clamped);

    const calc = calcEye(dongdoState[eye]);
    if (output) output.textContent = calc ? `${calc.ablation} um` : "—";
  });
}

function updateDongDoPresbyondFields() {
  ["od", "os"].forEach((eye) => {
    const row = document.querySelector(`[data-dd-presbyond-fields="${eye}"]`);
    const targetInput = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="target_sph"]`);
    const flapInput = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="flap_cap"]`);
    if (!row) return;

    const isPresbyond = isPresbyondProcedure(dongdoState[eye].procedure);
    row.style.display = isPresbyond ? "" : "none";
    if (!isPresbyond) return;

    applyPresbyondDefaults(eye, false);
    const target = clampPresbyondTarget(dongdoState[eye].target_sph);
    if (targetInput && targetInput.value !== String(target)) targetInput.value = String(target);

    if (flapInput && flapInput.value !== String(dongdoState[eye].flap_cap)) flapInput.value = String(dongdoState[eye].flap_cap);
  });
}

function updateDongDoCornealWarningFields() {
  ["od", "os"].forEach((eye) => {
    const data = dongdoState[eye] || {};
    const thinnest = parseFloat(data.thinnest_point);
    const cct = parseFloat(data.cct);
    const topoWarning = Number.isFinite(thinnest) && Number.isFinite(cct) && (cct - thinnest) >= 15;
    ["thinnest_point", "cct"].forEach((key) => {
      const input = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="${key}"]`);
      if (!input) return;
      input.classList.toggle("dd-input-warning", topoWarning);
    });

    const hoaInput = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="hoa_rms"]`);
    if (!hoaInput) return;
    hoaInput.classList.remove("dd-input-success", "dd-input-warning", "dd-input-danger");
    const hoa = parseFloat(data.hoa_rms);
    const level = hoaLevel(hoa);
    if (level === "normal") hoaInput.classList.add("dd-input-success");
    if (level === "warning") hoaInput.classList.add("dd-input-warning");
    if (level === "danger") hoaInput.classList.add("dd-input-danger");

    const tbutInput = document.querySelector(`[data-dd-eye="${eye}"][data-dd-key="tbut"]`);
    if (!tbutInput) return;
    tbutInput.classList.remove("dd-input-success", "dd-input-warning", "dd-input-danger");
    const tbut = parseFloat(data.tbut);
    const tbutLevel = tbutAlert(tbut)?.level;
    if (tbutLevel === "success") tbutInput.classList.add("dd-input-success");
    if (tbutLevel === "warning") tbutInput.classList.add("dd-input-warning");
    if (tbutLevel === "danger") tbutInput.classList.add("dd-input-danger");
  });
}

function handleDongDoSave() {
  if (!dongdoState.patient.name.trim()) {
    dongdoState.saveMsg = "⚠ Please fill in patient name first.";
    renderDongDo();
    setTimeout(() => { dongdoState.saveMsg = ""; renderDongDo(); }, 3000);
    return;
  }
  recalcDongDo();
  const plan = {
    id: Date.now(),
    savedAt: new Date().toLocaleString("en-GB"),
    patient: { ...dongdoState.patient },
    surgeon: dongdoState.surgeon,
    od: { ...dongdoState.od },
    os: { ...dongdoState.os },
    calcOD: dongdoState.calcOD,
    calcOS: dongdoState.calcOS,
  };
  dongdoState.plans = [plan, ...dongdoState.plans];
  saveLS(LS_PLANS, dongdoState.plans);
  dongdoState.saveMsg = "✓ Plan saved locally!";
  renderDongDo();
  setTimeout(() => { dongdoState.saveMsg = ""; renderDongDo(); }, 3000);
}

function handleSendToPlanning() {
  recalcDongDo();
  syncDongDoSharedState();
  window.dispatchEvent(new CustomEvent("visionid:quick-to-planning", {
    detail: { ...window.VisionIDSharedState },
  }));
}

function handleDongDoPrint() {
  recalcDongDo();
  const signed = (value, digits = 2) => {
    const n = parseFloat(value);
    if (isNaN(n)) return "&mdash;";
    return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
  };
  const raw = (value, suffix = "") => value !== "" && value !== null && value !== undefined ? `${escapeHtml(value)}${suffix}` : "&mdash;";
  const calcValue = (value, suffix = "") => value !== null && value !== undefined && !isNaN(value) ? `${value}${suffix}` : "&mdash;";
  const corvitMeta = (status) => {
    if (status === "danger") return { cls: "danger", label: "DANGER" };
    if (status === "caution") return { cls: "warning", label: "WARNING" };
    return { cls: "normal", label: "NORMAL" };
  };
  const normalizeProcedure = (value) => raw(String(value || "").replace(/\bIOL\b/g, "ICL"));
  const iclSize = (eye) => raw(eye.icl_size || eye.recommended_size || eye.ocos_size || eye.lens_size);
  const vault = (eye) => raw(eye.predicted_vault_um || eye.predicted_vault || eye.vault, eye.predicted_vault_um ? " um" : "");
  const metricRow = (label, odValue, osValue) => `<tr><th>${label}</th><td>${odValue}</td><td>${osValue}</td></tr>`;
  const planningRows = (label, key, suffix = "") => metricRow(label, raw(dongdoState.od[key], suffix), raw(dongdoState.os[key], suffix));
  const statusCell = (eye) => {
    const status = corvitMeta(eye.corvis_status);
    return `<span class="badge ${status.cls}">${status.label}</span>`;
  };
  const printedAt = new Date().toLocaleString("en-GB");
  const reportHtml = `<!doctype html><html><head><meta charset="UTF-8"><title>Surgical Plan Report - ${escapeHtml(dongdoState.patient.name || "Patient")}</title><style>
    @page{size:A4;margin:12mm 10mm}
    *{box-sizing:border-box}
    html,body{margin:0;background:#fff;color:#111827;font-family:Inter,Arial,"Segoe UI",Roboto,sans-serif;font-size:9.5px;line-height:1.18}
    .page{width:190mm;max-height:273mm;overflow:hidden}
    .table{display:table;width:100%;border-collapse:collapse;table-layout:fixed}
    .cell{display:table-cell;vertical-align:middle}
    .head{border-bottom:2px solid ${DONGDO_TEAL};padding-bottom:5px;margin-bottom:5px}
    .head-logo{width:18mm}.head-logo img{width:14mm;height:14mm;border-radius:50%;object-fit:cover;border:1px solid #dbeafe}
    h1{margin:0;color:${DONGDO_NAVY};font-size:18px;line-height:1}
    .tagline{margin-top:2px;color:#475569;font-size:9.5px;font-weight:800}
    .doc-title{text-align:right;color:${DONGDO_NAVY};font-weight:900;font-size:11px;line-height:1.15}
    .patient{margin:5px 0;border:1px solid #c5d9f0;background:#f0f8ff}
    .pf{display:table-cell;padding:4px 5px;border-right:1px solid #d6e6f7;vertical-align:top}
    .pf:last-child{border-right:0}.pf label{display:block;color:#64748b;text-transform:uppercase;font-size:7.2px;font-weight:800}.pf span{display:block;margin-top:1px;color:#0f172a;font-size:9.5px;font-weight:800}
    .section-title{margin:6px 0 3px;padding:3px 6px;background:${DONGDO_NAVY};color:#fff;font-size:9px;font-weight:900;text-transform:uppercase}
    .report-table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:4px}
    .report-table th,.report-table td{border:1px solid #dbe3ec;padding:3px 5px;vertical-align:middle}
    .report-table thead th{background:#e8f1fc;color:${DONGDO_NAVY};font-size:8.5px;text-align:center;text-transform:uppercase}
    .report-table tbody th{width:34%;background:#f8fafc;color:#475569;text-align:left;font-weight:800}
    .report-table td{text-align:center;font-weight:800}
    .badge{display:inline-block;min-width:58px;border-radius:999px;padding:2px 7px;font-size:8px;font-weight:900;text-align:center}
    .badge.normal{background:#dcfce7;color:#166534;border:1px solid #86efac}
    .badge.warning{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
    .badge.danger{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
    .signature{display:table;width:100%;table-layout:fixed;margin-top:8px;border-top:1px solid #dbe3ec}
    .sig{display:table-cell;width:50%;padding-top:5px;text-align:center;color:#111827;font-weight:900}
    .sig-line{height:16mm}.sig span{display:block;color:#64748b;font-size:8px;font-weight:700;margin-top:2px}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{page-break-after:avoid;break-after:avoid}}
  </style></head><body><div class="page">
    <div class="head table">
      <div class="cell head-logo"><img src="${DONGDO_LOGO_URL}" alt="VISION ID"></div>
      <div class="cell"><h1>${DONGDO_CREATOR_NAME}</h1><div class="tagline">ĐI ĐẦU CÔNG NGHỆ - ĐỊNH HƯỚNG TƯƠNG LAI</div></div>
      <div class="cell doc-title">SURGICAL PLAN REPORT<br><span>${printedAt}</span></div>
    </div>
    <div class="patient table">
      <div class="pf"><label>Patient Name</label><span>${raw(dongdoState.patient.name)}</span></div>
      <div class="pf"><label>Patient ID</label><span>${raw(dongdoState.patient.id)}</span></div>
      <div class="pf"><label>Year of Birth</label><span>${raw(dongdoState.patient.year)}</span></div>
      <div class="pf"><label>Dominant</label><span>${escapeHtml(dongdoState.patient.dominant || "OD")}</span></div>
      <div class="pf"><label>Surgeon</label><span>${escapeHtml(dongdoState.surgeon)}</span></div>
    </div>
    <div class="section-title">1. Corneal Biometrics</div>
    <table class="report-table"><thead><tr><th>Parameter</th><th>OD</th><th>OS</th></tr></thead><tbody>
      ${planningRows("CCT", "cct", " um")}
      ${planningRows("Thinnest Point", "thinnest_point", " um")}
      ${planningRows("K1", "k1", " D")}
      ${planningRows("K2", "k2", " D")}
      ${planningRows("HOA RMS", "hoa_rms", " um")}
      ${planningRows("WTW", "wtw", " mm")}
      ${planningRows("ACD", "acd", " mm")}
    </tbody></table>
    <div class="section-title">2. Cảnh báo an toàn (Corvis ST)</div>
    <table class="report-table"><thead><tr><th>Assessment</th><th>OD</th><th>OS</th></tr></thead><tbody>
      ${metricRow("Corvis ST", statusCell(dongdoState.od), statusCell(dongdoState.os))}
      ${metricRow("RSB", calcValue(dongdoState.calcOD?.rsb, " um"), calcValue(dongdoState.calcOS?.rsb, " um"))}
      ${metricRow("PTA", calcValue(dongdoState.calcOD?.pta, "%"), calcValue(dongdoState.calcOS?.pta, "%"))}
    </tbody></table>
    <div class="section-title">3. Surgical Planning</div>
    <table class="report-table"><thead><tr><th>Parameter</th><th>OD</th><th>OS</th></tr></thead><tbody>
      ${planningRows("Sphere", "mf_sph", " D")}
      ${planningRows("Cylinder", "mf_cyl", " D")}
      ${planningRows("Axis", "mf_axis", "&deg;")}
      ${metricRow("Recommended Method", normalizeProcedure(dongdoState.od.procedure || "Phakic ICL"), normalizeProcedure(dongdoState.os.procedure || "Phakic ICL"))}
      ${metricRow("ICL Size", iclSize(dongdoState.od), iclSize(dongdoState.os))}
      ${metricRow("Predicted Vault", vault(dongdoState.od), vault(dongdoState.os))}
      ${metricRow("Post-op K1 / K2", `${calcValue(dongdoState.calcOD?.postK1, " D")} / ${calcValue(dongdoState.calcOD?.postK2, " D")}`, `${calcValue(dongdoState.calcOS?.postK1, " D")} / ${calcValue(dongdoState.calcOS?.postK2, " D")}`)}
    </tbody></table>
    <div class="signature">
      <div class="sig"><div class="sig-line"></div>Patient Signature<span>Bệnh nhân</span></div>
      <div class="sig"><div class="sig-line"></div>Surgeon Signature<span>Bác sĩ phẫu thuật</span></div>
    </div>
  </div></body></html>`;
  printReportHtml(reportHtml);
}

function printReportHtml(reportHtml) {
  const oldFrame = document.getElementById("dongdoPrintFrame");
  if (oldFrame) oldFrame.remove();

  const frame = document.createElement("iframe");
  frame.id = "dongdoPrintFrame";
  frame.title = "Dong Do Surgical Plan Print Frame";
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(reportHtml);
  doc.close();

  frame.onload = () => {
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 300);
  };

  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `surgical-plan-${Date.now()}.html`;
      link.click();
      URL.revokeObjectURL(url);
      alert("Trình duyệt chặn hộp thoại in. Tôi đã tải file HTML báo cáo; mở file đó rồi chọn Print/Save as PDF.");
    }
  }, 700);
}

function dongDoTabItems(root) {
  return [...root.querySelectorAll([
    "#dongdo [data-dd-patient]",
    "#dongdo [data-dd-surgeon]",
    "#dongdo [data-dd-eye]",
    "#dongdo [data-dd-corvis]",
  ].join(","))].filter((item) => !item.disabled && item.offsetParent !== null);
}

function installDongDoTabOrder() {
  const root = document.getElementById("dongdoApp");
  if (!root) return;
  const tabItems = dongDoTabItems(root);
  root.querySelectorAll("button, input, select, textarea, a").forEach((item) => {
    if (!tabItems.includes(item)) item.tabIndex = -1;
  });
  tabItems.forEach((item, index) => {
    item.tabIndex = index + 1;
  });
}

function attachDongDoEvents() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const root = document.getElementById("dongdoApp");
    if (!root || !root.contains(event.target)) return;
    if (dongdoState.activeTab !== "planning") return;

    const focusables = dongDoTabItems(root);

    if (!focusables.length) return;
    const currentIndex = focusables.indexOf(event.target.closest("[data-dd-patient], [data-dd-surgeon], [data-dd-eye], [data-dd-corvis]"));

    event.preventDefault();
    if (currentIndex === -1) {
      const target = event.shiftKey ? focusables[focusables.length - 1] : focusables[0];
      target.focus();
      if (target.tagName === "INPUT") target.select();
      return;
    }
    const nextIndex = event.shiftKey
      ? (currentIndex - 1 + focusables.length) % focusables.length
      : (currentIndex + 1) % focusables.length;
    const next = focusables[nextIndex];
    next.focus();
    if (next.tagName === "INPUT") next.select();
  });

  document.addEventListener("input", (event) => {
    const patientKey = event.target.dataset.ddPatient;
    const surgeon = event.target.dataset.ddSurgeon !== undefined;
    const eye = event.target.dataset.ddEye;
    const key = event.target.dataset.ddKey;
    if (surgeon) {
      dongdoState.surgeon = event.target.value;
      syncDongDoSharedState();
    }
    if (patientKey) {
      dongdoState.patient[patientKey] = event.target.value;
      syncDongDoSharedState();
      if (patientKey === "dominant") renderDongDo();
    }
    if (eye && key) {
      const value = key === "min_thickness"
        ? String(clampSmileMinimumThickness(event.target.value))
        : key === "epithelial_thickness" ? String(clampTransPrkEpithelialThickness(event.target.value))
          : key === "target_sph" && isPresbyondProcedure(dongdoState[eye].procedure) ? String(clampPresbyondTarget(event.target.value)) : event.target.value;
      dongdoState[eye][key] = value;
      if ((key === "min_thickness" || key === "epithelial_thickness" || (key === "target_sph" && isPresbyondProcedure(dongdoState[eye].procedure))) && event.target.value !== value) event.target.value = value;
      if (eye === "od") syncOdFieldToOs(key, value);
      if (key === "procedure" && isPresbyondProcedure(value)) {
        applyPresbyondDefaults(eye, true);
        if (eye === "od") applyPresbyondDefaults("os", true);
      }
      updateDongDoSmileFields();
      if (key === "min_thickness" || key === "epithelial_thickness" || key === "target_sph" || isOdToOsSyncedKey(key)) refreshDongDoResults();
      else scheduleDongDoRefresh();
    }
  });
  document.addEventListener("change", (event) => {
    const patientKey = event.target.dataset.ddPatient;
    const surgeon = event.target.dataset.ddSurgeon !== undefined;
    const eye = event.target.dataset.ddEye;
    const key = event.target.dataset.ddKey;
    if (surgeon) {
      dongdoState.surgeon = event.target.value;
      syncDongDoSharedState();
    }
    if (patientKey) {
      dongdoState.patient[patientKey] = event.target.value;
      syncDongDoSharedState();
      if (patientKey === "dominant") renderDongDo();
    }
    if (eye && key) {
      const value = key === "min_thickness"
        ? String(clampSmileMinimumThickness(event.target.value))
        : key === "epithelial_thickness" ? String(clampTransPrkEpithelialThickness(event.target.value))
          : key === "target_sph" && isPresbyondProcedure(dongdoState[eye].procedure) ? String(clampPresbyondTarget(event.target.value)) : event.target.value;
      dongdoState[eye][key] = value;
      if ((key === "min_thickness" || key === "epithelial_thickness" || (key === "target_sph" && isPresbyondProcedure(dongdoState[eye].procedure))) && event.target.value !== value) event.target.value = value;
      if (eye === "od") syncOdFieldToOs(key, value);
      if (key === "procedure" && isPresbyondProcedure(value)) {
        applyPresbyondDefaults(eye, true);
        if (eye === "od") applyPresbyondDefaults("os", true);
      }
      updateDongDoSmileFields();
      if (key === "min_thickness" || key === "epithelial_thickness" || key === "target_sph" || isOdToOsSyncedKey(key)) refreshDongDoResults();
      else scheduleDongDoRefresh();
    }
  });
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-dd-tab]");
    const action = event.target.closest("[data-dd-action]");
    const corvis = event.target.closest("[data-dd-corvis]");
    const loadPlan = event.target.closest("[data-dd-load-plan]");
    const deletePlan = event.target.closest("[data-dd-delete-plan]");
    if (tab) { dongdoState.activeTab = tab.dataset.ddTab; renderDongDo(); }
    if (action?.dataset.ddAction === "save-sync") handleDongDoSave();
    if (action?.dataset.ddAction === "to-planning") handleSendToPlanning();
    if (action?.dataset.ddAction === "print") window.print();
    if (action?.dataset.ddAction === "sheets") alert("Google Sheets URL có thể lưu ở localStorage key visionid_sheets_url. Bản hiện tại đã giữ cấu trúc để mở rộng sync.");
    if (corvis) {
      const [eye, status] = corvis.dataset.ddCorvis.split(":");
      dongdoState[eye].corvis_status = status;
      recalcDongDo();
      renderDongDo();
    }
    if (loadPlan) {
      const plan = dongdoState.plans.find((item) => item.id === Number(loadPlan.dataset.ddLoadPlan));
      if (plan) {
        dongdoState.patient = { dominant: "OD", ...plan.patient };
        dongdoState.od = { ...plan.od };
        dongdoState.os = { ...plan.os };
        dongdoState.calcOD = plan.calcOD;
        dongdoState.calcOS = plan.calcOS;
        dongdoState.activeTab = "planning";
        renderDongDo();
      }
    }
    if (deletePlan) {
      dongdoState.plans = dongdoState.plans.filter((item) => item.id !== Number(deletePlan.dataset.ddDeletePlan));
      saveLS(LS_PLANS, dongdoState.plans);
      renderDongDo();
    }
  });
}

attachDongDoEvents();
window.addEventListener("visionid:planning-updated", (event) => applyPlanningSharedState(event.detail));
recalcDongDo();
renderDongDo();
