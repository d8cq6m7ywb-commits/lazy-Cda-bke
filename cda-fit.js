// ---------- PHYSICAL CONSTANTS ----------
const PHYS = {
  g:       9.80665,
  P0:      101325,     // standard sea-level pressure (Pa)
  T0:      288.15,     // standard sea-level temperature (K)
  L:       0.0065,     // temperature lapse rate (K/m)
  M:       0.0289652,  // molar mass of dry air (kg/mol)
  R:       8.314462618,// universal gas constant (J/(mol·K))
  Rd:      287.058,    // specific gas constant for dry air (J/(kg·K))
  Rv:      461.495     // specific gas constant for water vapour (J/(kg·K))
};

// ---------- SHARED: AIR DENSITY (single source of truth) ----------
function computeAirDensity(altitude, tempC, rhPct, pressureOverride) {
  const Tkelvin = tempC + 273.15;
  const pressurePa = (pressureOverride > 0)
    ? pressureOverride * 100
    : PHYS.P0 * Math.pow(1 - (PHYS.L * altitude) / PHYS.T0,
                          (PHYS.g * PHYS.M) / (PHYS.R * PHYS.L));

  // Default: dry air via ideal gas
  let rho = (PHYS.M * pressurePa) / (PHYS.R * Tkelvin);

  // If humidity is provided, use moist-air equation
  if (rhPct !== null) {
    const es_hPa = 6.1094 * Math.exp(17.625 * tempC / (tempC + 243.04)); // Magnus-Tetens
    const es = es_hPa * 100;                                // saturation vapour pressure (Pa)
    const e  = Math.min(es, Math.max(0, (rhPct / 100) * es)); // actual vapour pressure
    const pd = Math.max(0, pressurePa - e);                   // partial pressure dry air
    rho = (pd / (PHYS.Rd * Tkelvin)) + (e / (PHYS.Rv * Tkelvin));
  }

  return { rho, pressurePa };
}

// ---------- SHARED: READ COMMON UI INPUTS ----------
function readCommonInputs() {
  const unit = document.getElementById("unit").value;
  const pmLocation = document.getElementById("pmLocation").value;

  let altitude        = +document.getElementById("altitude").value || 0;
  let tempC           = +document.getElementById("tempC").value || 0;
  let rhField         = document.getElementById("rhPct").value;
  let rhPct           = rhField === "" ? null : Math.min(Math.max(+rhField, 0), 100);
  let pressureOverride = +document.getElementById("pOverride").value;

  let riderWeight = +document.getElementById("rider-weight-kg").value || 0;
  let clothesGear = +document.getElementById("clothes-gear-kg").value || 0;
  let bikeWeight  = +document.getElementById("bike-weight-kg").value || 0;

  let wind = +document.getElementById("wind-kmh").value || 0;
  let crr  = +document.getElementById("crr_rolling").value || 0.0036;
  let drivetrainEff = (+document.getElementById("driveTrainEfficiency").value || 98) / 100;

  if (unit === "imperial") {
    riderWeight /= 2.20462;
    clothesGear /= 2.20462;
    bikeWeight  /= 2.20462;
    wind *= 1.60934;
  }

  const totalMass = riderWeight + clothesGear + bikeWeight;
  const { rho, pressurePa } = computeAirDensity(altitude, tempC, rhPct, pressureOverride);
  const windMs = wind / 3.6;

  return {
    unit, pmLocation,
    altitude, tempC, rhPct, pressureOverride,
    riderWeight, clothesGear, bikeWeight, totalMass,
    wind, windMs,
    crr, drivetrainEff,
    rho, pressurePa
  };
}

// ---------- SINGLE-POINT CDA CALCULATOR ----------
function switchUnit() { calculateResult(); }

function showWarning(msg) {
  const w = document.getElementById("warn");
  w.textContent = msg;
  w.style.display = "block";
}

function clearWarning() {
  const w = document.getElementById("warn");
  w.style.display = "none";
  w.textContent = "";
}

