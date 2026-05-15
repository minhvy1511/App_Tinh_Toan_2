const eyeFieldTemplate = (prefix) => `
  <div class="eye-field-row cols-3">
    <label>Thinnest (um)<input name="${prefix}.thin" type="number" value="510"></label>
    <label>CCT (um)<input name="${prefix}.cct" type="number" value="520"></label>
    <label>Mesopic Pupil<input name="${prefix}.pupil" type="number" step="0.1" value="6.0"></label>
  </div>
  <div class="eye-field-row cols-3">
    <label>K1 (D)<input name="${prefix}.k1" type="number" step="0.25" value="43.00"></label>
    <label>K2 (D)<input name="${prefix}.k2" type="number" step="0.25" value="44.00"></label>
    <label>K Max<input name="${prefix}.kmax" type="number" step="0.25" value="45.00"></label>
  </div>
  <div class="eye-field-row cols-4">
    <label>Laser Sphere<input name="${prefix}.ls_sph" type="number" step="0.25" value="-5.00"></label>
    <label>Laser Cylinder<input name="${prefix}.ls_cyl" type="number" step="0.25" value="-1.00"></label>
    <label>Laser Axis<input name="${prefix}.ls_axis" type="number" value="90"></label>
    <label>Target (D)<input name="${prefix}.ls_targ" type="number" step="0.25" value="0.00"></label>
  </div>
  <div class="eye-field-row cols-4">
    <label>Procedure<select name="${prefix}.proc" data-procedure></select></label>
    <label>Cap/Flap (um)<input name="${prefix}.flap" type="number" value="120"></label>
    <label>Optical Zone<select name="${prefix}.oz" data-oz></select></label>
    <label>Incision (mm)<input name="${prefix}.inc" type="number" step="0.1" value="2.0"></label>
  </div>
`;

const numericNames = new Set([
  "thin", "cct", "k1", "k2", "kmax", "pupil", "mf_sph", "mf_cyl", "mf_axis",
  "old_sph", "old_cyl", "old_axis", "cy_sph", "cy_cyl", "cy_axis",
  "ret_sph", "ret_cyl", "ret_axis", "ls_sph", "ls_cyl", "ls_axis",
  "ls_targ", "flap", "inc", "yob", "wtw", "sts", "angle", "acd", "aqd",
  "cd", "icl_sph", "icl_cyl", "icl_size", "icl_axis"
]);

const phakicFieldTemplate = (prefix) => `
  <div class="phakic-row cols-3">
    <label>WTW (mm)<input name="${prefix}.wtw" type="number" step="0.1" placeholder="11.8"></label>
    <label>STS<input name="${prefix}.sts" type="number" step="0.1" placeholder="12.2"></label>
    <label>Góc tiền phòng<input name="${prefix}.angle" type="number" step="1" placeholder="35"></label>
  </div>
  <div class="phakic-row cols-2">
    <label>ACD (mm)<input name="${prefix}.acd" data-phakic-check="acd" type="number" step="0.01" placeholder="3.00"></label>
    <label>AqD (mm)<input name="${prefix}.aqd" type="number" step="0.01" placeholder="2.80"></label>
  </div>
  <div class="phakic-row cols-3">
    <label>Tế bào nội mô (CD)<input name="${prefix}.cd" data-phakic-check="cd" type="number" step="1" placeholder="2600"></label>
    <label>ICL Sph<input name="${prefix}.icl_sph" type="number" step="0.25" placeholder="-8.00"></label>
    <label>ICL Cyl<input name="${prefix}.icl_cyl" type="number" step="0.25" placeholder="-1.50"></label>
  </div>
  <div class="phakic-row cols-3">
    <label>Size kính ICL<select name="${prefix}.icl_size"><option value="">Chọn size</option><option>12.1</option><option>12.6</option><option>13.2</option><option>13.7</option></select></label>
    <label>Loại kính<select name="${prefix}.icl_type"><option>Non-Toric</option><option>Toric</option></select></label>
    <label>ICL Axis<input name="${prefix}.icl_axis" type="number" step="1" placeholder="90"></label>
  </div>
  <div class="phakic-alerts" data-phakic-alerts="${prefix}"></div>
`;

