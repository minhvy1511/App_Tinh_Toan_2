const eyeFieldTemplate = (prefix) => `
  <label>Thinnest (um)<input name="${prefix}.thin" type="number" value="510"></label>
  <label>CCT (um)<input name="${prefix}.cct" type="number" value="520"></label>
  <label>K1 (D)<input name="${prefix}.k1" type="number" step="0.25" value="43.00"></label>
  <label>K2 (D)<input name="${prefix}.k2" type="number" step="0.25" value="44.00"></label>
  <label>Mesopic Pupil<input name="${prefix}.pupil" type="number" step="0.1" value="6.0"></label>
  <label>Manifest Sph<input name="${prefix}.mf_sph" type="number" step="0.25" value="-5.00"></label>
  <label>Manifest Cyl<input name="${prefix}.mf_cyl" type="number" step="0.25" value="-1.00"></label>
  <label>Axis<input name="${prefix}.mf_axis" type="number" value="90"></label>
  <label>VA<input name="${prefix}.mf_va" value="20/20"></label>
  <label>Laser Sphere<input name="${prefix}.ls_sph" type="number" step="0.25" value="-5.00"></label>
  <label>Laser Cylinder<input name="${prefix}.ls_cyl" type="number" step="0.25" value="-1.00"></label>
  <label>Laser Axis<input name="${prefix}.ls_axis" type="number" value="90"></label>
  <label>Target (D)<input name="${prefix}.ls_targ" type="number" step="0.25" value="0.00"></label>
  <label>Procedure<select name="${prefix}.proc" data-procedure></select></label>
  <label>Cap/Flap (um)<input name="${prefix}.flap" type="number" value="120"></label>
  <label>Optical Zone<select name="${prefix}.oz" data-oz></select></label>
  <label>Incision (mm)<input name="${prefix}.inc" type="number" step="0.1" value="2.0"></label>
`;

const numericNames = new Set([
  "thin", "cct", "k1", "k2", "pupil", "mf_sph", "mf_cyl", "mf_axis",
  "ls_sph", "ls_cyl", "ls_axis", "ls_targ", "flap", "inc", "yob"
]);

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

function gotoScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function renderEyeResult(title, result) {
  const metrics = [
    ["Final Laser Sph", `${result.final_laser_sph.toFixed(2)} D`],
    ["Ablation Depth", `${result.ablation_depth} um`],
    ["RSB (>250)", `${result.rsb} um`],
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

async function calculatePlanPreview() {
  const form = document.getElementById("planForm");
  const data = formToNestedObject(form);
  data.current_year = new Date().getFullYear();
  const result = await postJson("/api/calculate/plan", data);
  document.getElementById("planResult").innerHTML = `
    ${renderEyeResult("Mắt phải (OD)", result.eyes.od)}
    ${renderEyeResult("Mắt trái (OS)", result.eyes.os)}
  `;
}

async function savePlan(event) {
  event.preventDefault();
  const data = formToNestedObject(event.currentTarget);
  data.current_year = new Date().getFullYear();
  const record = await postJson("/api/plans", data);
  document.getElementById("planResult").innerHTML = `
    <div class="notice success">Đã lưu kế hoạch #${record.id} cho bệnh nhân ${record.patient_name}.</div>
    ${renderEyeResult("Mắt phải (OD)", record.result.eyes.od)}
    ${renderEyeResult("Mắt trái (OS)", record.result.eyes.os)}
  `;
  await loadPlans();
}

function riskLevel(plan) {
  const values = [plan.result.eyes.od, plan.result.eyes.os];
  const high = values.some((eye) => eye.pta > 43 || eye.rsb < 250);
  const medium = values.some((eye) => eye.pta >= 38 || eye.rsb < 280);
  if (high) return ["high", "Nguy cơ cao"];
  if (medium) return ["medium", "Cần lưu ý"];
  return ["low", "Ổn định"];
}

function uniquePatients(plans) {
  const map = new Map();
  plans.forEach((plan) => {
    const key = plan.patient_id || plan.patient_name;
    if (!map.has(key)) map.set(key, plan);
  });
  return [...map.values()];
}

function renderStats(plans) {
  const patients = uniquePatients(plans);
  const followUp = plans.filter((plan) => riskLevel(plan)[0] !== "low").length;
  document.getElementById("statPatients").textContent = patients.length;
  document.getElementById("statPlans").textContent = plans.length;
  document.getElementById("statDone").textContent = "0";
  document.getElementById("statFollowUp").textContent = followUp;
}

function renderBreakdown(plans) {
  const totalEyes = Math.max(plans.length * 2, 1);
  const counts = new Map();
  plans.forEach((plan) => {
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
  const recent = plans.slice(0, 5);
  const target = document.getElementById("recentPlans");
  if (!recent.length) {
    target.innerHTML = `<div class="empty-state">Chưa có kế hoạch nào. <button class="ghost-link" data-goto="planning">Tạo kế hoạch đầu tiên</button></div>`;
    return;
  }
  target.innerHTML = recent.map((plan) => {
    const [riskClass, riskText] = riskLevel(plan);
    return `
      <article class="list-item">
        <div>
          <strong>${plan.patient_name}</strong>
          <span>${plan.patient_id || "Chưa có mã"} | ${plan.surgeon || "Chưa nhập bác sĩ"} | ${new Date(plan.created_at).toLocaleString("vi-VN")}</span>
        </div>
        <span class="risk ${riskClass}">${riskText}</span>
      </article>
    `;
  }).join("");
}

function renderPatients(plans) {
  const patients = uniquePatients(plans);
  const target = document.getElementById("patientsList");
  if (!patients.length) {
    target.innerHTML = `<div class="empty-state">Chưa có bệnh nhân nào. <button class="ghost-link" data-goto="planning">Tạo kế hoạch đầu tiên</button></div>`;
    return;
  }
  target.innerHTML = patients.map((plan) => `
    <article class="list-item">
      <div>
        <strong>${plan.patient_name}</strong>
        <span>Mã ID: ${plan.patient_id || "chưa nhập"} | Tuổi: ${plan.result.patient_age} | Phẫu thuật viên: ${plan.surgeon || "chưa nhập"}</span>
      </div>
      <button data-goto="planning">Tạo kế hoạch</button>
    </article>
  `).join("");
}

function renderAudit(plans) {
  const target = document.getElementById("auditList");
  if (!plans.length) {
    target.innerHTML = `<div class="empty-state">Chưa có dữ liệu để kiểm toán.</div>`;
    return;
  }
  target.innerHTML = plans.map((plan) => {
    const [riskClass, riskText] = riskLevel(plan);
    return `
      <article class="list-item">
        <div>
          <strong>${plan.patient_name}</strong>
          <span>OD PTA ${plan.result.eyes.od.pta}% / RSB ${plan.result.eyes.od.rsb} um | OS PTA ${plan.result.eyes.os.pta}% / RSB ${plan.result.eyes.os.rsb} um</span>
        </div>
        <span class="risk ${riskClass}">${riskText}</span>
      </article>
    `;
  }).join("");
}

async function loadPlans() {
  const response = await fetch("/api/plans");
  plansCache = await response.json();
  renderStats(plansCache);
  renderBreakdown(plansCache);
  renderRecentPlans(plansCache);
  renderPatients(plansCache);
  renderAudit(plansCache);
}

function attachCalculation() {
  const planForm = document.getElementById("planForm");
  planForm.addEventListener("submit", savePlan);
  document.getElementById("previewPlan").addEventListener("click", calculatePlanPreview);
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
    panel.querySelector(".eye-fields").innerHTML = eyeFieldTemplate(eye);
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
