// ---------- SINGLE-POINT CDA CALCULATOR ----------
function switchUnit(){ calculateResult(); }
function showWarning(msg){
  const w=document.getElementById("warn");
  w.textContent=msg;
  w.style.display="block";
}
function clearWarning(){
  const w=document.getElementById("warn");
  w.style.display="none";
  w.textContent="";
}

function calculateResult(){
  clearWarning();
  const unit=document.getElementById("unit").value;
  const pmLocation=document.getElementById("pmLocation").value;

  let altitude=+document.getElementById("altitude").value||0;
  let tempC=+document.getElementById("tempC").value||0;
  let rhField=document.getElementById("rhPct").value;
  let rhPct = rhField === "" ? null : Math.min(Math.max(+rhField,0),100);
  let pressureOverride=+document.getElementById("pOverride").value;

  let riderWeight=+document.getElementById("rider-weight-kg").value||0;
  let clothesGear=+document.getElementById("clothes-gear-kg").value||0;
  let bikeWeight=+document.getElementById("bike-weight-kg").value||0;

  let distance=+document.getElementById("distance-km").value||1;
  let climb=+document.getElementById("total-climb-m").value||0;
  let wind=+document.getElementById("wind-kmh").value||0; // headwind +, tailwind -

  if(unit==="imperial"){
    riderWeight/=2.20462; clothesGear/=2.20462; bikeWeight/=2.20462;
    distance*=1.60934; climb/=3.28084; wind*=1.60934;
  }

  let timeH=(+document.getElementById("hh").value||0)
           +(+document.getElementById("mm").value||0)/60
           +(+document.getElementById("ss").value||0)/3600;
  timeH=Math.max(timeH,0.0001);

  let power=+document.getElementById("power").value||0;
  let crr=+document.getElementById("crr_rolling").value||0.0036;
  let drivetrainEff=(+document.getElementById("driveTrainEfficiency").value||98)/100;

  // Speeds
  let speedKmH=distance/timeH;
  let v_g=speedKmH*(1000/3600);     // ground speed (m/s)
  let v_wind=(wind)/3.6;            // signed wind in m/s
  let v_as=Math.max(0, v_g + v_wind); // non-negative airspeed

  // Mass & grade
  let totalMass=riderWeight+clothesGear+bikeWeight;
  let g=9.80665;
  let slopeFraction= climb/(distance*1000);
  let cosTheta= 1/Math.sqrt(1 + slopeFraction*slopeFraction);

  // Standard atmosphere (troposphere) unless overridden
  const P0=101325, T0=288.15, L=0.0065, M=0.0289652, R=8.314462618;
  const Tkelvin=tempC+273.15;
  const pressurePa=(pressureOverride>0)
    ? pressureOverride*100
    : P0*Math.pow(1-(L*altitude)/T0,(g*M)/(R*L));

  // Air density: dry default; adjust for humidity if provided
  let rho=(M*pressurePa)/(R*Tkelvin); // dry
  if(rhPct!==null){
    const es_hPa=6.1094*Math.exp(17.625*tempC/(tempC+243.04)); // Magnus–Tetens
    const es=es_hPa*100;
    const e=Math.min(es, Math.max(0,(rhPct/100)*es));
    const pd=Math.max(0, pressurePa - e);
    const Rd=287.058, Rv=461.495;
    rho=(pd/(Rd*Tkelvin)) + (e/(Rv*Tkelvin));
  }

  // Resistive powers
  const powerRolling= g*totalMass*crr*cosTheta*v_g;
  const powerClimb  = g*totalMass*slopeFraction*v_g;

  // Power at wheel (depends on PM location)
  const powerAtWheel=(pmLocation==="crank") ? power*drivetrainEff : power;

  const powerAero = powerAtWheel - powerRolling - powerClimb;
  const denom = 0.5*rho*v_as*v_as*v_g;

  if(denom<=0 || powerAero<=0){
    document.getElementById("cda").textContent="—";
    showWarning("Infeasible inputs: aero power ≤ 0 (or zero airspeed). Check wind sign, climb, Crr, power, and time/distance.");
  } else {
    const cda = powerAero/denom;
    document.getElementById("cda").textContent=cda.toFixed(3);
  }

  // Outputs
  document.getElementById("speed").textContent =
    `${speedKmH.toFixed(2)} ${unit==='imperial' ? 'mph' : 'km/h'}`;
  document.getElementById("slopeGrade").textContent =
    (slopeFraction*100).toFixed(4)+" %";
  document.getElementById("rhoUsed").textContent =
    `${rho.toFixed(4)} kg/m³`;
  document.getElementById("pressureUsed").textContent =
    `${(pressurePa/100).toFixed(1)} hPa`;
}

