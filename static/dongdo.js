const DONGDO_LOGO_URL = "/static/creator.jpg";
const DONGDO_CREATOR_NAME = "VISION ID";
const DONGDO_CREATOR_TAGLINE = "ĐỨNG ĐẦU CÔNG NGHỆ - ĐỊNH HƯỚNG TƯƠNG LAI";
const DONGDO_CREATOR_SUBTITLE = "Công cụ tính toán phẫu thuật khúc xạ được hỗ trợ bởi AI PRO";
const DONGDO_PROCEDURES = ["SMILE Pro", "CLEAR", "SmartSight", "Femto-LASIK", "Trans-PRK", "Presbyond", "PresbyMAX"];
const DONGDO_NAVY = "#0a3d6b";
const DONGDO_TEAL = "#2ab3b8";
const LS_PATIENTS = "visionid_patients";
const LS_PLANS = "visionid_plans";
const LS_SHEETS_URL = "visionid_sheets_url";

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
  procedure: "SmartSight", flap_cap: "", oz: "6.5", incision: "2.0", tz: "",
});

function defaultFlapCap(procedure) {
  if (procedure === "Trans-PRK") return 0;
  if (procedure === "Femto-LASIK" || procedure === "Presbyond" || procedure === "PresbyMAX") return 110;
  return 120;
}

function calcAblationDepth(procedure, finalLaserSph, cyl, oz) {
  const totalD = Math.abs(finalLaserSph) + Math.abs(cyl);
  const tables = {
    "SMILE Pro": {1:39, 2:55, 3:75, 4:84, 5:99, 6:112, 7:126, 8:139, 9:152, 10:167, 11:180},
    "CLEAR": {1:39, 2:55, 3:75, 4:84, 5:99, 6:112, 7:126, 8:139, 9:152, 10:167, 11:180},
    "SmartSight": {1:26, 2:50, 3:63, 4:76, 5:89, 6:101, 7:113, 8:125, 9:137, 10:148, 11:159, 12:170},
    "Femto-LASIK": {1:16, 2:32, 3:48, 4:63, 5:79, 6:94, 7:109, 8:124, 9:139, 10:154, 11:166, 12:178},
    "Trans-PRK": {1:71, 2:86, 3:100, 4:115, 5:130, 6:145, 7:159, 8:174},
    "Presbyond": {1:16, 2:32, 3:48, 4:63, 5:79, 6:94, 7:109, 8:124, 9:139, 10:154, 11:166, 12:178},
    "PresbyMAX": {1:71, 2:86, 3:100, 4:115, 5:130, 6:145, 7:159, 8:174},
  };
  const table = tables[procedure] || tables.SmartSight;
  if (totalD <= 0) return 0;
  const lo = Math.floor(totalD);
  const hi = lo + 1;
  const vLo = table[lo] || 0;
  const vHi = table[hi] ?? table[lo] ?? 0;
  const base = vLo + (vHi - vLo) * (totalD - lo);
  const factor = String(oz) === "6.8" ? 1.087 : String(oz) === "6.2" ? 1 / 1.081 : 1;
  return Math.round(base * factor);
}

function calcRSB(procedure, cct, flapCap, ablation) {
  const effectiveFlap = procedure === "Trans-PRK" ? 0 : flapCap;
  return Math.round(cct - effectiveFlap - ablation);
}

function calcPTA(procedure, flapCap, ablation, cct) {
  const effectiveFlap = procedure === "Trans-PRK" ? 0 : flapCap;
  return cct > 0 ? parseFloat((((effectiveFlap + ablation) / cct) * 100).toFixed(1)) : null;
}

