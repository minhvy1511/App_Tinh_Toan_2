# VISION ID - Feature Notes

File nay ghi lai cac tinh nang da tich hop de de bao tri, mo rong va kiem tra lai logic lam sang.

## 1. Quick Calculation

### 1.1 Surgical Plan - SMILE Pro Minimum Thickness

- Vi tri: `static/dongdo.js`
- Khu vuc UI: `4. Surgical Plan`
- Hien thi dong:
  - `Minimum Thickness (um)`
  - `Lenticule (Zeiss Forum)`
- Chi hien thi khi `Procedure = SMILE Pro`.
- Gia tri mac dinh: `15 um`.
- Gioi han nhap:
  - Minimum: `10 um`
  - Maximum: `35 um`
- Logic tinh dong:
  - `Lenticule (Zeiss Forum) = Lenticule goc + (Minimum Thickness - 15)`
  - Tang Minimum Thickness bao nhieu thi Lenticule tang bay nhieu.
  - Giam Minimum Thickness bao nhieu thi Lenticule giam bay nhieu.
- Sync:
  - Khi doi `Procedure`, `OZ`, `Cap/Flap`, `Incision`, `Minimum Thickness` o OD thi OS tu dong dong bo theo.
- Luu y:
  - Khong thay doi bang nomogram goc cua `calcAblationDepth`.

### 1.2 PTA Recalculation With SMILE Pro Lenticule

- Vi tri: `static/dongdo.js`
- Ap dung khi `Procedure = SMILE Pro`.
- PTA dung do day mo sau khi dieu chinh:
  - `ptaTissueDepth = Lenticule (Zeiss Forum)`
- Cac procedure khac van dung:
  - `ptaTissueDepth = Ablation`
- Khi thay doi `Minimum Thickness`, he thong goi tinh lai ket qua ngay lap tuc cho OD va OS.
- Luu y:
  - Khong thay doi cong thuc PTA goc:
    - `PTA = (Cap/Flap + Tissue Depth) / CCT * 100`

### 1.3 Corneal Thickness Asymmetry Warning

- Vi tri:
  - `static/dongdo.js`
  - `calculations.py`
- Du lieu:
  - `Thinnest Point (um)`
  - `CCT (um)`
- Dieu kien:
  - `CCT - Thinnest Point >= 15 um`
- UI:
  - Doi mau vien/nen hai o `Thinnest Point` va `CCT`.
  - Hien banner trong `Calculation Results`.
- Noi dung banner:
  - `Corneal Thickness Risk: CCT - Thinnest Point >= 15 um (Check for Ectasia/Keratoconus risk).`
- Muc dich:
  - Nhac bac si kiem tra lai ban do pachymetry, nguy co ectasia/keratoconus.

### 1.4 HOA RMS Warning

- Vi tri: `static/dongdo.js`
- Du lieu:
  - `HOA RMS (um)`
- Nguong:
  - `< 0.39`: binh thuong, mau xanh.
  - `0.40 - 0.55`: warning, mau vang/cam.
  - `> 0.55`: danger, mau do.
- UI:
  - Doi mau truc tiep o input `HOA RMS`.
  - Hien banner trong `Calculation Results` neu warning/danger.
- Noi dung banner:
  - Warning: `HOA Warning: High-Order Aberrations (0.40 - 0.55 um) - Monitor corneal surface.`
  - Danger: `HOA Danger: HOA RMS > 0.55 um - Requires Corneal Topography Re-evaluation.`

### 1.5 TBUT Dry Eye Warning

- Vi tri: `static/dongdo.js`
- Du lieu:
  - `TBUT (sec)`
- Nguong banner trong `Calculation Results`:
  - `< 5 sec`: danger.
  - `5 <= TBUT <= 7 sec`: warning.
  - `> 8 sec`: khong hien banner.
- Noi dung banner:
  - Warning: `Dry Eye Risk: Mild to Moderate Dry Eye (TBUT 5-7 sec) - Consider Pre-op Lubricants.`
  - Danger: `Severe Dry Eye: Severe Dry Eye (TBUT < 5 sec) - Treat ocular surface before refractive surgery.`
- Luu y:
  - Banner nay chi hien khi `Calculation Results` da du dieu kien hien thi.

### 1.6 Post-op K Danger Banner

- Vi tri: `static/dongdo.js`
- Cong thuc giu nguyen:
  - `Pre-op K Mean = (Pre-op K1 + Pre-op K2) / 2`
  - `Total Treatment = |Sphere| + |Cylinder|`
  - `Delta K = Total Treatment * 0.8`
  - `Post-op K = Pre-op K Mean - Delta K`