function calculateResult() {
  clearWarning();
  const inp = readCommonInputs();

  let distance = +document.getElementById("distance-km").value || 1;
  let climb    = +document.getElementById("total-climb-m").value || 0;

  if (inp.unit === "imperial") {
    distance *= 1.60934;
    climb    /= 3.28084;
  }

  let timeH = (+document.getElementById("hh").value || 0)
            + (+document.getElementById("mm").value || 0) / 60
            + (+document.getElementById("ss").value || 0) / 3600;
  timeH = Math.max(timeH, 0.0001);

  let power = +document.getElementById("power").value || 0;

  // Speeds
  const speedKmH = distance / timeH;
  const v_g   = speedKmH * (1000 / 3600);     // ground speed (m/s)
  const v_as  = Math.max(0, v_g + inp.windMs); // airspeed (m/s)

  // Grade: slopeFraction = rise / road_distance ≈ sin(theta) for GPS distance
  // For safety use proper trig regardless
  const slopeFraction = climb / (distance * 1000);
  const cosTheta = 1 / Math.sqrt(1 + slopeFraction * slopeFraction);
  const sinTheta = slopeFraction * cosTheta;   // FIX #4: use sin(theta) for climb power

  // Resistive powers
  const powerRolling = PHYS.g * inp.totalMass * inp.crr * cosTheta * v_g;
  const powerClimb   = PHYS.g * inp.totalMass * sinTheta * v_g;  // FIX #4

  // Power at wheel (depends on PM location)
  const powerAtWheel = (inp.pmLocation === "crank")
    ? power * inp.drivetrainEff
    : power;

  const powerAero = powerAtWheel - powerRolling - powerClimb;
  const denom     = 0.5 * inp.rho * v_as * v_as * v_g;

  if (denom <= 0 || powerAero <= 0) {
    document.getElementById("cda").textContent = "—";
    showWarning("Infeasible inputs: aero power \u2264 0 (or zero airspeed). Check wind sign, climb, Crr, power, and time/distance.");
  } else {
    const cda = powerAero / denom;
    document.getElementById("cda").textContent = cda.toFixed(3);
  }

  // Outputs
  document.getElementById("speed").textContent =
    `${speedKmH.toFixed(2)} ${inp.unit === 'imperial' ? 'mph' : 'km/h'}`;
  document.getElementById("slopeGrade").textContent =
    (slopeFraction * 100).toFixed(4) + " %";
  document.getElementById("rhoUsed").textContent =
    `${inp.rho.toFixed(4)} kg/m\u00b3`;
  document.getElementById("pressureUsed").textContent =
    `${(inp.pressurePa / 100).toFixed(1)} hPa`;
}

document.addEventListener("DOMContentLoaded", function() {
  resetValues();

  const fitInput = document.getElementById("fitFileInput");
  if (fitInput) {
    fitInput.addEventListener("change", handleFitFileSelect);
  }

  const modeSel = document.getElementById("analysisMode");
  if (modeSel) {
    modeSel.addEventListener("change", syncLapCheckboxMode);
  }
});

function resetValues() {
  document.getElementById("unit").value = "metric";
  document.getElementById("pmLocation").value = "crank";
  document.getElementById("altitude").value = 100;
  document.getElementById("tempC").value = 20;
  document.getElementById("rhPct").value = "";
  document.getElementById("pOverride").value = "";

  document.getElementById("rider-weight-kg").value = 70;
  document.getElementById("clothes-gear-kg").value = 1;
  document.getElementById("bike-weight-kg").value = 9;

  document.getElementById("distance-km").value = 30;
  document.getElementById("total-climb-m").value = 0;
  document.getElementById("wind-kmh").value = 0;

  document.getElementById("power").value = 180;
  document.getElementById("crr_rolling").value = 0.0036;
  document.getElementById("driveTrainEfficiency").value = 98;

  document.getElementById("hh").value = 1;
  document.getElementById("mm").value = 0;
  document.getElementById("ss").value = 0;

  clearWarning();
  calculateResult();
}

// ---------- SHARED ENVIRONMENT FOR FIT ANALYZER ----------
function getEnvParamsForSamples() {
  const inp = readCommonInputs();   // FIX #1: uses shared air density + input reading

  return {
    rho:        inp.rho,
    totalMass:  inp.totalMass,
    crr:        inp.crr,
    g:          PHYS.g,
    windMs:     inp.windMs,
    powerAtWheelFactor: (inp.pmLocation === "crank") ? inp.drivetrainEff : 1
  };
}

// ---------- FIT FILE CDA ANALYZER ----------
let currentFitData = null;
let fitScatterChart = null;
let fitTimeChart = null;
let lastAnalysis = null;   // store for CSV export

function resolveFitParserCtor() {
  const w = window;
  const fromDirect = w.FitParser;
  const fromFitObj = w.FIT && w.FIT.FitParser;

  const ctor = (typeof fromDirect === "function") ? fromDirect :
               (typeof fromFitObj === "function") ? fromFitObj :
               null;

  if (!ctor) {
    console.error("FitParser global not found on window:", {
      FitParser: w.FitParser,
      FIT: w.FIT
    });
  }
  return ctor;
}

function handleFitFileSelect(evt) {
  const file     = evt.target.files && evt.target.files[0];
  const statusEl = document.getElementById("fitStatus");
  const lapBody  = document.getElementById("lapTableBody");
  const summaryEl = document.getElementById("fitSummary");
  const statsTable = document.getElementById("fitStatsTable");
  const statsBody  = document.getElementById("fitStatsBody");

  if (lapBody)   lapBody.innerHTML = "";
  if (summaryEl) summaryEl.textContent = "";
  if (statsBody) statsBody.innerHTML = "";
  if (statsTable) statsTable.style.display = "none";

  if (!file) {
    statusEl.textContent = "";
    currentFitData = null;
    return;
  }

  const FitParserCtor = resolveFitParserCtor();
  if (!FitParserCtor) {
    statusEl.textContent = "FIT parser not found (bundle.js).";
    currentFitData = null;
    return;
  }

  statusEl.textContent = `Reading ${file.name}\u2026`;

  const reader = new FileReader();
  reader.onload = function(e) {
    const buffer = e.target.result;
    try {
      const fitParser = new FitParserCtor({
        force: true,
        speedUnit: "m/s",
        lengthUnit: "m",
        temperatureUnit: "celsius",
        mode: "cascade",
        elapsedRecordField: true
      });

      fitParser.parse(buffer, function(error, data) {
        if (error) {
          console.error(error);
          statusEl.textContent = "Error parsing FIT file.";
          currentFitData = null;
          return;
        }
        currentFitData = normaliseFitDataFromFitParser(data);
        statusEl.textContent =
          `Parsed ${currentFitData.records.length} records, ${currentFitData.laps.length} laps.`;
        renderLapTable(currentFitData.laps, getEnvParamsForSamples(), readFilterConfig());
        syncLapCheckboxMode();
      });
    } catch(err) {
      console.error(err);
      statusEl.textContent = "Exception while parsing FIT file.";
      currentFitData = null;
    }
  };
  reader.onerror = function() {
    statusEl.textContent = "Error reading file.";
    currentFitData = null;
  };
  reader.readAsArrayBuffer(file);
}