function ptaLevel(pta, procedure = "") {
  if (pta === null || isNaN(pta)) return "unknown";
  if (procedure === "Trans-PRK") return pta < 35 ? "safe" : pta <= 40 ? "caution" : "danger";
  return pta < 38 ? "safe" : pta <= 43 ? "caution" : "danger";
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

function hoaLevel(hoa) {
  if (isNaN(hoa) || hoa === null) return null;
  if (hoa <= 0.45) return "normal";
  if (hoa <= 0.65) return "warning";
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
  if (v < 10) return { level: "warning", text: "Mild Dry Eye: Prefer SMILE Pro or SmartSight (Khô mắt nhẹ: Ưu tiên chọn SMILE Pro hoặc SmartSight)" };
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
  const ablation = calcAblationDepth(eye.procedure, finalLaserSph, cyl, oz);

  const rsb = !isNaN(thinnest) && !isNaN(cct) ? calcRSB(eye.procedure, cct, flapCap, ablation) : null;
  const pta = !isNaN(cct) ? calcPTA(eye.procedure, flapCap, ablation, cct) : null;
  const nightRisk = !isNaN(mesopic) ? nightVisionRisk(mesopic, oz) : false;

  const k1v = parseFloat(eye.k1), k2v = parseFloat(eye.k2);
  const postK1 = !isNaN(k1v) ? parseFloat((k1v - 0.8 * totalD).toFixed(2)) : null;
  const postK2 = !isNaN(k2v) ? parseFloat((k2v - 0.8 * totalD).toFixed(2)) : null;

  // Predicted VA Logic
  const mfBcva = (eye.mf_bcva || "").trim();
  const predictedVA = mfBcva === "20/20" && target >= 0 ? "20/20" : null;

  const vaAlerts = [];
  if (mfBcva !== "20/20" || target < 0) {
    vaAlerts.push({ level: "orange", msg: "Thị lực sau mổ có thể không đạt tối đa" });
  }

  const topoAlert = !isNaN(thinnest) && !isNaN(cct) && (cct - thinnest) > 15;
  return { sph, cyl, finalLaserSph, ablation, flapCap, rsb, pta, nightRisk, totalD, postK1, postK2, vaAlerts, topoAlert, predictedVA };
}

const dongdoState = {
  activeTab: "planning",
  patients: loadLS(LS_PATIENTS, []),
  plans: loadLS(LS_PLANS, []),
  patientSearch: "",
  newPatient: { name: "", id: "", year: "" },
  patient: { name: "", id: "", year: "" },
  surgeon: "Dr. Phương Thủy",
  od: defaultEye(),
  os: defaultEye(),
  calcOD: null,
  calcOS: null,
  saveMsg: "",
  sheetsUrl: loadLS(LS_SHEETS_URL, ""),
};

let dongdoRecalcTimer = null;

function ddField(label, key, eye, attrs = "") {
  return `<label>${label}<input data-dd-eye="${eye}" data-dd-key="${key}" ${attrs} value="${escapeHtml(dongdoState[eye][key] ?? "")}"></label>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function ddSelect(label, key, eye, options) {
  const value = dongdoState[eye][key];
  return `<label>${label}<select data-dd-eye="${eye}" data-dd-key="${key}">${options.map((item) => `<option value="${item}" ${item === value ? "selected" : ""}>${item}</option>`).join("")}</select></label>`;
}

function renderDongDo() {
  const root = document.getElementById("dongdoApp");
  if (!root) return;
  const tabs = [
    ["planning", "Tính toán nhanh"],
    ["patients", `Bệnh nhân (${dongdoState.patients.length})`],
    ["history", `Kế hoạch đã lưu (${dongdoState.plans.length})`],
  ];
  root.innerHTML = `
    <div class="dd-header">
      <img src="${DONGDO_LOGO_URL}" alt="Ảnh người sáng tạo">
      <div class="dd-creator-copy">
        <strong>${DONGDO_CREATOR_NAME}</strong>
        <span>${DONGDO_CREATOR_TAGLINE}</span>
        <em>${DONGDO_CREATOR_SUBTITLE}</em>
      </div>
      <div class="dd-header-actions">
        ${dongdoState.activeTab === "planning" ? `
          <button data-dd-action="save-sync" class="dd-success" tabindex="-1">Lưu kế hoạch</button>
          <button data-dd-action="print" class="dd-light" tabindex="-1">Xuất PDF</button>
          <button data-dd-action="sheets" class="dd-icon" title="Google Sheets" tabindex="-1">⚙</button>
        ` : ""}
      </div>
    </div>
    ${dongdoState.saveMsg ? `<div class="notice ${dongdoState.saveMsg.startsWith("✓") ? "success" : "warning"}">${dongdoState.saveMsg}</div>` : ""}
    <div class="dd-tabs">${tabs.map(([key, label]) => `<button class="${dongdoState.activeTab === key ? "active" : ""}" data-dd-tab="${key}" tabindex="-1">${label}</button>`).join("")}</div>
    ${dongdoState.activeTab === "planning" ? renderDongDoPlanning() : ""}
    ${dongdoState.activeTab === "patients" ? renderDongDoPatients() : ""}
    ${dongdoState.activeTab === "history" ? renderDongDoHistory() : ""}
  `;
  installDongDoTabOrder();
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
        <label>Surgeon<input value="${escapeHtml(dongdoState.surgeon)}" disabled></label>
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
  const hoa = parseFloat(data.hoa_rms);
  const tbut = parseFloat(data.tbut);
  const hoaA = hoa ? hoaAlert(hoa) : null;
  const tbutA = tbut ? tbutAlert(tbut) : null;
  const highCyl = highCylAlert(data.cyl);
  return `
    <section class="dd-eye-card">
      <header><b>${code}</b><strong>${title}</strong>${syncNote ? "<span>* Procedure/OZ/Cap syncs to OS</span>" : ""}</header>
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
            ${ddSelect("Ocular Dominance", "ocular_dominance", eye, ["Dominant", "Non-Dominant"])}
            ${ddField("TBUT (sec)", "tbut", eye, 'type="number" step="1" placeholder="10"')}
          </div>
          ${hoaA ? `<div class="dd-alert ${hoaA.level}">${hoaA.text}</div>` : ""}
          ${tbutA ? `<div class="dd-alert ${tbutA.level}">${tbutA.text}</div>` : ""}
          ${renderPostK(calc)}
          ${calc?.topoAlert ? `<div class="dd-alert danger">Monitor Corneal Topography - CCT - Thinnest > 15 um</div>` : ""}
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
        ${ddGroup("3. Treatment Plan (Laser Parameters)", `<div class="dd-grid cols-4">
          ${ddField("Sphere (D)", "sph", eye, 'type="number" step="0.25" placeholder="-3.00"')}
          ${ddField("Cylinder (D)", "cyl", eye, 'type="number" step="0.25" placeholder="-1.00"')}
          ${ddField("Axis", "axis", eye, 'type="number" step="1" placeholder="90"')}
          ${ddField("Target (D)", "target_sph", eye, 'type="number" step="0.25" placeholder="0.00"')}
        </div>
        ${highCyl ? `<div class="dd-alert purple">${highCyl}</div>` : ""}
        ${renderVaAlerts(data)}`)}
        ${ddGroup("4. Surgical Plan", `<div class="dd-grid cols-4">
          ${ddSelect("Procedure", "procedure", eye, DONGDO_PROCEDURES)}
          ${ddField("Cap/Flap (um)", "flap_cap", eye, `type="number" placeholder="${defaultFlapCap(data.procedure)}"`)}
          ${ddSelect("Optical Zone (OZ)", "oz", eye, ["6.2", "6.5", "6.8"])}
          ${ddField("Incision (mm)", "incision", eye, 'type="number" step="0.1" placeholder="2.0"')}
        </div>`)}
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
  const item = (label, value) => value === null ? "" : `<div class="dd-mini-metric"><span>${label}</span><strong class="${value < 34 ? "danger" : value < 35 ? "warning" : "success"}">${value} D</strong></div>`;
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
  return `
    <div class="dd-results">
      <div class="dd-results-title">Calculation Results</div>
      <div class="dd-result-grid">
        <div><span>Input Sphere</span><strong>${calc.finalLaserSph >= 0 ? "+" : ""}${calc.finalLaserSph.toFixed(2)} D</strong></div>
        <div><span>Input Cylinder</span><strong>${calc.cyl >= 0 ? "+" : ""}${calc.cyl.toFixed(2)} D</strong></div>
        <div><span>Total Diopters</span><strong>${calc.totalD.toFixed(2)} D</strong></div>
      </div>
      <div class="dd-main-metric"><span>${data.procedure === "SMILE Pro" || data.procedure === "CLEAR" ? "Lenticule (Zeiss Forum)" : "Ablation"}</span><strong>${calc.ablation} um</strong></div>
      ${calc.rsb !== null ? `<div class="dd-main-metric ${calc.rsb >= 250 ? "safe" : "danger"}"><span>RSB ${calc.rsb < 250 ? "DANGER" : ""}</span><strong>${calc.rsb} um</strong></div>` : ""}
      ${calc.pta !== null ? `<div class="dd-main-metric ${tier}"><span>PTA - ${ptaLabel(calc.pta, data.procedure)}</span><strong>${calc.pta}%</strong></div>` : ""}
      ${tier === "danger" ? `<div class="dd-alert danger">Consider Phakic ICL as an alternative procedure</div>` : ""}
      ${calc.nightRisk ? `<div class="dd-alert warning">Night Vision Risk: Mesopic Pupil > OZ</div>` : ""}
      ${calc.vaAlerts.map((a) => `<div class="dd-alert warning">${a.msg}</div>`).join("")}
      ${renderOzOptimization(data, calc)}
    </div>
  `;
}

function renderOzOptimization(data, calc) {
  const rows = ["6.2", "6.5", "6.8"].map((oz) => {
    const ablation = calcAblationDepth(data.procedure, calc.finalLaserSph, calc.cyl, parseFloat(oz));
    const flapCap = data.flap_cap !== "" && !isNaN(parseFloat(data.flap_cap)) ? parseFloat(data.flap_cap) : defaultFlapCap(data.procedure);
    const cct = parseFloat(data.cct);
    const rsb = !isNaN(cct) ? calcRSB(data.procedure, cct, flapCap, ablation) : null;
    const pta = !isNaN(cct) ? calcPTA(data.procedure, flapCap, ablation, cct) : null;
    return `<tr><td>${oz} mm</td><td>${ablation} um</td><td>${rsb ?? "—"} um</td><td>${pta ?? "—"}%</td></tr>`;
  }).join("");
  return `<div class="dd-oz"><strong>OZ Optimization</strong><table><thead><tr><th>OZ</th><th>Ablation</th><th>RSB</th><th>PTA</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDongDoPatients() {
  return `
    <section class="dd-panel">
      <div class="dd-panel-title">Register New Patient</div>
      <div class="dd-patient-grid">
        <label>Patient Name *<input data-dd-new-patient="name" value="${escapeHtml(dongdoState.newPatient.name)}" placeholder="Full Name"></label>
        <label>Patient ID<input data-dd-new-patient="id" value="${escapeHtml(dongdoState.newPatient.id)}" placeholder="BN-2026-001"></label>
        <label>Year of Birth<input data-dd-new-patient="year" type="number" value="${escapeHtml(dongdoState.newPatient.year)}" placeholder="1996"></label>
        <button data-dd-action="register" class="dd-submit" tabindex="-1">Register Patient</button>
      </div>
    </section>
    <section class="dd-panel">
      <div class="dd-search"><input data-dd-search value="${escapeHtml(dongdoState.patientSearch)}" placeholder="Search by name or ID..."><span>${filteredDongDoPatients().length} patient(s)</span></div>
      <div class="dd-list">${filteredDongDoPatients().length ? filteredDongDoPatients().map(renderPatientRow).join("") : `<div class="dd-empty">No patients registered yet.</div>`}</div>
    </section>
  `;
}

function filteredDongDoPatients() {
  const q = dongdoState.patientSearch.toLowerCase();
  return dongdoState.patients.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
}

function renderPatientRow(p, i) {
  return `<article class="dd-row"><div class="dd-avatar">${escapeHtml(p.name[0] || "?")}</div><div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.id)} · YOB: ${escapeHtml(p.year || "—")} · Registered: ${escapeHtml(p.registered || "")}</span></div><button data-dd-select-patient="${i}" tabindex="-1">Open Plan</button></article>`;
}

function renderDongDoHistory() {
  return `<section class="dd-panel"><div class="dd-panel-title">Saved Plans History</div><div class="dd-list">${dongdoState.plans.length ? dongdoState.plans.map(renderDongDoPlan).join("") : `<div class="dd-empty">No saved plans yet. Use Save & Sync in the planning tab.</div>`}</div></section>`;
}

function renderDongDoPlan(plan) {
  const odPta = plan.calcOD?.pta;
  const osPta = plan.calcOS?.pta;
  const risk = (odPta !== null && odPta !== undefined && ptaLevel(odPta, plan.od?.procedure) !== "safe") || (osPta !== null && osPta !== undefined && ptaLevel(osPta, plan.os?.procedure) !== "safe");
  return `<article class="dd-row"><div><strong>${escapeHtml(plan.patient.name)}</strong>${risk ? `<em>Risk</em>` : ""}<span>ID: ${escapeHtml(plan.patient.id)} · YOB: ${escapeHtml(plan.patient.year || "—")} · Saved: ${escapeHtml(plan.savedAt)}</span><span>OD: ${plan.od?.procedure || "—"} · OS: ${plan.os?.procedure || "—"}</span></div><button data-dd-load-plan="${plan.id}" tabindex="-1">Load</button><button data-dd-delete-plan="${plan.id}" class="dd-delete" tabindex="-1">Delete</button></article>`;
}

function handleDongDoCalculate() {
  dongdoState.calcOD = calcEye(dongdoState.od);
  dongdoState.calcOS = calcEye(dongdoState.os);
  renderDongDo();
}

function recalcDongDo() {
  dongdoState.calcOD = calcEye(dongdoState.od);
  dongdoState.calcOS = calcEye(dongdoState.os);
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

function handleDongDoPrint() {
  recalcDongDo();
  const signed = (value, digits = 2) => {
    const n = parseFloat(value);
    if (isNaN(n)) return "—";
    return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
  };
  const raw = (value, suffix = "") => value !== "" && value !== null && value !== undefined ? `${escapeHtml(value)}${suffix}` : "—";
  const calcValue = (value, suffix = "") => value !== null && value !== undefined && !isNaN(value) ? `${value}${suffix}` : "—";
  const corvitMeta = (status) => {
    if (status === "danger") return { cls: "danger", label: "Danger", note: "Xem xét phương pháp Phakic ICL" };
    if (status === "caution") return { cls: "warning", label: "Warning", note: "Cảnh báo, xem xét sử dụng thêm Crosslinking" };
    return { cls: "success", label: "Normal", note: "Trong giới hạn bình thường" };
  };
  const postKClass = (value) => value === null || value === undefined ? "" : value < 34 ? "danger-text" : value < 35 ? "warning-text" : "success-text";
  const collectAlerts = (eye, calc) => {
    const alerts = [];
    const corvit = corvitMeta(eye.corvis_status);
    if (eye.corvis_status !== "normal") alerts.push({ cls: corvit.cls, text: `Corvit ST ${corvit.label}: ${corvit.note}` });
    const hoa = hoaAlert(parseFloat(eye.hoa_rms));
    if (hoa && hoa.level !== "normal") alerts.push({ cls: hoa.level === "danger" ? "danger" : "warning", text: hoa.text });
    const tbut = tbutAlert(parseFloat(eye.tbut));
    if (tbut && tbut.level !== "success") alerts.push({ cls: tbut.level, text: tbut.text });
    const highCyl = highCylAlert(eye.cyl);
    if (highCyl) alerts.push({ cls: "purple", text: highCyl });
    if (calc?.topoAlert) alerts.push({ cls: "danger", text: "Monitor Corneal Topography: CCT - Thinnest > 15 um" });
    if (calc?.nightRisk) alerts.push({ cls: "warning", text: "Night Vision Risk: Mesopic Pupil > OZ" });
    if (calc?.rsb !== null && calc?.rsb < 250) alerts.push({ cls: "danger", text: `RSB nguy hiểm: ${calc.rsb} um` });
    if (calc?.pta !== null) {
      const tier = ptaLevel(calc.pta, eye.procedure);
      if (tier === "caution") alerts.push({ cls: "warning", text: `PTA At Risk: ${calc.pta}% - cân nhắc Crosslinking` });
      if (tier === "danger") alerts.push({ cls: "danger", text: `PTA High Risk: ${calc.pta}% - cân nhắc Phakic ICL` });
    }
    (calc?.vaAlerts || []).forEach((item) => alerts.push({ cls: "warning", text: item.msg }));
    if (calc?.postK1 !== null && calc?.postK1 < 35) alerts.push({ cls: calc.postK1 < 34 ? "danger" : "warning", text: `Post-K1 thấp: ${calc.postK1} D` });
    if (calc?.postK2 !== null && calc?.postK2 < 35) alerts.push({ cls: calc.postK2 < 34 ? "danger" : "warning", text: `Post-K2 thấp: ${calc.postK2} D` });
    return alerts;
  };
  const row = (label, value, cls = "") => `<tr><td>${label}</td><td class="${cls}">${value}</td></tr>`;
  const section = (label) => `<tr><th colspan="2">${label}</th></tr>`;
  const resultBadge = (label, value, cls = "") => `<div class="result ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  const eyeReport = (label, eye, calc) => {
    const corvit = corvitMeta(eye.corvis_status);
    const tier = calc?.pta !== null && calc?.pta !== undefined ? ptaLevel(calc.pta, eye.procedure) : "";
    const alerts = collectAlerts(eye, calc);
    return `<section class="print-eye">
      <h2>${label}</h2>
      <div class="result-grid">
        ${resultBadge("Input Sphere", calc ? `${signed(calc.finalLaserSph)} D` : "—", "primary")}
        ${resultBadge("Ablation", calcValue(calc?.ablation, " um"), "primary")}
        ${resultBadge("RSB", calcValue(calc?.rsb, " um"), calc?.rsb !== null && calc?.rsb < 250 ? "danger" : "success")}
        ${resultBadge("PTA", calcValue(calc?.pta, "%"), tier === "danger" ? "danger" : tier === "caution" ? "warning" : "success")}
      </div>
      <table>
        ${section("1. Corneal Biometrics")}
        ${row("Thinnest / CCT", `${raw(eye.thinnest_point, " um")} / ${raw(eye.cct, " um")}`)}
        ${row("Mesopic Pupil", raw(eye.pupil_mesopic, " mm"))}
        ${row("K1 / K2", `${raw(eye.k1, " D")} / ${raw(eye.k2, " D")}`)}
        ${row("WTW / HOA RMS / TBUT", `${raw(eye.wtw, " mm")} / ${raw(eye.hoa_rms, " um")} / ${raw(eye.tbut, " sec")}`)}
        ${row("Ocular Dominance", raw(eye.ocular_dominance))}
        ${row("Corvit ST", `<b>${corvit.label}</b><br><small>${corvit.note}</small>`, corvit.cls)}
        ${section("2. Manifest Refraction")}
        ${row("Sphere / Cylinder", `${raw(eye.mf_sph, " D")} / ${raw(eye.mf_cyl, " D")}`)}
        ${row("Axis / BCVA", `${raw(eye.mf_axis, "°")} / ${raw(eye.mf_bcva)}`)}
        ${section("3. Treatment Plan")}
        ${row("Sphere / Cylinder", `${raw(eye.sph, " D")} / ${raw(eye.cyl, " D")}`)}
        ${row("Axis / Target", `${raw(eye.axis, "°")} / ${raw(eye.target_sph, " D")}`)}
        ${section("4. Surgical Plan")}
        ${row("Procedure", raw(eye.procedure))}
        ${row("Cap/Flap / OZ / Incision", `${raw(eye.flap_cap || defaultFlapCap(eye.procedure), " um")} / ${raw(eye.oz, " mm")} / ${raw(eye.incision, " mm")}`)}
        ${section("Calculation Results")}
        ${row("Input Sphere / Cylinder", `${calc ? signed(calc.finalLaserSph) : "—"} / ${calc ? signed(calc.cyl) : "—"} D`)}
        ${row("Total Diopters", calcValue(calc?.totalD?.toFixed ? calc.totalD.toFixed(2) : calc?.totalD, " D"))}
        ${row("Ablation / Lenticule", calcValue(calc?.ablation, " um"), "primary")}
        ${row("RSB", calcValue(calc?.rsb, " um"), calc?.rsb !== null && calc?.rsb < 250 ? "danger" : "success")}
        ${row("PTA", calcValue(calc?.pta, "%"), tier === "danger" ? "danger" : tier === "caution" ? "warning" : "success")}
        ${row("Post-op K1 / K2", `<span class="${postKClass(calc?.postK1)}">${calcValue(calc?.postK1, " D")}</span> / <span class="${postKClass(calc?.postK2)}">${calcValue(calc?.postK2, " D")}</span>`)}
        ${row("Predicted VA", raw(calc?.predictedVA))}
      </table>
      <div class="alerts">
        <strong>Warnings & Clinical Notes</strong>
        ${alerts.length ? alerts.map((item) => `<div class="alert ${item.cls}">${escapeHtml(item.text)}</div>`).join("") : `<div class="alert success">Không có cảnh báo nổi bật.</div>`}
      </div>
    </section>`;
  };
  const highRisk = [collectAlerts(dongdoState.od, dongdoState.calcOD), collectAlerts(dongdoState.os, dongdoState.calcOS)]
    .flat()
    .some((item) => item.cls === "danger");
  const reportHtml = `<!doctype html><html><head><meta charset="UTF-8"><title>Surgical Plan Report - ${escapeHtml(dongdoState.patient.name || "Patient")}</title><style>
    @page{size:A4 landscape;margin:7mm}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;line-height:1.25}
    .page{width:100%;min-height:100vh;padding:0}
    .head{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;border-bottom:2px solid ${DONGDO_TEAL};padding-bottom:7px;margin-bottom:8px}
    .head img{width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid #dbeafe}
    h1{margin:0;color:${DONGDO_NAVY};font-size:17px;line-height:1.1}
    .head p{margin:2px 0 0;color:#64748b;font-size:10px}
    .doc-title{text-align:right;color:${DONGDO_NAVY};font-weight:800;font-size:13px}
    .patient{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr 1.2fr;gap:6px;background:#f0f8ff;border:1px solid #c5d9f0;border-radius:6px;padding:7px 9px;margin-bottom:8px}
    .pf label{display:block;color:#64748b;text-transform:uppercase;font-size:8px;font-weight:700}
    .pf span{display:block;color:#0f172a;font-weight:800;font-size:10.5px;margin-top:2px}
    .global-risk{margin-bottom:8px;padding:6px 9px;border-radius:6px;border:1.5px solid #fca5a5;background:#fef2f2;color:#991b1b;font-weight:800}
    .dual{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}
    .print-eye{border:1.4px solid ${DONGDO_NAVY};border-radius:7px;overflow:hidden;break-inside:avoid}
    .print-eye h2{margin:0;background:${DONGDO_NAVY};color:#fff;padding:6px 8px;font-size:12px}
    .result-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:7px;background:#f8fafc;border-bottom:1px solid #dbe3ec}
    .result{border:1px solid #cbd5e1;border-radius:5px;background:#fff;padding:5px}
    .result span{display:block;color:#64748b;font-size:8px;font-weight:700;text-transform:uppercase}
    .result strong{display:block;margin-top:2px;font-size:12px;color:#0f172a}
    .result.primary{border-color:#93c5fd;background:#eff6ff}.result.primary strong{color:${DONGDO_NAVY}}
    .result.success{border-color:#86efac;background:#f0fdf4}.result.success strong{color:#15803d}
    .result.warning{border-color:#fcd34d;background:#fffbeb}.result.warning strong{color:#b45309}
    .result.danger{border-color:#fca5a5;background:#fef2f2}.result.danger strong{color:#b91c1c}
    table{width:100%;border-collapse:collapse}
    th{background:#e8f1fc;color:${DONGDO_NAVY};text-align:left;padding:4px 7px;font-size:8.5px;text-transform:uppercase;letter-spacing:.2px}
    td{border-bottom:1px solid #e5e7eb;padding:3.7px 7px;vertical-align:top}
    td:first-child{width:44%;color:#475569}
    td:last-child{text-align:right;font-weight:700}
    td.primary{color:${DONGDO_NAVY}}td.success{color:#15803d}td.warning{color:#b45309}td.danger{color:#b91c1c}
    .success-text{color:#15803d}.warning-text{color:#b45309}.danger-text{color:#b91c1c}
    small{font-weight:600;color:inherit}
    .alerts{padding:6px 7px;background:#fff}
    .alerts>strong{display:block;color:${DONGDO_NAVY};font-size:9px;text-transform:uppercase;margin-bottom:4px}
    .alert{border:1px solid #dbe3ec;border-radius:5px;padding:4px 6px;margin-top:3px;font-size:9.5px;font-weight:700}
    .alert.success{background:#f0fdf4;border-color:#86efac;color:#15803d}
    .alert.warning{background:#fffbeb;border-color:#fcd34d;color:#92400e}
    .alert.danger{background:#fef2f2;border-color:#fca5a5;color:#991b1b}
    .alert.purple{background:#faf5ff;border-color:#d8b4fe;color:#6b21a8}
    .footer{display:flex;justify-content:space-between;gap:10px;margin-top:6px;padding-top:5px;border-top:1px solid #e5e7eb;color:#64748b;font-size:8.5px}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{page-break-after:avoid}}
  </style></head><body><div class="page">
    <div class="head">
      <img src="${DONGDO_LOGO_URL}" alt="Ảnh người sáng tạo">
      <div><h1>${DONGDO_CREATOR_NAME}</h1><p>${DONGDO_CREATOR_TAGLINE}</p><p>${DONGDO_CREATOR_SUBTITLE}</p></div>
      <div class="doc-title">SURGICAL PLAN<br>REPORT<br><span style="font-size:9px;color:#64748b">${new Date().toLocaleDateString("en-GB")}</span></div>
    </div>
    <div class="patient">
      <div class="pf"><label>Patient Name</label><span>${escapeHtml(dongdoState.patient.name || "—")}</span></div>
      <div class="pf"><label>Patient ID</label><span>${escapeHtml(dongdoState.patient.id || "—")}</span></div>
      <div class="pf"><label>Year of Birth</label><span>${escapeHtml(dongdoState.patient.year || "—")}</span></div>
      <div class="pf"><label>Surgeon</label><span>${escapeHtml(dongdoState.surgeon)}</span></div>
      <div class="pf"><label>Printed</label><span>${new Date().toLocaleString("en-GB")}</span></div>
    </div>
    ${highRisk ? `<div class="global-risk">High-risk warning detected. Review highlighted PTA/RSB/Corvit ST alerts before surgery.</div>` : ""}
    <div class="dual">${eyeReport("Right Eye (OD)", dongdoState.od, dongdoState.calcOD)}${eyeReport("Left Eye (OS)", dongdoState.os, dongdoState.calcOS)}</div>
    <div class="footer"><span>${DONGDO_CREATOR_NAME} - VISION ID</span><span>OD shown on left, OS shown on right. Calculations generated from current input values.</span></div>
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
    const currentIndex = focusables.indexOf(event.target.closest("[data-dd-patient], [data-dd-eye], [data-dd-corvis]"));

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
    const newPatientKey = event.target.dataset.ddNewPatient;
    const eye = event.target.dataset.ddEye;
    const key = event.target.dataset.ddKey;
    if (patientKey) dongdoState.patient[patientKey] = event.target.value;
    if (newPatientKey) dongdoState.newPatient[newPatientKey] = event.target.value;
    if (eye && key) {
      dongdoState[eye][key] = event.target.value;
      if (eye === "od" && ["procedure", "oz", "flap_cap", "incision"].includes(key)) dongdoState.os[key] = event.target.value;
      scheduleDongDoRefresh();
    }
    if (event.target.dataset.ddSearch !== undefined) {
      dongdoState.patientSearch = event.target.value;
      renderDongDo();
    }
  });
  document.addEventListener("change", (event) => {
    const eye = event.target.dataset.ddEye;
    const key = event.target.dataset.ddKey;
    if (eye && key) {
      dongdoState[eye][key] = event.target.value;
      if (eye === "od" && ["procedure", "oz", "flap_cap", "incision"].includes(key)) {
        dongdoState.os[key] = event.target.value;
        const synced = document.querySelector(`[data-dd-eye="os"][data-dd-key="${key}"]`);
        if (synced) synced.value = event.target.value;
      }
      scheduleDongDoRefresh();
    }
  });
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-dd-tab]");
    const action = event.target.closest("[data-dd-action]");
    const corvis = event.target.closest("[data-dd-corvis]");
    const selectPatient = event.target.closest("[data-dd-select-patient]");
    const loadPlan = event.target.closest("[data-dd-load-plan]");
    const deletePlan = event.target.closest("[data-dd-delete-plan]");
    if (tab) { dongdoState.activeTab = tab.dataset.ddTab; renderDongDo(); }
    if (action?.dataset.ddAction === "save-sync") handleDongDoSave();
    if (action?.dataset.ddAction === "print") handleDongDoPrint();
    if (action?.dataset.ddAction === "sheets") alert("Google Sheets URL có thể lưu ở localStorage key visionid_sheets_url. Bản hiện tại đã giữ cấu trúc để mở rộng sync.");
    if (action?.dataset.ddAction === "register") {
      if (!dongdoState.newPatient.name.trim()) return;
      const p = { ...dongdoState.newPatient, id: dongdoState.newPatient.id || `BN-${Date.now()}`, registered: new Date().toLocaleDateString("en-GB") };
      dongdoState.patients = [p, ...dongdoState.patients];
      dongdoState.newPatient = { name: "", id: "", year: "" };
      saveLS(LS_PATIENTS, dongdoState.patients);
      renderDongDo();
    }
    if (corvis) {
      const [eye, status] = corvis.dataset.ddCorvis.split(":");
      dongdoState[eye].corvis_status = status;
      recalcDongDo();
      renderDongDo();
    }
    if (selectPatient) {
      const patient = filteredDongDoPatients()[Number(selectPatient.dataset.ddSelectPatient)];
      dongdoState.patient = { name: patient.name, id: patient.id, year: patient.year };
      dongdoState.od = defaultEye();
      dongdoState.os = defaultEye();
      dongdoState.calcOD = null;
      dongdoState.calcOS = null;
      dongdoState.activeTab = "planning";
      renderDongDo();
    }
    if (loadPlan) {
      const plan = dongdoState.plans.find((item) => item.id === Number(loadPlan.dataset.ddLoadPlan));
      if (plan) {
        dongdoState.patient = { ...plan.patient };
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
recalcDongDo();
renderDongDo();