const clinicalRows = [
  ["ucva", "Thị lực không kính (UCVA)", [["ucva", "UCVA", "text"]]],
  ["old", "Kính cũ / Presenting Rx", [["old_sph", "Sph", "number"], ["old_cyl", "Cyl", "number"], ["old_axis", "Axis", "number"], ["old_va", "VA", "text"]]],
  ["mf", "Khúc xạ chủ quan tối đa", [["mf_sph", "Sph", "number"], ["mf_cyl", "Cyl", "number"], ["mf_axis", "Axis", "number"], ["mf_va", "VA", "text"]]],
  ["cy", "Khúc xạ liệt điều tiết", [["cy_sph", "Sph", "number"], ["cy_cyl", "Cyl", "number"], ["cy_axis", "Axis", "number"], ["cy_va", "VA", "text"]]],
  ["ret", "Soi bóng đồng tử", [["ret_sph", "Sph", "number"], ["ret_cyl", "Cyl", "number"], ["ret_axis", "Axis", "number"]]],
];

function clinicalRefractionTemplate() {
  const fieldInputs = (eye, fields) => fields.map(([key, label, type]) => `
    <label>
      <span>${label}</span>
      <input name="${eye}.${key}" ${type === "number" ? `type="number" step="${key.endsWith("_axis") ? "1" : "0.25"}"` : 'type="text"'} placeholder="${label}">
    </label>
  `).join("");
  const accordion = (eye, code) => `
    <article class="refraction-card">
      <header>
        <b>${code}</b>
        <strong>${code === "OD" ? "Mắt phải" : "Mắt trái"}</strong>
      </header>
      <div class="refraction-accordion">
        <details>
          <summary>Thị lực & Kính cũ</summary>
          <div class="refraction-line ucva-line">${fieldInputs(eye, clinicalRows[0][2])}</div>
          <div class="refraction-line">${fieldInputs(eye, clinicalRows[1][2])}</div>
        </details>
        <details open>
          <summary>Khúc xạ Manifest</summary>
          <div class="refraction-line">${fieldInputs(eye, clinicalRows[2][2])}</div>
        </details>
        <details>
          <summary>Khúc xạ Liệt điều tiết</summary>
          <div class="refraction-line">${fieldInputs(eye, clinicalRows[3][2])}</div>
        </details>
        <details>
          <summary>Soi bóng đồng tử</summary>
          <div class="refraction-line retinoscopy-line">${fieldInputs(eye, clinicalRows[4][2])}</div>
        </details>
      </div>
    </article>
  `;
  return `
    <div class="clinical-refraction-grid">
      ${accordion("od", "OD")}
      ${accordion("os", "OS")}
    </div>
  `;
}

const displayProcedures = [
  { name: "SMILE Pro", color: "blue" },
  { name: "CLEAR", color: "cyan" },
  { name: "SmartSight", color: "purple" },
  { name: "Femto-LASIK", color: "indigo" },
  { name: "Trans-PRK", color: "green", source: "SmartSurface" },
  { name: "Phakic IOL", color: "orange" },
];

let appConfig = { procedures: [], optical_zones: [] };
let plansCache = [];
let editingPlanId = null;
let editingPhakicPlanId = null;
let previewTimer = null;

function planningEyeToQuickEye(data = {}) {
  return {
    thinnest_point: data.thin ?? "",
    cct: data.cct ?? "",
    pupil_mesopic: data.pupil ?? "",
    k1: data.k1 ?? "",
    k2: data.k2 ?? "",
    kmax: data.kmax ?? "",
    mf_sph: data.mf_sph ?? "",
    mf_cyl: data.mf_cyl ?? "",
    mf_axis: data.mf_axis ?? "",
    mf_bcva: data.mf_va ?? "",
    sph: data.ls_sph ?? data.mf_sph ?? "",
    cyl: data.ls_cyl ?? data.mf_cyl ?? "",
    axis: data.ls_axis ?? data.mf_axis ?? "",
    target_sph: data.ls_targ ?? "0",
    procedure: data.proc || "SmartSight",
    flap_cap: data.flap ?? "",
    oz: data.oz || "6.5",
    incision: data.inc ?? "2.0",
    corvis_status: data.corvis_status || "normal",
  };
}

