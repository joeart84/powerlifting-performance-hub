// Extracted unchanged from the live website calculator on 2026-10-06. See scoring-reference/provenance.json.
  const FOSTER = {
    14: 1.23, 15: 1.18, 16: 1.13, 17: 1.08, 18: 1.06,
    19: 1.04, 20: 1.03, 21: 1.02, 22: 1.01, 23: 1.00,
  };
  const MCCULLOCH = {
    40: 1.000, 41: 1.010, 42: 1.020, 43: 1.031, 44: 1.043,
    45: 1.055, 46: 1.068, 47: 1.082, 48: 1.097, 49: 1.113,
    50: 1.130, 51: 1.147, 52: 1.165, 53: 1.184, 54: 1.204,
    55: 1.225, 56: 1.246, 57: 1.268, 58: 1.291, 59: 1.315,
    60: 1.340, 61: 1.366, 62: 1.393, 63: 1.421, 64: 1.450,
    65: 1.480, 66: 1.511, 67: 1.543, 68: 1.576, 69: 1.610,
    70: 1.645, 71: 1.681, 72: 1.718, 73: 1.756, 74: 1.795,
    75: 1.835, 76: 1.876, 77: 1.918, 78: 1.961, 79: 2.005,
    80: 2.050, 81: 2.096, 82: 2.143, 83: 2.190, 84: 2.238,
    85: 2.287, 86: 2.337, 87: 2.388, 88: 2.440, 89: 2.494,
    90: 2.549,
  };
  const DOTS = {
    male:   { a: -0.0000010930, b: 0.0007391293, c: -0.1918759221, d: 24.0900756, e: -307.75076 },
    female: { a: -0.0000010706, b: 0.0005158568, c: -0.1126655495, d: 13.6175032, e: -57.96288  },
  };
const RESHEL={male:{...require('./legacy-reshel-male.json'),loaded:true},female:{...require('./legacy-reshel-female.json'),loaded:true}};
  function ageCoeff(ageRaw) {
    if (!Number.isFinite(ageRaw) || ageRaw <= 0) return { coeff: NaN, label: "" };
    if (!Number.isInteger(ageRaw) || ageRaw < 14 || ageRaw > 90) return {coeff:NaN,label:""};
    let age = ageRaw;

    if (age <= 23) {
      if (age < 14) age = 14;
      return { coeff: FOSTER[age] ?? NaN, label: "Foster" };
    }

    if (age >= 24 && age <= 39) return { coeff: 1.0, label: "Open" };

    if (age >= 40) {
      if (age > 90) age = 90;
      return { coeff: MCCULLOCH[age] ?? NaN, label: "McCulloch" };
    }

    return { coeff: 1.0, label: "Open" };
  }
  function dotsCoeff(gender, bwKg) {
    const c = DOTS[gender];
    const x = Math.max(40, Math.min(gender === "female" ? 150 : 210, bwKg));
    const denom = c.a*x**4 + c.b*x**3 + c.c*x**2 + c.d*x + c.e;
    if (!Number.isFinite(denom) || denom <= 0) return NaN;
    return 500 / denom;
  }
  function floorToStep(x, step) {
    return Math.floor(x / step) * step;
  }
  function reshelCoeff(gender, bwKg) {
    const g = gender === "female" ? "female" : "male";
    const d = RESHEL[g];
    if (!d.loaded || !d.coeff) return NaN;

    const step = 0.25;

    // Normalize floating-point conversion noise below 0.00000001 kg before table boundaries.
    let bw = Math.round(bwKg * 1e8) / 1e8;
    if (bw < d.min || bw > d.max) return NaN;

    const key = floorToStep(bw, step);
    const k = key.toFixed(2);

    if (d.coeff[k] != null) return Number(d.coeff[k]);

    for (let i = 1; i <= 4; i++) {
      const k2 = (key - i * step).toFixed(2);
      if (d.coeff[k2] != null) return Number(d.coeff[k2]);
    }
    return NaN;
  }
module.exports={ageCoeff,dotsCoeff,reshelCoeff};