function toNumber(x) {
  const v = (typeof x === "object" && x !== null && "value" in x) ? x.value : x;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function normaliseRecord(r) {
  const speed   = toNumber(r.speed)    ?? toNumber(r.enhanced_speed) ?? null;
  const dist    = toNumber(r.distance) ?? toNumber(r.total_distance) ?? null;
  const alt     = toNumber(r.altitude) ?? toNumber(r.enhanced_altitude) ?? null;
  const power   = toNumber(r.power) ?? 0;
  const cadence = toNumber(r.cadence);
  const ts      = r.timestamp ? new Date(r.timestamp) : null;

  return {
    t: ts,
    distance: dist,
    speed: speed,
    altitude: alt,
    power: power,
    cadence: cadence,
    grade: 0
  };
}

// FIX #2: smooth altitude before computing grade to reduce GPS noise
function addGradeFromAlt(records, windowSize) {
  if (!records || records.length < 2) return;
  if (windowSize == null) windowSize = 7;

  // Step 1: smooth altitude with centred moving average
  const rawAlt = records.map(r => r.altitude);
  const smoothed = rawAlt.map((_, i) => {
    const half = Math.floor(windowSize / 2);
    const lo   = Math.max(0, i - half);
    const hi   = Math.min(rawAlt.length - 1, i + half);
    let sum = 0, count = 0;
    for (let j = lo; j <= hi; j++) {
      if (rawAlt[j] != null) { sum += rawAlt[j]; count++; }
    }
    return count ? sum / count : null;
  });

  // Step 2: compute grade from smoothed altitude and distance deltas
  for (let i = 1; i < records.length; i++) {
    const r0 = records[i - 1], r1 = records[i];
    const d_m  = (r1.distance != null && r0.distance != null)
      ? (r1.distance - r0.distance) : 0;
    const dz_m = (smoothed[i] != null && smoothed[i - 1] != null)
      ? (smoothed[i] - smoothed[i - 1]) : 0;
    r1.grade = (d_m > 1) ? (dz_m / d_m) : 0;
  }
  records[0].grade = records[1].grade;
}

/**
 * Normaliser:
 * 1) Collect all records into a flat array.
 * 2) Reconstruct laps from lap objects (Garmin etc.).
 * 3) Fall back to a single synthetic lap if needed.
 */
function normaliseFitDataFromFitParser(data) {
  // collect all records (deep traversal)
  function collectAllRecords(node, out) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) collectAllRecords(item, out);
      return;
    }
    for (const key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      const val = node[key];
      if ((key === "records" || key === "record") && Array.isArray(val)) {
        out.push(...val);
      } else {
        collectAllRecords(val, out);
      }
    }
  }

  const rawRecords = [];
  collectAllRecords(data, rawRecords);

  const records = rawRecords.map(normaliseRecord);
  if (records.length) {
    addGradeFromAlt(records);  // uses smoothed altitude now
  }

  // collect lap-like objects
  function looksLikeLap(obj) {
    if (!obj || typeof obj !== "object") return false;
    const hasDist = ("total_distance" in obj) || ("total_timer_distance" in obj);
    const hasTime = ("total_timer_time" in obj) || ("start_time" in obj) || ("timestamp" in obj);
    return hasDist && hasTime;
  }

  function collectLapCandidates(node, out) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) collectLapCandidates(item, out);
      return;
    }
    for (const key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      const val = node[key];
      if (Array.isArray(val) && (key === "laps" || key === "lap")) {
        val.forEach(v => { if (looksLikeLap(v)) out.push(v); });
      } else if (typeof val === "object" && val) {
        collectLapCandidates(val, out);
      }
    }
  }

  const lapCandidates = [];
  collectLapCandidates(data, lapCandidates);

  let laps = [];

  if (records.length) {
    if (lapCandidates.length >= 1) {
      const normLaps = lapCandidates.map((lap) => {
        const startRaw = lap.start_time || lap.timestamp || null;
        const start = startRaw ? new Date(startRaw) : null;
        const tt = toNumber(lap.total_timer_time);
        let end = null;
        if (start && tt != null) {
          end = new Date(start.getTime() + tt * 1000);
        }

        const totalDistance =
          toNumber(lap.total_distance) ??
          toNumber(lap.total_timer_distance) ??
          null;

        const avgSpeed = toNumber(lap.avg_speed) ?? null;
        const avgPower = toNumber(lap.avg_power) ?? null;

        return { start, end, totalDistance, totalTimerTime: tt, avgSpeed, avgPower };
      }).filter(l => l.start);

      normLaps.sort((a, b) => a.start - b.start);

      // fill missing ends
      for (let i = 0; i < normLaps.length; i++) {
        if (!normLaps[i].end) {
          const next = normLaps[i + 1];
          if (next && next.start) {
            normLaps[i].end = new Date(next.start.getTime() - 1000);
          }
        }
      }
      const lastRecTime = records.length ? records[records.length - 1].t : null;
      const lastLap = normLaps[normLaps.length - 1];
      if (lastLap && !lastLap.end && lastRecTime) {
        lastLap.end = lastRecTime;
      }

      laps = normLaps.map((lap, idx) => {
        const lapRecs = records.filter(r =>
          r.t && lap.start && lap.end && r.t >= lap.start && r.t <= lap.end
        );

        let totalDistance = lap.totalDistance;
        if (lapRecs.length && totalDistance == null) {
          const firstD = lapRecs[0].distance;
          const lastD  = lapRecs[lapRecs.length - 1].distance;
          if (lastD != null) {
            totalDistance =
              (firstD != null && lastD >= firstD) ? (lastD - firstD) : lastD;
          }
        }

        let totalTimerTime = lap.totalTimerTime;
        if (lapRecs.length && (!isFinite(totalTimerTime) || totalTimerTime == null)) {
          const firstT = lapRecs[0].t;
          const lastT  = lapRecs[lapRecs.length - 1].t;
          if (firstT && lastT) {
            totalTimerTime = (lastT - firstT) / 1000;
          }
        }

        let avgPower = lap.avgPower;
        if (lapRecs.length && (!isFinite(avgPower) || avgPower == null)) {
          let sumP = 0, nP = 0;
          for (const r of lapRecs) {
            if (r.power != null && isFinite(r.power)) { sumP += r.power; nP++; }
          }
          avgPower = nP ? sumP / nP : null;
        }

        let avgSpeed = lap.avgSpeed;
        if ((avgSpeed == null || !isFinite(avgSpeed)) &&
            totalTimerTime && totalDistance) {
          avgSpeed = totalDistance / totalTimerTime;
        }

        return {
          index: idx,
          displayIndex: idx + 1,
          use: true,
          totalDistance,
          totalTimerTime,
          avgSpeed,
          avgPower,
          records: lapRecs
        };
      }).filter(l => l.records.length > 0);
    }

    // Fallback: single synthetic lap
    if (!laps.length) {
      const first = records[0];
      const last  = records[records.length - 1];

      let totalDistance = null;
      if (last.distance != null) {
        if (first.distance != null && last.distance >= first.distance) {
          totalDistance = last.distance - first.distance;
        } else {
          totalDistance = last.distance;
        }
      }

      let totalTimerTime = null;
      if (first.t && last.t) {
        totalTimerTime = (last.t - first.t) / 1000;
      }

      let sumP = 0, nP = 0;
      for (const r of records) {
        if (r.power != null && isFinite(r.power)) { sumP += r.power; nP++; }
      }
      const avgPower = nP ? sumP / nP : null;

      laps.push({
        index: 0,
        displayIndex: 1,
        use: true,
        totalDistance: totalDistance,
        totalTimerTime: totalTimerTime,
        avgSpeed: null,
        avgPower: avgPower,
        records: records
      });
    }
  }

  return { laps, records };
}