function quickEyeToPlanningEye(data = {}) {
  const sph = data.sph || data.mf_sph || "";
  const cyl = data.cyl || data.mf_cyl || "";
  const axis = data.axis || data.mf_axis || "";
  return {
    thin: data.thinnest_point || "",
    cct: data.cct || "",
    k1: data.k1 || "",
    k2: data.k2 || "",
    kmax: data.kmax || "",
    pupil: data.pupil_mesopic || "",
    mf_sph: data.mf_sph || sph,
    mf_cyl: data.mf_cyl || cyl,
    mf_axis: data.mf_axis || axis,
    mf_va: data.mf_bcva || "",
    ls_sph: sph,
    ls_cyl: cyl,
    ls_axis: axis,
    ls_targ: data.target_sph || "0",
    proc: data.procedure || "SmartSight",
    flap: data.flap_cap || "",
    oz: data.oz || "6.5",
    inc: data.incision || "2.0",
    corvis_status: data.corvis_status || "normal",
  };
}

function gotoScreen(screenId) {
  const target = document.getElementById(screenId);
  if (!target) return;
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  target.classList.add("active");
  document.querySelector(`[data-screen="${screenId}"]`)?.classList.add("active");
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-screen]");
  const goto = event.target.closest("[data-goto]");
  if (nav) gotoScreen(nav.dataset.screen);
  if (goto) gotoScreen(goto.dataset.goto);
});

function fillSelects(scope = document) {
  scope.querySelectorAll("[data-procedure]").forEach((select) => {
    select.innerHTML = appConfig.procedures.map((item) => `<option>${item}</option>`).join("");
  });
  scope.querySelectorAll("[data-oz]").forEach((select) => {
    select.innerHTML = appConfig.optical_zones.map((item) => `<option ${item === "6.5" ? "selected" : ""}>${item}</option>`).join("");
  });
}

function formToNestedObject(form) {
  const data = {};
  new FormData(form).forEach((value, name) => {
    const parts = name.split(".");
    const leaf = parts[parts.length - 1];
    const normalized = numericNames.has(leaf) ? Number(value) : value;
    if (parts.length === 1) {
      data[name] = normalized;
      return;
    }
    let target = data;
    parts.slice(0, -1).forEach((part) => {
      target[part] = target[part] || {};
      target = target[part];
    });
    target[leaf] = normalized;
  });
  return data;
}