document.addEventListener("DOMContentLoaded", function(){
  resetValues();

  const fitInput = document.getElementById("fitFileInput");
  if (fitInput) {
    fitInput.addEventListener("change", handleFitFileSelect);
  }

  const modeSel = document.getElementById("analysisMode");
  if (modeSel){
    modeSel.addEventListener("change", syncLapCheckboxMode);
  }
});

function resetValues(){
  document.getElementById("unit").value="metric";
  document.getElementById("pmLocation").value="crank";
  document.getElementById("altitude").value=100;
  document.getElementById("tempC").value=20;
  document.getElementById("rhPct").value="";
  document.getElementById("pOverride").value="";

  document.getElementById("rider-weight-kg").value=70;
  document.getElementById("clothes-gear-kg").value=1;
  document.getElementById("bike-weight-kg").value=9;

  document.getElementById("distance-km").value=30;
  document.getElementById("total-climb-m").value=0;
  document.getElementById("wind-kmh").value=0;

  document.getElementById("power").value=180;
  document.getElementById("crr_rolling").value=0.0036;
  document.getElementById("driveTrainEfficiency").value=98;

  document.getElementById("hh").value=1;
  document.getElementById("mm").value=0;
  document.getElementById("ss").value=0;

  clearWarning();
  calculateResult();
}

// ---------- SHARED ENVIRONMENT FOR FIT ANALYZER ----------
function getEnvParamsForSamples(){
  const unit=document.getElementById("unit").value;
  const pmLocation=document.getElementById("pmLocation").value;

  let altitude=+document.getElementById("altitude").value||0;
  let tempC=+document.getElementById("tempC").value||0;
  let rhField=document.getElementById("rhPct").value;
  let rhPct = rhField === "" ? null : Math.min(Math.max(+rhField,0),100);
  let pressureOverride=+document.getElementById("pOverride").value;

  let riderWeight=+document.getElementById("rider-weight-kg").value||0;
  let clothesGear=+document.getElementById("clothes-gear-kg").value||0;
  let bikeWeight=+document.getElementById("bike-weight-kg").value||0;

  let wind=+document.getElementById("wind-kmh").value||0;
  let crr=+document.getElementById("crr_rolling").value||0.0036;
  let drivetrainEff=(+document.getElementById("driveTrainEfficiency").value||98)/100;

  if(unit==="imperial"){
    riderWeight/=2.20462; clothesGear/=2.20462; bikeWeight/=2.20462;
    wind*=1.60934;
  }

  const totalMass=riderWeight+clothesGear+bikeWeight;
  const g=9.80665;

  const P0=101325, T0=288.15, L=0.0065, M=0.0289652, R=8.314462618;
  const Tkelvin=tempC+273.15;
  const pressurePa=(pressureOverride>0)
    ? pressureOverride*100
    : P0*Math.pow(1-(L*altitude)/T0,(g*M)/(R*L));

  let rho=(M*pressurePa)/(R*Tkelvin); // dry
  if(rhPct!==null){
    const es_hPa=6.1094*Math.exp(17.625*tempC/(tempC+243.04));
    const es=es_hPa*100;
    const e=Math.min(es, Math.max(0,(rhPct/100)*es));
    const pd=Math.max(0, pressurePa - e);
    const Rd=287.058, Rv=461.495;
    rho=(pd/(Rd*Tkelvin)) + (e/(Rv*Tkelvin));
  }

  const windMs = wind/3.6;

  return {
    rho,
    totalMass,
    crr,
    g,
    windMs,
    powerAtWheelFactor: (pmLocation==="crank") ? drivetrainEff : 1
  };
}