// Compute median CdA for a single lap's records
function computeLapMedianCdA(lapRecords, env, cfg) {
  const cdas = [];
  for (let i = 0; i < lapRecords.length; i++) {
    const rec = lapRecords[i];
    if (!isUsableRecord(rec, cfg)) continue;
    const prevRec = (i > 0) ? lapRecords[i - 1] : null;
    const cda = computeCdAForRecord(rec, prevRec, env);
    if (isFinite(cda) && cda >= cfg.minCdA && cda <= cfg.maxCdA) cdas.push(cda);
  }
  if (!cdas.length) return null;
  cdas.sort((a, b) => a - b);
  return cdas[Math.floor(cdas.length * 0.5)];
}

function renderLapTable(laps, env, cfg) {
  const body = document.getElementById("lapTableBody");
  if (!body) return;
  body.innerHTML = "";
  if (!laps || !laps.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "No laps found in file.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  const maxDist = Math.max(...laps.map(l => l.totalDistance || 0));

  laps.forEach(lap => {
    const tr = document.createElement("tr");
    const distKm = lap.totalDistance != null ? (lap.totalDistance / 1000) : null;
    const timeMin = lap.totalTimerTime != null ? (lap.totalTimerTime / 60) : null;
    const useDefault = !maxDist || (lap.totalDistance && lap.totalDistance > 0.3 * maxDist);

    let lapSpeedKmh = null;
    if (distKm != null && timeMin != null && timeMin > 0.01) {
      lapSpeedKmh = distKm / (timeMin / 60);
    } else if (lap.avgSpeed != null) {
      lapSpeedKmh = lap.avgSpeed * 3.6;
    }

    // Per-lap median CdA
    let lapCdaStr = "\u2013";
    if (env && cfg && lap.records && lap.records.length) {
      const med = computeLapMedianCdA(lap.records, env, cfg);
      if (med != null) lapCdaStr = med.toFixed(3);
    }

    tr.innerHTML = `
      <td>${lap.displayIndex}</td>
      <td><input type="checkbox" class="lap-use" data-lap-index="${lap.index}" ${useDefault ? "checked" : ""}></td>
      <td>${distKm != null ? distKm.toFixed(2) : "\u2013"}</td>
      <td>${timeMin != null ? timeMin.toFixed(1) : "\u2013"}</td>
      <td>${lapSpeedKmh != null && isFinite(lapSpeedKmh) ? lapSpeedKmh.toFixed(1) + " km/h" : "\u2013"}</td>
      <td>${lap.avgPower != null ? lap.avgPower.toFixed(0) + " W" : "\u2013"}</td>
      <td>${lapCdaStr}</td>
    `;
    body.appendChild(tr);
  });
}

/** Force all laps checked + disabled in race mode; re-enable in lap mode */
function syncLapCheckboxMode() {
  const modeSel = document.getElementById("analysisMode");
  if (!modeSel) return;
  const mode = modeSel.value;
  const checkboxes = document.querySelectorAll(".lap-use");
  checkboxes.forEach(cb => {
    if (mode === "race") {
      cb.checked = true;
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
  });
}

// FIX #3: rolling-window smoothing on speed and power before CdA computation
function smoothRecords(records, windowSec) {
  if (!windowSec || windowSec <= 1) return records;
  const halfMs = (windowSec / 2) * 1000;

  return records.map((rec, i) => {
    if (rec.t == null) return rec;
    const tMs = rec.t.getTime();
    let sumS = 0, sumP = 0, n = 0;

    // Look backward
    for (let j = i; j >= 0; j--) {
      if (!records[j].t) break;
      if (tMs - records[j].t.getTime() > halfMs) break;
      if (records[j].speed != null) sumS += records[j].speed;
      if (records[j].power != null) sumP += records[j].power;
      n++;
    }
    // Look forward (skip index i to avoid double-count)
    for (let j = i + 1; j < records.length; j++) {
      if (!records[j].t) break;
      if (records[j].t.getTime() - tMs > halfMs) break;
      if (records[j].speed != null) sumS += records[j].speed;
      if (records[j].power != null) sumP += records[j].power;
      n++;
    }

    if (!n) return rec;
    return Object.assign({}, rec, {
      speed: sumS / n,
      power: sumP / n
    });
  });
}

// FIX #6: read configurable filter values from UI (with fallback defaults)
function readFilterConfig() {
  const el = id => document.getElementById(id);
  return {
    minSpeedKmh: +(el("cfgMinSpeed")  ? el("cfgMinSpeed").value  : 10),
    maxSpeedKmh: +(el("cfgMaxSpeed")  ? el("cfgMaxSpeed").value  : 65),
    minPowerW:   +(el("cfgMinPower")  ? el("cfgMinPower").value  : 80),
    maxPowerW:   +(el("cfgMaxPower")  ? el("cfgMaxPower").value  : 900),
    maxAbsGrade: +(el("cfgMaxGrade")  ? el("cfgMaxGrade").value  : 6) / 100,
    minCdA:      +(el("cfgMinCdA")    ? el("cfgMinCdA").value    : 0.10),
    maxCdA:      +(el("cfgMaxCdA")    ? el("cfgMaxCdA").value    : 0.50)
  };
}

function runFitAnalysis() {
  const statusEl   = document.getElementById("fitStatus");
  const summaryEl  = document.getElementById("fitSummary");
  const statsTable = document.getElementById("fitStatsTable");
  const statsBody  = document.getElementById("fitStatsBody");

  if (!currentFitData) {
    statusEl.textContent = "No FIT file parsed yet.";
    return;
  }

  const mode   = document.getElementById("analysisMode").value;
  const env    = getEnvParamsForSamples();
  const config = readFilterConfig();   // FIX #6: configurable filters

  // Read smoothing window from UI
  const smoothEl  = document.getElementById("smoothWindow");
  const smoothSec = smoothEl ? +smoothEl.value : 0;

  let records = [];

  if (mode === "laps") {
    const checkboxes = document.querySelectorAll(".lap-use");
    const idxSet = new Set();
    checkboxes.forEach(cb => {
      if (cb.checked) {
        const idx = Number(cb.getAttribute("data-lap-index"));
        idxSet.add(idx);
      }
    });
    currentFitData.laps.forEach(lap => {
      if (idxSet.has(lap.index)) {
        records.push(...lap.records);
      }
    });
  } else {
    records = currentFitData.records.slice();
  }

  if (!records.length) {
    statusEl.textContent = "No records in selected laps.";
    return;
  }

  // FIX #3: apply rolling smoothing
  const smoothed = smoothRecords(records, smoothSec);

  const analysis = analyseCdAFromRecords(smoothed, env, config);
  lastAnalysis = analysis;   // store for CSV export
  renderFitAnalysis(analysis, summaryEl, statsTable, statsBody);
  statusEl.textContent =
    `Used ${analysis.countAll} samples after filtering` +
    (smoothSec > 1 ? ` (${smoothSec}s smoothing).` : `.`);

  // Re-render lap table with per-lap CdA now that env/config are known
  renderLapTable(currentFitData.laps, env, config);
  syncLapCheckboxMode();

  renderFitScatter(analysis);
  renderFitTimeSeries(analysis.points);
}

function isUsableRecord(rec, cfg) {
  if (rec.speed == null || rec.power == null) return false;
  const v_kmh = rec.speed * 3.6;
  const p     = rec.power;
  const grade = rec.grade || 0;
  if (!isFinite(v_kmh) || v_kmh < cfg.minSpeedKmh || v_kmh > cfg.maxSpeedKmh) return false;
  if (!isFinite(p)     || p < cfg.minPowerW     || p > cfg.maxPowerW)         return false;
  if (!isFinite(grade) || Math.abs(grade) > cfg.maxAbsGrade)                  return false;
  return true;
}

// FIX #4 + #5: proper sin/cos for grade, acceleration term
function computeCdAForRecord(rec, prevRec, env) {
  const v_g   = rec.speed;
  const v_air = Math.max(0, v_g + env.windMs);
  if (v_g <= 0 || v_air <= 0) return NaN;

  const grade    = rec.grade || 0;
  const cosTheta = 1 / Math.sqrt(1 + grade * grade);
  const sinTheta = grade * cosTheta;   // FIX #4: proper sin(theta) from grade
  const m   = env.totalMass;
  const g   = env.g;
  const crr = env.crr;
  const powerAtWheel = env.powerAtWheelFactor * rec.power;

  const pRoll  = g * m * crr * cosTheta * v_g;
  const pClimb = g * m * sinTheta * v_g;   // FIX #4

  // FIX #5: subtract kinetic power (acceleration)
  let pKinetic = 0;
  if (prevRec && prevRec.speed != null && prevRec.t && rec.t) {
    const dt = (rec.t - prevRec.t) / 1000;
    if (dt > 0 && dt < 5) {
      pKinetic = 0.5 * m * (v_g * v_g - prevRec.speed * prevRec.speed) / dt;
    }
  }

  const pAero = powerAtWheel - pRoll - pClimb - pKinetic;
  const denom = 0.5 * env.rho * v_air * v_air * v_g;

  if (denom <= 0 || pAero <= 0) return NaN;
  return pAero / denom;
}

function analyseCdAFromRecords(records, env, cfg) {
  const cdasAll      = [];
  const raceFlat     = [];
  const climbRelaxed = [];
  const transPoints  = [];       // FIX #7: "transition" grade 1-2%
  const points       = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!isUsableRecord(rec, cfg)) continue;

    const prevRec = (i > 0) ? records[i - 1] : null;   // FIX #5
    const cda = computeCdAForRecord(rec, prevRec, env);
    if (!isFinite(cda) || cda < cfg.minCdA || cda > cfg.maxCdA) continue;

    const v_kmh   = rec.speed * 3.6;
    const grade   = rec.grade || 0;
    const absGrade = Math.abs(grade);

    // FIX #7: explicit transition category instead of silent "other"
    const cat = (absGrade <= 0.01) ? "race"
              : (absGrade <= 0.02) ? "transition"
              : "climb";

    cdasAll.push(cda);
    if (cat === "race")       raceFlat.push({ cda, v_kmh });
    if (cat === "climb")      climbRelaxed.push({ cda, v_kmh });
    if (cat === "transition") transPoints.push({ cda, v_kmh });

    if (points.length < 4000) {
      points.push({
        cda, v_kmh, cat,
        grade: grade,
        power: rec.power,
        t: rec.t
      });
    }
  }

  function summarise(list) {
    if (!list.length) return { n: 0, median: null, p25: null, p75: null };
    const vals = list.map(x => x.cda).slice().sort((a, b) => a - b);
    const n      = vals.length;
    const median = vals[Math.floor(n * 0.5)];
    const p25    = vals[Math.floor(n * 0.25)];
    const p75    = vals[Math.floor(n * 0.75)];
    return { n, median, p25, p75 };
  }

  const allSummary   = summarise(cdasAll.map(x => ({ cda: x })));
  const raceSummary  = summarise(raceFlat);
  const climbSummary = summarise(climbRelaxed);
  const transSummary = summarise(transPoints);   // FIX #7

  function summariseHighSpeed(list, minSpeed) {
    const filtered = list.filter(p => p.v_kmh >= minSpeed);
    if (!filtered.length) return { n: 0, median: null, p25: null, p75: null };
    return summarise(filtered);
  }

  const raceHigh24 = summariseHighSpeed(raceFlat, 24);
  const raceHigh30 = summariseHighSpeed(raceFlat, 30);
  const raceHigh35 = summariseHighSpeed(raceFlat, 35);
  const raceHigh40 = summariseHighSpeed(raceFlat, 40);
  const climbHigh  = summariseHighSpeed(climbRelaxed, 24);

  return {
    countAll: cdasAll.length,
    allSummary,
    raceSummary,
    climbSummary,
    transSummary,
    raceHigh24,
    raceHigh30,
    raceHigh35,
    raceHigh40,
    climbHigh,
    points
  };
}