async function postJson(url, body, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function deleteJson(url) {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

function formToObject(form) {
  const data = formToNestedObject(form);
  data.current_year = new Date().getFullYear();
  return data;
}

function renderEyeResult(title, result) {
  const metrics = [
    ["Final Laser Sph", `${result.final_laser_sph.toFixed(2)} D`],
    ["Ablation Depth", `${result.ablation_depth} um`],
    ["RSB (>300)", `${result.rsb} um`],
    ["PTA", `${result.pta}%`],
    ["Post-op K", `${result.post_k} D`],
  ];

  return `
    <section class="result-card">
      <h2>${title}</h2>
      <p>${result.target_note}</p>
      <div class="metrics">
        ${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("")}
      </div>
      ${result.warnings.map((warning) => `<div class="notice ${warning.level}">${warning.message}</div>`).join("")}
    </section>
  `;
}

function warningForUnifiedEye(eye, result) {
  const warnings = [];
  const calc = window.VisionIDCalculator;
  const level = calc?.ptaLevel?.(result.pta, eye.procedure);
  if (result.pta < 38) warnings.push({ level: "success", message: `PTA an toàn (${result.pta}%).` });
  else if (level === "caution") warnings.push({ level: "warning", message: `PTA cảnh báo (${result.pta}%): cần kiểm tra Corvis ST hoặc cân nhắc Crosslinking.` });
  else warnings.push({ level: "danger", message: `PTA nguy cơ cao (${result.pta}%): cân nhắc Phakic ICL.` });
  if (result.rsb < 300) warnings.push({ level: "danger", message: `RSB ${result.rsb} um < 300 um: Nguy cơ cao - Ectasia risk.` });
  if (result.nightRisk) warnings.push({ level: "warning", message: "Mesopic pupil lớn hơn OZ: nguy cơ lóa/halo ban đêm." });
  if (result.topoAlert) warnings.push({ level: "danger", message: "CCT - Thinnest > 15 um: cần đánh giá kỹ nguy cơ giác mạc." });
  return warnings;
}

function unifiedEyeResult(data) {
  const calc = window.VisionIDCalculator;
  if (!calc?.calcEye) return null;
  const eye = planningEyeToQuickEye(data);
  const result = calc.calcEye(eye);
  if (!result) return null;
  const target = Number(eye.target_sph || 0);
  const km = (Number(eye.k1 || 0) + Number(eye.k2 || 0)) / 2;
  return {
    final_laser_sph: result.finalLaserSph,
    total_d: result.totalD,
    ablation_depth: result.ablation,
    rsb: result.rsb,
    pta: result.pta,
    post_k: Number.isFinite(km) ? Number((km - (0.8 * result.totalD)).toFixed(2)) : result.postK1,
    target_note: target > 0 ? "Mục tiêu viễn thị - cộng thêm vào laser điều trị." : target < 0 ? "Thị lực nhìn gần / Monovision - trừ bớt laser điều trị." : "Thị lực nhìn xa tối đa.",
    warnings: warningForUnifiedEye(eye, result),
  };
}

function calculatePlanLocally(data) {
  if (!window.VisionIDCalculator?.calcEye) return null;
  const od = unifiedEyeResult(data.od);
  const os = unifiedEyeResult(data.os);
  if (!od || !os) return null;
  return {
    patient_age: new Date().getFullYear() - Number(data.patient?.yob || new Date().getFullYear()),
    eyes: { od, os },
  };
}

async function calculatePlanPreview() {
  const form = document.getElementById("planForm");
  const data = formToNestedObject(form);
  data.current_year = new Date().getFullYear();
  const result = calculatePlanLocally(data) || await postJson("/api/calculate/plan", data);
  document.getElementById("planResult").innerHTML = `
    ${renderEyeResult("Mắt phải (OD)", result.eyes.od)}
    ${renderEyeResult("Mắt trái (OS)", result.eyes.os)}
  `;
}

function schedulePlanPreview() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    calculatePlanPreview().catch((error) => {
      document.getElementById("planResult").innerHTML = `<div class="notice danger">${error.message}</div>`;
    });
  }, 180);
}

async function savePlan(event) {
  event.preventDefault();
  const data = formToObject(event.currentTarget);
  data.plan_type = "laser";
  const record = editingPlanId
    ? await postJson(`/api/plans/${editingPlanId}`, data, "PUT")
    : await postJson("/api/plans", data);
  editingPlanId = null;
  document.getElementById("planResult").innerHTML = `
    <div class="notice success">Đã lưu kế hoạch #${record.id} cho bệnh nhân ${record.patient_name}.</div>
    ${renderEyeResult("Mắt phải (OD)", record.result.eyes.od)}
    ${renderEyeResult("Mắt trái (OS)", record.result.eyes.os)}
  `;
  await loadPlans();
  gotoScreen("overview");
}

function phakicWarnings(eye = {}) {
  const warnings = [];
  if (Number(eye.acd) > 0 && Number(eye.acd) < 2.8) {
    warnings.push({ field: "acd", level: "danger", message: "Chống chỉ định: ACD quá nông" });
  }
  if (Number(eye.cd) > 0 && Number(eye.cd) < 2000) {
    warnings.push({ field: "cd", level: "warning", message: "Cảnh báo: Mật độ tế bào nội mô thấp" });
  }
  return warnings;
}

function calculatePhakicPlan(data) {
  return {
    patient_age: new Date().getFullYear() - Number(data.patient?.yob || new Date().getFullYear()),
    eyes: {
      od: { warnings: phakicWarnings(data.od), procedure: "Phakic IOL" },
      os: { warnings: phakicWarnings(data.os), procedure: "Phakic IOL" },
    },
  };
}