- Nguong duy nhat:
  - `Post-op K < 34 D`: hien banner danger.
  - `Post-op K >= 34 D`: an banner.
- Noi dung banner:
  - `Canh bao Post-op K: [value] D - Anh huong chat luong thi giac`
- Luu y:
  - Tinh doc lap cho OD va OS.
  - Khong thay doi logic Post-K1/Post-K2 cu dang hien thi trong nhom Biometrics/print.

## 2. Phakic IOL Calculation

### 2.1 English UI Localization

- Vi tri:
  - `templates/index.html`
  - `static/app.js`
- Cac label chinh:
  - `Phakic IOL Calculation`
  - `Patient Information`
  - `Right Eye (OD)`
  - `Left Eye (OS)`
  - `Maximum Spectacle Refraction`
  - `Phakic ICL Biometrics`
  - `Recommended Size`
  - `Predicted Vault`
  - `ICL Sph Power`
  - `ICL Cyl Power`
  - `Target Axis`
  - `Axis Simulation`

### 2.2 Phakic ICL Biometrics Layout

- Vi tri: `static/app.js`
- Cau truc:
  - Hang 1: `WTW`, `ATA`, `ACD`, `AqD`
  - Hang 2: `K1`, `K2`, `ECD`, `ACA`
- Da loai bo input thu cong:
  - `ICL Sph`
  - `ICL Cyl`
  - `ICL Axis`
  - `ICL Size`
  - `Lens Type`

### 2.3 ATA-Based ICL Sizing

- Vi tri: `calculations.py`
- Ham:
  - `calculate_icl_sizing(wtw, acd, ata=None)`
  - `predict_vault(selected_size, ata)`
- Logic ATA:
  - `Ideal Size = ATA + 0.7 mm`
  - Lam tron ve size STAAR gan nhat:
    - `12.1`
    - `12.6`
    - `13.2`
    - `13.7`
- Vault du kien:
  - `Vault = (selected_size - ATA) * 500`
- Canh bao vault:
  - `< 250 um`: Low Vault risk.
  - `> 750 um`: High Vault risk.

### 2.4 Phakic Result Cards

- Vi tri:
  - `static/app.js`
  - `static/styles.css`
- Cac card ket qua:
  - `Recommended Size`
  - `Predicted Vault`
  - `ICL Sph Power`
  - `ICL Cyl Power`
  - `Target Axis`
  - `Lens Model`
- Lens model tam thoi:
  - Co cylinder: `EVO+ Toric`
  - Khong cylinder: `EVO+`

### 2.5 Vault Gauge

- Vi tri:
  - `static/app.js`
  - `static/styles.css`
- Dai gauge:
  - 0-1000 um.
  - Vung an toan: `250-750 um`.
  - Marker di chuyen theo `Predicted Vault`.

### 2.6 Axis Simulation

- Vi tri: `static/app.js`
- UI:
  - Canvas ve mo phong truc dat kinh.
- Du lieu:
  - `Target Axis`
- Vi du:
  - Axis `180` hien duong nam ngang.

### 2.7 ATA Measurement Guide

- Vi tri:
  - `templates/index.html`
  - `static/img/ATA.jpg`
- Anh huong dan:
  - `static/img/ATA.jpg`

## 3. Backend/API

### 3.1 Phakic API

- Vi tri: `app.py`
- Route:
  - `POST /api/calculate-phakic`
- Input:
  - JSON OD/OS gom refraction va biometrics.
- Output:
  - `recommended_size`
  - `predicted_vault_um`
  - `calculated_power`
  - `calculated_cyl_power`
  - `target_axis`
  - `vault_warnings`

### 3.2 Calculations Module

- Vi tri: `calculations.py`
- Cac ham Phakic chinh:
  - `calculate_icl_sizing`
  - `calculate_icl_size`
  - `predict_vault`
  - `calculate_icl_power`
  - `calculate_phakic_eye`
- Luu y:
  - Cac cong thuc laser/Quick Calculation cu khong duoc thay doi ngoai cac nguong canh bao duoc ghi trong file nay.

## 4. Static Assets

### 4.1 ATA Image

- Vi tri dung trong app:
  - `static/img/ATA.jpg`
- Ghi chu:
  - File `ATA.jpg` o root neu co chi la artifact trung lap, app khong dung duong dan nay.