function renderFitAnalysis(a, summaryEl, statsTable, statsBody) {
  function fmt(v, digits) {
    return (v == null || !isFinite(v)) ? "\u2013" : v.toFixed(digits);
  }

  if (!a || !a.countAll) {
    summaryEl.textContent = "No usable samples after filtering.";
    statsTable.style.display = "none";
    statsBody.innerHTML = "";
    return;
  }

  const estRace  = a.raceHigh24.median ?? a.raceSummary.median;
  const estClimb = a.climbHigh.median  ?? a.climbSummary.median;

  summaryEl.innerHTML =
    `Estimated <strong>racing CdA</strong> (flat, \u226524 km/h where available): <strong>${fmt(estRace, 3)}</strong><br>` +
    `Estimated <strong>climbing / relaxed CdA</strong>: <strong>${fmt(estClimb, 3)}</strong><br>` +
    `<span style="font-size:0.9em;color:#555;">${a.countAll} samples used after filtering. ` +
    `Race flat: ${a.raceSummary.n}, transition: ${a.transSummary.n}, climb: ${a.climbSummary.n}.</span>`;

  const rows = [
    { label: "All usable",                 s: a.allSummary,    note: "all grades" },
    { label: "Race / flat",               s: a.raceSummary,   note: "|grade| \u2264 1%" },
    { label: "Race / flat, \u226524 km/h",     s: a.raceHigh24,    note: "subset of race" },
    { label: "Race / flat, \u226530 km/h",     s: a.raceHigh30,    note: "subset of race" },
    { label: "Race / flat, \u226535 km/h",     s: a.raceHigh35,    note: "subset of race" },
    { label: "Race / flat, \u226540 km/h",     s: a.raceHigh40,    note: "subset of race" },
    { label: "Transition",                s: a.transSummary,  note: "1% < |grade| \u2264 2%" },
    { label: "Climb / relaxed",           s: a.climbSummary,  note: "grade > 2%" },
    { label: "Climb / relaxed, \u226524 km/h", s: a.climbHigh,     note: "subset of climb" }
  ];

  statsBody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.label}</td>
      <td>${r.s.n}</td>
      <td>${fmt(r.s.median, 3)}</td>
      <td>${fmt(r.s.p25, 3)} \u2013 ${fmt(r.s.p75, 3)}</td>
      <td>${r.note}</td>
    `;
    statsBody.appendChild(tr);
  });
  statsTable.style.display = "table";
}

function renderFitScatter(analysis) {
  const canvas = document.getElementById("fitScatter");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const points = analysis.points;

  // Build datasets with full metadata for tooltips
  function mapPts(list) {
    return list.map(p => ({
      x: p.v_kmh, y: p.cda,
      _grade: p.grade, _power: p.power
    }));
  }

  const racePoints  = mapPts(points.filter(p => p.cat === "race"));
  const transP      = mapPts(points.filter(p => p.cat === "transition"));
  const climbPoints = mapPts(points.filter(p => p.cat === "climb"));

  if (fitScatterChart) fitScatterChart.destroy();

  // Median CdA for the horizontal reference line
  const medianCdA = analysis.raceHigh24.median ?? analysis.raceSummary.median;

  // Build annotation for median line (if chartjs-plugin-annotation is not loaded, use a simple dataset)
  const datasets = [
    {
      label: "Race / flat",
      data: racePoints,
      pointRadius: 3,
      pointHoverRadius: 5,
      backgroundColor: "rgba(54,162,235,0.4)",
      borderColor: "rgba(54,162,235,0.7)"
    },
    {
      label: "Transition (1\u20132%)",
      data: transP,
      pointRadius: 3,
      pointHoverRadius: 5,
      backgroundColor: "rgba(255,206,86,0.4)",
      borderColor: "rgba(255,206,86,0.7)"
    },
    {
      label: "Climb / relaxed",
      data: climbPoints,
      pointRadius: 3,
      pointHoverRadius: 5,
      backgroundColor: "rgba(255,99,132,0.4)",
      borderColor: "rgba(255,99,132,0.7)"
    }
  ];

  // Median reference line as a line dataset spanning the speed range
  if (medianCdA != null && isFinite(medianCdA)) {
    const allSpeeds = points.map(p => p.v_kmh);
    const minSpd = Math.min(...allSpeeds);
    const maxSpd = Math.max(...allSpeeds);
    datasets.push({
      label: `Median CdA ${medianCdA.toFixed(3)}`,
      data: [{ x: minSpd, y: medianCdA }, { x: maxSpd, y: medianCdA }],
      type: "line",
      borderColor: "rgba(0,0,0,0.5)",
      borderDash: [8, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false
    });
  }

  // Zoom plugin config
  const zoomOpts = (typeof Chart !== "undefined" && Chart.registry &&
    Chart.registry.plugins.get("zoom"))
    ? {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "xy"
        },
        pan: {
          enabled: true,
          mode: "xy"
        }
      }
    : {};

  fitScatterChart = new Chart(ctx, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Speed (km/h)" },
          ticks: { stepSize: 5 }
        },
        y: {
          title: { display: true, text: "CdA" },
          suggestedMin: 0.15,
          suggestedMax: 0.5
        }
      },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (tipCtx) => {
              const raw = tipCtx.raw;
              if (!raw) return "";
              const parts = [` ${raw.x.toFixed(1)} km/h, CdA ${raw.y.toFixed(3)}`];
              if (raw._grade != null) parts.push(`grade ${(raw._grade * 100).toFixed(1)}%`);
              if (raw._power != null) parts.push(`${raw._power.toFixed(0)} W`);
              return parts.join("  |  ");
            }
          }
        },
        ...zoomOpts
      }
    }
  });
}

// ---------- CDA OVER TIME CHART ----------
function renderFitTimeSeries(points) {
  const canvas = document.getElementById("fitTimeSeries");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");

  if (fitTimeChart) fitTimeChart.destroy();

  // Filter points that have timestamps
  const timed = points.filter(p => p.t != null).sort((a, b) => a.t - b.t);
  if (!timed.length) return;

  const t0 = timed[0].t.getTime();

  const raceT  = timed.filter(p => p.cat === "race").map(p => ({
    x: (p.t.getTime() - t0) / 60000, y: p.cda
  }));
  const transT = timed.filter(p => p.cat === "transition").map(p => ({
    x: (p.t.getTime() - t0) / 60000, y: p.cda
  }));
  const climbT = timed.filter(p => p.cat === "climb").map(p => ({
    x: (p.t.getTime() - t0) / 60000, y: p.cda
  }));

  const zoomOpts = (typeof Chart !== "undefined" && Chart.registry &&
    Chart.registry.plugins.get("zoom"))
    ? {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "xy"
        },
        pan: {
          enabled: true,
          mode: "xy"
        }
      }
    : {};

  fitTimeChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Race / flat",
          data: raceT,
          pointRadius: 2,
          backgroundColor: "rgba(54,162,235,0.4)"
        },
        {
          label: "Transition",
          data: transT,
          pointRadius: 2,
          backgroundColor: "rgba(255,206,86,0.4)"
        },
        {
          label: "Climb / relaxed",
          data: climbT,
          pointRadius: 2,
          backgroundColor: "rgba(255,99,132,0.4)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Time (minutes)" },
        },
        y: {
          title: { display: true, text: "CdA" },
          suggestedMin: 0.15,
          suggestedMax: 0.5
        }
      },
      plugins: {
        legend: { position: "top" },
        title: {
          display: true,
          text: "CdA over time",
          font: { size: 14 }
        },
        tooltip: {
          callbacks: {
            label: (tipCtx) => {
              const raw = tipCtx.raw;
              return ` ${raw.x.toFixed(1)} min, CdA ${raw.y.toFixed(3)}`;
            }
          }
        },
        ...zoomOpts
      }
    }
  });
}

// ---------- CSV EXPORT ----------
function exportStatsCSV() {
  if (!lastAnalysis || !lastAnalysis.countAll) {
    alert("No analysis results to export. Run the analysis first.");
    return;
  }
  const a = lastAnalysis;
  function fmt(v) { return (v == null || !isFinite(v)) ? "" : v.toFixed(4); }

  const rows = [
    ["Category", "Samples", "Median CdA", "P25", "P75", "Note"],
    ["All usable",             a.allSummary.n,    fmt(a.allSummary.median),    fmt(a.allSummary.p25),    fmt(a.allSummary.p75),    "all grades"],
    ["Race / flat",           a.raceSummary.n,   fmt(a.raceSummary.median),   fmt(a.raceSummary.p25),   fmt(a.raceSummary.p75),   "|grade| <= 1%"],
    ["Race / flat >= 24 km/h", a.raceHigh24.n,    fmt(a.raceHigh24.median),    fmt(a.raceHigh24.p25),    fmt(a.raceHigh24.p75),    "subset of race"],
    ["Race / flat >= 30 km/h", a.raceHigh30.n,    fmt(a.raceHigh30.median),    fmt(a.raceHigh30.p25),    fmt(a.raceHigh30.p75),    "subset of race"],
    ["Race / flat >= 35 km/h", a.raceHigh35.n,    fmt(a.raceHigh35.median),    fmt(a.raceHigh35.p25),    fmt(a.raceHigh35.p75),    "subset of race"],
    ["Race / flat >= 40 km/h", a.raceHigh40.n,    fmt(a.raceHigh40.median),    fmt(a.raceHigh40.p25),    fmt(a.raceHigh40.p75),    "subset of race"],
    ["Transition",            a.transSummary.n,  fmt(a.transSummary.median),  fmt(a.transSummary.p25),  fmt(a.transSummary.p75),  "1% < |grade| <= 2%"],
    ["Climb / relaxed",       a.climbSummary.n,  fmt(a.climbSummary.median),  fmt(a.climbSummary.p25),  fmt(a.climbSummary.p75),  "grade > 2%"],
    ["Climb >= 24 km/h",      a.climbHigh.n,     fmt(a.climbHigh.median),     fmt(a.climbHigh.p25),     fmt(a.climbHigh.p75),     "subset of climb"]
  ];

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cda-analysis.csv";
  link.click();
  URL.revokeObjectURL(url);
}