// ---------- FIT FILE CDA ANALYZER ----------
let currentFitData = null;
let fitScatterChart = null;

function resolveFitParserCtor(){
  const w = window;
  const fromDirect = w.FitParser;
  const fromFitObj = w.FIT && w.FIT.FitParser;

  const ctor = (typeof fromDirect === "function") ? fromDirect :
               (typeof fromFitObj === "function") ? fromFitObj :
               null;

  if (!ctor){
    console.error("FitParser global not found on window:", {
      FitParser: w.FitParser,
      FIT: w.FIT
    });
  }
  return ctor;
}

function handleFitFileSelect(evt){
  const file = evt.target.files && evt.target.files[0];
  const statusEl = document.getElementById("fitStatus");
  const lapBody = document.getElementById("lapTableBody");
  const summaryEl = document.getElementById("fitSummary");
  const statsTable = document.getElementById("fitStatsTable");
  const statsBody = document.getElementById("fitStatsBody");

  if (lapBody) lapBody.innerHTML = "";
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

  statusEl.textContent = `Reading ${file.name}…`;

  const reader = new FileReader();
  reader.onload = function(e){
    const buffer = e.target.result;
    try{
      const fitParser = new FitParserCtor({
        force: true,
        speedUnit: "m/s",
        lengthUnit: "m",
        temperatureUnit: "celsius",
        mode: "cascade",
        elapsedRecordField: true
      });

      fitParser.parse(buffer, function(error, data){
        if (error){
          console.error(error);
          statusEl.textContent = "Error parsing FIT file.";
          currentFitData = null;
          return;
        }
        currentFitData = normaliseFitDataFromFitParser(data);
        statusEl.textContent =
          `Parsed ${currentFitData.records.length} records, ${currentFitData.laps.length} laps.`;
        renderLapTable(currentFitData.laps);
        syncLapCheckboxMode();   // ensure race vs lap visual state after load
      });
    } catch(err){
      console.error(err);
      statusEl.textContent = "Exception while parsing FIT file.";
      currentFitData = null;
    }
  };
  reader.onerror = function(){
    statusEl.textContent = "Error reading file.";
    currentFitData = null;
  };
  reader.readAsArrayBuffer(file);
}