async function savePhakicPlan(event) {
  event.preventDefault();
  const data = formToObject(event.currentTarget);
  data.plan_type = "phakic";
  data.od.proc = "Phakic IOL";
  data.os.proc = "Phakic IOL";
  data.phakic_result = calculatePhakicPlan(data);
  const record = editingPhakicPlanId
    ? await postJson(`/api/plans/${editingPhakicPlanId}`, data, "PUT")
    : await postJson("/api/plans", data);
  editingPhakicPlanId = null;
  await loadPlans();
  gotoScreen("overview");
}

function riskLevel(plan) {
  if (plan.payload?.plan_type === "phakic") {
    const warnings = [...phakicWarnings(plan.payload.od), ...phakicWarnings(plan.payload.os)];
    if (warnings.some((item) => item.level === "danger")) return ["high", "Chống chỉ định"];
    if (warnings.length) return ["medium", "Cần lưu ý"];
    return ["low", "Đủ điều kiện"];
  }
  const values = [plan.result.eyes.od, plan.result.eyes.os];
  const high = values.some((eye) => eye.pta > 40 || eye.rsb < 300);
  const medium = values.some((eye) => eye.pta >= 38 || eye.rsb < 320);
  if (high) return ["high", "Nguy cơ cao - Ectasia risk"];
  if (medium) return ["medium", "Cần lưu ý"];
  return ["low", "Ổn định"];
}

function renderBreakdown(plans) {
  const totalEyes = Math.max(plans.length * 2, 1);
  const counts = new Map();
  plans.forEach((plan) => {
    if (plan.payload?.plan_type === "phakic") {
      counts.set("Phakic IOL", (counts.get("Phakic IOL") || 0) + 2);
      return;
    }
    ["od", "os"].forEach((eye) => {
      const proc = plan.payload?.[eye]?.proc;
      if (proc) counts.set(proc, (counts.get(proc) || 0) + 1);
    });
  });

  document.getElementById("procedureBreakdown").innerHTML = displayProcedures.map((item) => {
    const count = counts.get(item.source || item.name) || counts.get(item.name) || 0;
    const percent = Math.round((count / totalEyes) * 100);
    return `
      <div class="breakdown-row">
        <span class="tag ${item.color}">${item.name}</span>
        <div class="bar"><span style="width: ${percent}%"></span></div>
        <small>${count} ca (${percent}%)</small>
      </div>
    `;
  }).join("");
}