function toNumber(x){
  const v = (typeof x === "object" && x !== null && "value" in x) ? x.value : x;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function normaliseRecord(r){
  const speed = toNumber(r.speed) ?? toNumber(r.enhanced_speed) ?? null;
  const dist  = toNumber(r.distance) ?? toNumber(r.total_distance) ?? null;
  const alt   = toNumber(r.altitude) ?? toNumber(r.enhanced_altitude) ?? null;
  const power = toNumber(r.power) ?? 0;
  const cadence = toNumber(r.cadence);
  const ts = r.timestamp ? new Date(r.timestamp) : null;

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

function addGradeFromAlt(records){
  if (!records || records.length < 2) return;
  for (let i = 1; i < records.length; i++){
    const r0 = records[i-1], r1 = records[i];
    const d_m = (r1.distance != null && r0.distance != null) ? (r1.distance - r0.distance) : 0;
    const dz_m = (r1.altitude != null && r0.altitude != null) ? (r1.altitude - r0.altitude) : 0;
    r1.grade = (d_m > 1) ? (dz_m / d_m) : 0;
  }
  records[0].grade = records[1].grade;
}

/**
 * Normaliser:
 * 1) Collect all records into a flat array.
 * 2) Try to reconstruct laps from lap objects (Garmin etc.).
 * 3) Fall back to a single synthetic lap if needed.
 */
// Portions of the FIT parsing / CdA logic are adapted from open-source implementations;
// keep the original license / attribution with this file.
function normaliseFitDataFromFitParser(data){
  // collect all records
  function collectAllRecords(node, out){
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)){
      for (const item of node) collectAllRecords(item, out);
      return;
    }
    for (const key in node){
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      const val = node[key];
      if ((key === "records" || key === "record") && Array.isArray(val)){
        out.push(...val);
      } else {
        collectAllRecords(val, out);
      }
    }
  }

  const rawRecords = [];
  collectAllRecords(data, rawRecords);

  const records = rawRecords.map(normaliseRecord);
  if (records.length){
    addGradeFromAlt(records);
  }

  // collect lap-like objects
  function looksLikeLap(obj){
    if (!obj || typeof obj !== "object") return false;
    const hasDist = ("total_distance" in obj) || ("total_timer_distance" in obj);
    const hasTime = ("total_timer_time" in obj) || ("start_time" in obj) || ("timestamp" in obj);
    return hasDist && hasTime;
  }

  function collectLapCandidates(node, out){
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)){
      for (const item of node) collectLapCandidates(item, out);
      return;
    }
    for (const key in node){
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      const val = node[key];
      if (Array.isArray(val) && (key === "laps" || key === "lap")){
        val.forEach(v => { if (looksLikeLap(v)) out.push(v); });
      } else if (typeof val === "object" && val){
        collectLapCandidates(val, out);
      }
    }
  }

  const lapCandidates = [];
  collectLapCandidates(data, lapCandidates);

  let laps = [];

  if (records.length){
    if (lapCandidates.length >= 1){
      const normLaps = lapCandidates.map((lap) => {
        const startRaw = lap.start_time || lap.timestamp || null;
        const start = startRaw ? new Date(startRaw) : null;
        const tt = toNumber(lap.total_timer_time);
        let end = null;
        if (start && tt != null) {
          end = new Date(start.getTime() + tt*1000);
        }

        const totalDistance =
          toNumber(lap.total_distance) ??
          toNumber(lap.total_timer_distance) ??
          null;

        const avgSpeed = toNumber(lap.avg_speed) ?? null;   // m/s
        const avgPower = toNumber(lap.avg_power) ?? null;

        return {
          start,
          end,
          totalDistance,
          totalTimerTime: tt,
          avgSpeed,
          avgPower
        };
      }).filter(l => l.start);

      normLaps.sort((a,b) => a.start - b.start);

      // fill missing ends
      for (let i=0; i<normLaps.length; i++){
        if (!normLaps[i].end){
          const next = normLaps[i+1];
          if (next && next.start){
            normLaps[i].end = new Date(next.start.getTime() - 1000);
          }
        }
      }
      const lastRecTime = records.length ? records[records.length-1].t : null;
      const lastLap = normLaps[normLaps.length-1];
      if (lastLap && !lastLap.end && lastRecTime){
        lastLap.end = lastRecTime;
      }

      laps = normLaps.map((lap, idx) => {
        const lapRecs = records.filter(r =>
          r.t && lap.start && lap.end && r.t >= lap.start && r.t <= lap.end
        );

        let totalDistance = lap.totalDistance;
        if (lapRecs.length && totalDistance == null){
          const firstD = lapRecs[0].distance;
          const lastD  = lapRecs[lapRecs.length-1].distance;
          if (lastD != null){
            totalDistance =
              (firstD != null && lastD >= firstD) ? (lastD - firstD) : lastD;
          }
        }

        let totalTimerTime = lap.totalTimerTime;
        if (lapRecs.length && (!isFinite(totalTimerTime) || totalTimerTime == null)){
          const firstT = lapRecs[0].t;
          const lastT  = lapRecs[lapRecs.length-1].t;
          if (firstT && lastT){
            totalTimerTime = (lastT - firstT)/1000;
          }
        }

        let avgPower = lap.avgPower;
        if (lapRecs.length && (!isFinite(avgPower) || avgPower == null)){
          let sumP=0, nP=0;
          for (const r of lapRecs){
            if (r.power != null && isFinite(r.power)){
              sumP += r.power; nP++;
            }
          }
          avgPower = nP ? sumP/nP : null;
        }

        let avgSpeed = lap.avgSpeed;
        if ((avgSpeed == null || !isFinite(avgSpeed)) &&
            totalTimerTime && totalDistance){
          avgSpeed = totalDistance / totalTimerTime; // m/s
        }

        return {
          index: idx,
          displayIndex: idx+1,
          use: true,
          totalDistance,
          totalTimerTime,
          avgSpeed,
          avgPower,
          records: lapRecs
        };
      }).filter(l => l.records.length > 0);
    }

    // Fallback: single synthetic lap if no usable lap splits
    if (!laps.length){
      const first = records[0];
      const last  = records[records.length - 1];

      let totalDistance = null;
      if (last.distance != null){
        if (first.distance != null && last.distance >= first.distance){
          totalDistance = last.distance - first.distance;
        } else {
          totalDistance = last.distance;
        }
      }

      let totalTimerTime = null;
      if (first.t && last.t){
        totalTimerTime = (last.t - first.t) / 1000; // seconds
      }

      let sumP = 0, nP = 0;
      for (const r of records){
        if (r.power != null && isFinite(r.power)){
          sumP += r.power;
          nP++;
        }
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

function renderLapTable(laps){
  const body = document.getElementById("lapTableBody");
  if (!body) return;
  body.innerHTML = "";
  if (!laps || !laps.length){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
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
    const useDefault = !maxDist || (lap.totalDistance && lap.totalDistance > 0.3*maxDist);

    let lapSpeedKmh = null;
    if (distKm != null && timeMin != null && timeMin > 0.01) {
      lapSpeedKmh = distKm / (timeMin / 60);
    } else if (lap.avgSpeed != null) {
      lapSpeedKmh = lap.avgSpeed * 3.6;
    }

    tr.innerHTML = `
      <td>${lap.displayIndex}</td>
      <td><input type="checkbox" class="lap-use" data-lap-index="${lap.index}" ${useDefault ? "checked" : ""}></td>
      <td>${distKm != null ? distKm.toFixed(2) : "–"}</td>
      <td>${timeMin != null ? timeMin.toFixed(1) : "–"}</td>
      <td>${lapSpeedKmh != null && isFinite(lapSpeedKmh) ? lapSpeedKmh.toFixed(1) + " km/h" : "–"}</td>
      <td>${lap.avgPower != null ? lap.avgPower.toFixed(0) + " W" : "–"}</td>
    `;
    body.appendChild(tr);
  });
}

/** Force all laps checked + disabled in race mode; re-enable in lap mode */
function syncLapCheckboxMode(){
  const modeSel = document.getElementById("analysisMode");
  if (!modeSel) return;
  const mode = modeSel.value;
  const checkboxes = document.querySelectorAll(".lap-use");
  checkboxes.forEach(cb => {
    if (mode === "race"){
      cb.checked = true;
      cb.disabled = true;
    } else {
      cb.disabled = false; // keep existing checked state so user choices persist
    }
  });
}

function runFitAnalysis(){
  const statusEl = document.getElementById("fitStatus");
  const summaryEl = document.getElementById("fitSummary");
  const statsTable = document.getElementById("fitStatsTable");
  const statsBody = document.getElementById("fitStatsBody");

  if (!currentFitData){
    statusEl.textContent = "No FIT file parsed yet.";
    return;
  }

  const mode = document.getElementById("analysisMode").value;
  const env = getEnvParamsForSamples();
  const config = {
    minSpeedKmh: 10,
    maxSpeedKmh: 65,
    minPowerW: 80,
    maxPowerW: 900,
    maxAbsGrade: 0.06,
    minCdA: 0.10,
    maxCdA: 0.50
  };

  let records = [];

  if (mode === "laps"){
    // Only use selected laps
    const checkboxes = document.querySelectorAll(".lap-use");
    const idxSet = new Set();
    checkboxes.forEach(cb => {
      if (cb.checked){
        const idx = Number(cb.getAttribute("data-lap-index"));
        idxSet.add(idx);
      }
    });
    currentFitData.laps.forEach(lap => {
      if (idxSet.has(lap.index)){
        records.push(...lap.records);
      }
    });
  } else {
    // Race mode: ignore selection, use whole file
    records = currentFitData.records.slice();
  }

  if (!records.length){
    statusEl.textContent = "No records in selected laps.";
    return;
  }

  const analysis = analyseCdAFromRecords(records, env, config);
  renderFitAnalysis(analysis, summaryEl, statsTable, statsBody);
  statusEl.textContent = `Used ${analysis.countAll} samples after filtering.`;
  renderFitScatter(analysis.points);
}

function isUsableRecord(rec, cfg){
  if (rec.speed == null || rec.power == null) return false;
  const v_kmh = rec.speed * 3.6;
  const p = rec.power;
  const grade = rec.grade || 0;
  if (!isFinite(v_kmh) || v_kmh < cfg.minSpeedKmh || v_kmh > cfg.maxSpeedKmh) return false;
  if (!isFinite(p) || p < cfg.minPowerW || p > cfg.maxPowerW) return false;
  if (!isFinite(grade) || Math.abs(grade) > cfg.maxAbsGrade) return false;
  return true;
}

function computeCdAForRecord(rec, env){
  const v_g = rec.speed;
  const v_air = Math.max(0, v_g + env.windMs);
  if (v_g <= 0 || v_air <= 0) return NaN;

  const grade = rec.grade || 0;
  const cosTheta = 1/Math.sqrt(1 + grade*grade);
  const m = env.totalMass;
  const g = env.g;
  const crr = env.crr;
  const powerAtWheel = env.powerAtWheelFactor * rec.power;

  const pRoll = g*m*crr*cosTheta*v_g;
  const pClimb = g*m*grade*v_g;
  const pAero = powerAtWheel - pRoll - pClimb;
  const denom = 0.5*env.rho*v_air*v_air*v_g;

  if (denom <= 0 || pAero <= 0) return NaN;
  return pAero / denom;
}

function analyseCdAFromRecords(records, env, cfg){
  const cdasAll = [];
  const raceFlat = [];
  const climbRelaxed = [];
  const points = [];

  for (const rec of records){
    if (!isUsableRecord(rec, cfg)) continue;
    const cda = computeCdAForRecord(rec, env);
    if (!isFinite(cda) || cda < cfg.minCdA || cda > cfg.maxCdA) continue;

    const v_kmh = rec.speed*3.6;
    const grade = rec.grade || 0;
    const absGrade = Math.abs(grade);

    const cat = (absGrade <= 0.01) ? "race" : (grade >= 0.02 ? "climb" : "other");

    cdasAll.push(cda);
    if (cat === "race") raceFlat.push({cda, v_kmh});
    if (cat === "climb") climbRelaxed.push({cda, v_kmh});

    if (points.length < 4000){
      points.push({ cda, v_kmh, cat });
    }
  }

  function summarise(list){
    if (!list.length) return {n:0, median:null, p25:null, p75:null};
    const vals = list.map(x => x.cda).slice().sort((a,b)=>a-b);
    const n = vals.length;
    const median = vals[Math.floor(n*0.5)];
    const p25 = vals[Math.floor(n*0.25)];
    const p75 = vals[Math.floor(n*0.75)];
    return {n, median, p25, p75};
  }

  const allSummary = summarise(cdasAll.map(x => ({cda:x})));
  const raceSummary = summarise(raceFlat);
  const climbSummary = summarise(climbRelaxed);

  function summariseHighSpeed(list, minSpeed){
    const filtered = list.filter(p => p.v_kmh >= minSpeed);
    if (!filtered.length) return {n:0, median:null, p25:null, p75:null};
    return summarise(filtered);
  }

  const raceHigh24 = summariseHighSpeed(raceFlat,24);
  const raceHigh30 = summariseHighSpeed(raceFlat,30);
  const raceHigh35 = summariseHighSpeed(raceFlat,35);
  const raceHigh40 = summariseHighSpeed(raceFlat,40);

  const climbHigh = summariseHighSpeed(climbRelaxed,24);

  return {
    countAll: cdasAll.length,
    allSummary,
    raceSummary,
    climbSummary,
    raceHigh24,
    raceHigh30,
    raceHigh35,
    raceHigh40,
    climbHigh,
    points
  };
}

function renderFitAnalysis(a, summaryEl, statsTable, statsBody){
  function fmt(v, digits){
    return (v == null || !isFinite(v)) ? "–" : v.toFixed(digits);
  }

  if (!a || !a.countAll){
    summaryEl.textContent = "No usable samples after filtering.";
    statsTable.style.display = "none";
    statsBody.innerHTML = "";
    return;
  }

  const estRace = a.raceHigh24.median ?? a.raceSummary.median;
  const estClimb = a.climbHigh.median ?? a.climbSummary.median;

  summaryEl.innerHTML =
    `Estimated <strong>racing CdA</strong> (flat, ≥24 km/h where available): <strong>${fmt(estRace,3)}</strong><br>` +
    `Estimated <strong>climbing / relaxed CdA</strong>: <strong>${fmt(estClimb,3)}</strong><br>` +
    `<span style="font-size:0.9em;color:#555;">${a.countAll} samples used after filtering. ` +
    `Race flat samples: ${a.raceSummary.n}, climb samples: ${a.climbSummary.n}.</span>`;

  const rows = [
    { label: "All usable",                 s: a.allSummary,   note: "all grades" },
    { label: "Race / flat",               s: a.raceSummary,  note: "|grade| ≤ 1%" },
    { label: "Race / flat, ≥24 km/h",     s: a.raceHigh24,   note: "subset of race" },
    { label: "Race / flat, ≥30 km/h",     s: a.raceHigh30,   note: "subset of race" },
    { label: "Race / flat, ≥35 km/h",     s: a.raceHigh35,   note: "subset of race" },
    { label: "Race / flat, ≥40 km/h",     s: a.raceHigh40,   note: "subset of race" },
    { label: "Climb / relaxed",           s: a.climbSummary, note: "grade ≥ 2%" },
    { label: "Climb / relaxed, ≥24 km/h", s: a.climbHigh,    note: "subset of climb" }
  ];

  statsBody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.label}</td>
      <td>${r.s.n}</td>
      <td>${fmt(r.s.median,3)}</td>
      <td>${fmt(r.s.p25,3)} – ${fmt(r.s.p75,3)}</td>
      <td>${r.note}</td>
    `;
    statsBody.appendChild(tr);
  });
  statsTable.style.display = "table";
}

function renderFitScatter(points){
  const canvas = document.getElementById("fitScatter");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");

  const racePoints = points.filter(p => p.cat === "race").map(p => ({x:p.v_kmh,y:p.cda}));
  const climbPoints = points.filter(p => p.cat === "climb").map(p => ({x:p.v_kmh,y:p.cda}));

  if (fitScatterChart){
    fitScatterChart.destroy();
  }

  fitScatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        { label: "Race / flat",  data: racePoints,  pointRadius: 2 },
        { label: "Climb / relaxed", data: climbPoints, pointRadius: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "linear", title: {display:true,text:"Speed (km/h)"}, ticks: {stepSize:5} },
        y: { title: {display:true,text:"CdA"}, suggestedMin:0.15, suggestedMax:0.5 }
      },
      plugins: {
        legend: {position:"top"},
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const x = ctx.parsed.x;
              const y = ctx.parsed.y;
              return ` ${x.toFixed(1)} km/h, CdA ${y.toFixed(3)}`;
            }
          }
        }
      }
    }
  });
}

// Expose functions for inline HTML handlers (important if/when minifying)
window.switchUnit          = switchUnit;
window.calculateResult     = calculateResult;
window.resetValues         = resetValues;
window.runFitAnalysis      = runFitAnalysis;
window.handleFitFileSelect = handleFitFileSelect;