function renderRecentPlans(plans) {
  const target = document.getElementById("recentPlans");
  if (!plans.length) {
    target.innerHTML = `<div class="empty-state">Chưa có kế hoạch nào. <button class="ghost-link" data-goto="planning">Tạo kế hoạch đầu tiên</button></div>`;
    return;
  }
  target.innerHTML = plans.map((plan) => {
    const [riskClass, riskText] = riskLevel(plan);
    const isPhakic = plan.payload?.plan_type === "phakic";
    const odProc = isPhakic ? "Phakic IOL" : plan.payload?.od?.proc || "OD";
    const osProc = isPhakic ? "Phakic IOL" : plan.payload?.os?.proc || "OS";
    return `
      <article class="list-item recent-plan-item ${riskClass === "high" ? "risk-danger" : ""}">
        <div>
          <strong>${plan.patient_name}</strong>
          <span>${plan.patient_id || "Chưa có mã"} | ${plan.surgeon || "Chưa nhập bác sĩ"} | ${new Date(plan.created_at).toLocaleString("vi-VN")}</span>
          <span>${isPhakic ? "Phakic IOL" : "Laser"}: OD ${odProc} / OS ${osProc}</span>
        </div>
        <div class="recent-actions">
          <span class="risk ${riskClass}">${riskText}</span>
          <button type="button" data-review-plan="${plan.id}" title="Chỉnh sửa">✎ Chỉnh sửa</button>
          <button type="button" class="danger-action" data-delete-plan="${plan.id}" title="Xóa">🗑 Xóa</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadPlans() {
  const response = await fetch("/api/plans");
  plansCache = await response.json();
  renderBreakdown(plansCache);
  renderRecentPlans(plansCache);
}

function setFormValue(form, name, value) {
  const fields = form.querySelectorAll(`[name="${name}"]`);
  fields.forEach((field) => {
    if (field.type === "radio") {
      field.checked = String(field.value) === String(value);
    } else if (value !== undefined && value !== null) {
      field.value = value;
    }
  });
}

function syncPlanningSharedState() {
  const form = document.getElementById("planForm");
  if (!form) return;
  const data = formToNestedObject(form);
  window.VisionIDSharedState = {
    ...(window.VisionIDSharedState || {}),
    patient: {
      name: data.patient?.name || "",
      id: data.patient?.id || "",
      year: data.patient?.yob || "",
      dominant: data.patient?.dominant_eye || "OD",
    },
    surgeon: data.patient?.surgeon || "",
    od: planningEyeToQuickEye(data.od),
    os: planningEyeToQuickEye(data.os),
  };
  window.dispatchEvent(new CustomEvent("visionid:planning-updated", {
    detail: { ...window.VisionIDSharedState },
  }));
}

function syncSharedRefractionFromForm(form) {
  const data = formToNestedObject(form);
  window.VisionIDSharedState = {
    ...(window.VisionIDSharedState || {}),
    patient: {
      name: data.patient?.name || "",
      id: data.patient?.id || "",
      year: data.patient?.yob || "",
      dominant: data.patient?.dominant_eye || "OD",
    },
    surgeon: data.patient?.surgeon || "",
    od: { ...(window.VisionIDSharedState?.od || {}), ...planningEyeToQuickEye(data.od), ...data.od },
    os: { ...(window.VisionIDSharedState?.os || {}), ...planningEyeToQuickEye(data.os), ...data.os },
  };
  window.dispatchEvent(new CustomEvent("visionid:planning-updated", {
    detail: { ...window.VisionIDSharedState },
  }));
}

function applySharedRefractionToForm(form, detail = {}) {
  const patient = detail.patient || {};
  setFormValue(form, "patient.name", patient.name || "");
  setFormValue(form, "patient.id", patient.id || "");
  setFormValue(form, "patient.yob", patient.year || "");
  setFormValue(form, "patient.surgeon", detail.surgeon || "");
  setFormValue(form, "patient.dominant_eye", patient.dominant || "OD");
  ["od", "os"].forEach((eye) => {
    const values = { ...quickEyeToPlanningEye(detail[eye] || {}), ...(detail[eye] || {}) };
    Object.entries(values).forEach(([key, value]) => setFormValue(form, `${eye}.${key}`, value));
  });
}

function applyQuickDataToPlanning(detail = {}) {
  const form = document.getElementById("planForm");
  applySharedRefractionToForm(form, detail);
  syncPlanningSharedState();
  gotoScreen("planning");
  calculatePlanPreview();
}

function loadPlanIntoForm(plan) {
  if (plan.payload?.plan_type === "phakic") {
    loadPhakicPlanIntoForm(plan);
    return;
  }
  editingPlanId = plan.id;
  const form = document.getElementById("planForm");
  const payload = plan.payload || {};
  Object.entries(payload.patient || {}).forEach(([key, value]) => setFormValue(form, `patient.${key}`, value));
  ["od", "os"].forEach((eye) => {
    Object.entries(payload[eye] || {}).forEach(([key, value]) => setFormValue(form, `${eye}.${key}`, value));
  });
  setFormValue(form, "notes", plan.notes || "");
  syncPlanningSharedState();
  document.getElementById("planResult").innerHTML = `
    <div class="notice warning">Đang xem lại kế hoạch #${plan.id}. Sau khi chỉnh sửa, bấm Lưu kế hoạch để cập nhật bản ghi này.</div>
    ${renderEyeResult("Mắt phải (OD)", plan.result.eyes.od)}
    ${renderEyeResult("Mắt trái (OS)", plan.result.eyes.os)}
  `;
  gotoScreen("planning");
}

function loadPhakicPlanIntoForm(plan) {
  editingPhakicPlanId = plan.id;
  const form = document.getElementById("phakicForm");
  const payload = plan.payload || {};
  Object.entries(payload.patient || {}).forEach(([key, value]) => setFormValue(form, `patient.${key}`, value));
  ["od", "os"].forEach((eye) => {
    Object.entries(payload[eye] || {}).forEach(([key, value]) => setFormValue(form, `${eye}.${key}`, value));
  });
  setFormValue(form, "notes", plan.notes || "");
  validatePhakicForm();
  syncSharedRefractionFromForm(form);
  gotoScreen("phakic");
}

function validatePhakicForm() {
  const form = document.getElementById("phakicForm");
  if (!form) return;
  const data = formToNestedObject(form);
  ["od", "os"].forEach((eye) => {
    const alerts = phakicWarnings(data[eye] || {});
    form.querySelectorAll(`[name^="${eye}."].input-danger, [name^="${eye}."].input-warning`).forEach((input) => {
      input.classList.remove("input-danger", "input-warning");
    });
    const target = form.querySelector(`[data-phakic-alerts="${eye}"]`);
    if (target) target.innerHTML = alerts.map((item) => `<div class="phakic-alert ${item.level}">${item.message}</div>`).join("");
    alerts.forEach((item) => {
      const input = form.querySelector(`[name="${eye}.${item.field}"]`);
      input?.classList.add(item.level === "danger" ? "input-danger" : "input-warning");
    });
  });
}

function attachCalculation() {
  const planForm = document.getElementById("planForm");
  const phakicForm = document.getElementById("phakicForm");
  planForm.addEventListener("submit", savePlan);
  planForm.addEventListener("input", () => {
    syncPlanningSharedState();
    schedulePlanPreview();
  });
  planForm.addEventListener("change", () => {
    syncPlanningSharedState();
    schedulePlanPreview();
  });
  document.getElementById("previewPlan").addEventListener("click", calculatePlanPreview);
  window.addEventListener("visionid:quick-to-planning", (event) => applyQuickDataToPlanning(event.detail));
  phakicForm.addEventListener("submit", savePhakicPlan);
  phakicForm.addEventListener("input", () => {
    validatePhakicForm();
    syncSharedRefractionFromForm(phakicForm);
  });
  phakicForm.addEventListener("change", () => {
    validatePhakicForm();
    syncSharedRefractionFromForm(phakicForm);
  });
  document.addEventListener("click", (event) => {
    const review = event.target.closest("[data-review-plan]");
    if (!review) return;
    const plan = plansCache.find((item) => item.id === Number(review.dataset.reviewPlan));
    if (plan) loadPlanIntoForm(plan);
  });
  document.addEventListener("click", async (event) => {
    const del = event.target.closest("[data-delete-plan]");
    if (!del) return;
    const plan = plansCache.find((item) => item.id === Number(del.dataset.deletePlan));
    const label = plan ? `${plan.patient_name} (${plan.patient_id || "chưa có mã"})` : "kế hoạch này";
    if (!confirm(`Xóa ${label}? Thao tác này không thể hoàn tác.`)) return;
    await deleteJson(`/api/plans/${del.dataset.deletePlan}`);
    await loadPlans();
  });
}

function setTodayLabel() {
  const today = new Date();
  const date = today.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  document.getElementById("todayLabel").textContent = `${date} - Hệ thống hoạch định phẫu thuật khúc xạ`;
}

async function init() {
  document.querySelectorAll(".eye-panel").forEach((panel) => {
    const eye = panel.dataset.eye;
    if (eye) panel.querySelector(".eye-fields").innerHTML = eyeFieldTemplate(eye);
  });
  document.getElementById("clinicalRefractionTable").innerHTML = clinicalRefractionTemplate();
  document.getElementById("phakicRefractionTable").innerHTML = clinicalRefractionTemplate();
  document.querySelectorAll("[data-phakic-eye]").forEach((panel) => {
    const eye = panel.dataset.phakicEye;
    panel.querySelector(".phakic-fields").innerHTML = phakicFieldTemplate(eye);
  });
  appConfig = await fetch("/api/config").then((response) => response.json());
  fillSelects();
  attachCalculation();
  setTodayLabel();
  await calculatePlanPreview();
  await loadPlans();
}

init().catch((error) => {
  document.body.insertAdjacentHTML("afterbegin", `<div class="notice danger">${error.message}</div>`);
});
