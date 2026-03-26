/*
This is again the same Wilkie-Hosek model from Shadertoy
https://www.shadertoy.com/view/wslfD7

However, this is a TypeScript port (manually made by us). Its purpose is
to get an "averaged sky color" that we can use to dynamically change the
ambient color of the scene along with lighting color and intensity.
*/

import {
  clamp,
  clampV3,
  lerp,
  linearTransform,
  matrix3x3,
} from "../utils/math";
import { math } from "../../tiny-graphics-math";

const ALBEDO = 1;
const TURBIDITY = 3;

const M_PI = Math.PI;
const H_PI = Math.PI / 2;

enum AxisCIE {
  CIE_X = 0,
  CIE_Y = 1,
  CIE_Z = 2,
}

const kHosekCoeffsX = [
  -1.171419, -0.242975, -8.991334, 9.571216, -0.027729, 0.668826, 0.076835,
  3.785611, 0.634764, -1.228554, -0.291756, 2.753986, -2.49178, -0.046634,
  0.31183, 0.075465, 4.463096, 0.595507, -1.093124, -0.244777, 0.909741,
  0.54483, -0.295782, 2.024167, -0.000515, -1.069081, 0.936956, -1.056994,
  0.015695, -0.821749, 1.870818, 0.706193, -1.483928, 0.597821, 6.864902,
  0.367333, -1.054871, -0.275813, 2.712807, -5.95011, -6.554039, 2.447523,
  -0.189517, -1.454292, 0.913174, -1.100218, -0.174624, 1.438505, 11.15481,
  -3.266076, -0.883736, 0.19701, 1.991595, 0.590782,
];

const kHosekCoeffsY = [
  -1.185983, -0.258118, -7.761056, 8.317053, -0.033518, 0.667667, 0.059417,
  3.820727, 0.632403, -1.268591, -0.339807, 2.348503, -2.023779, -0.053685,
  0.108328, 0.084029, 3.910254, 0.557748, -1.071353, -0.199246, 0.787839,
  0.19747, -0.303306, 2.335298, -0.082053, 0.795445, 0.997231, -1.089513,
  -0.031044, -0.599575, 2.330281, 0.658194, -1.821467, 0.667997, 5.090195,
  0.312516, -1.040214, -0.257093, 2.660489, -6.506045, -7.053586, 2.763153,
  -0.243363, -0.764818, 0.945294, -1.116052, -0.183199, 1.457694, 11.63608,
  -3.216426, -1.045594, 0.2285, 1.817407, 0.58104,
];

const kHosekCoeffsZ = [
  -1.354183, -0.513062, -42.19268, 42.71772, -0.005365, 0.413674, 0.012352,
  2.520122, 0.518727, -1.741434, -0.958976, -8.230339, 9.296799, -0.0096,
  0.499497, 0.029555, 0.36671, 0.3527, -0.691735, 0.215489, -0.876026, 0.233412,
  -0.019096, 0.474803, -0.113851, 6.51536, 1.225097, -1.293189, -0.42187,
  1.620952, -0.78586, -0.037694, 0.663679, 0.336494, -0.534102, 0.212835,
  -0.973552, -0.132549, 1.007517, 0.259826, 0.067622, 0.001421, -0.06916,
  3.185897, 0.864196, -1.0948, -0.196206, 0.575559, 0.290626, 0.262575,
  0.764405, 0.134749, 2.677126, 0.646546,
];

const kHosekRadX = [1.468395, 2.21197, -2.845869, 20.75027, 15.24822, 19.37622];

const kHosekRadY = [
  1.516536, 2.438729, -3.624121, 22.98621, 15.99782, 20.70027,
];

const kHosekRadZ = [1.234428, 2.289628, -3.404699, 14.99436, 34.6839, 30.84842];

function sample_coeff(
  channel: AxisCIE,
  albedo: number,
  turbidity: number,
  quintic_coeff: number,
  coeff: number,
) {
  // int index = 540 * albedo + 54 * turbidity + 9 * quintic_coeff + coeff;
  const index = 9 * quintic_coeff + coeff;
  switch (channel) {
    case AxisCIE.CIE_X:
      return kHosekCoeffsX[index];
    case AxisCIE.CIE_Y:
      return kHosekCoeffsY[index];
    case AxisCIE.CIE_Z:
      return kHosekCoeffsZ[index];
  }
}

function sample_radiance(
  channel: AxisCIE,
  albedo: number,
  turbidity: number,
  quintic_coeff: number,
) {
  // int index = 60 * albedo + 6 * turbidity + quintic_coeff;
  const index = quintic_coeff;
  switch (channel) {
    case AxisCIE.CIE_X:
      return kHosekRadX[index];
    case AxisCIE.CIE_Y:
      return kHosekRadY[index];
    case AxisCIE.CIE_Z:
      return kHosekRadZ[index];
  }
}

function eval_quintic_bezier(control_points: number[], t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const t_inv = 1.0 - t;
  const t_inv2 = t_inv * t_inv;
  const t_inv3 = t_inv2 * t_inv;
  const t_inv4 = t_inv3 * t_inv;
  const t_inv5 = t_inv4 * t_inv;

  // prettier-ignore
  return (
    control_points[0] *             t_inv5 +
    control_points[1] *  5.0 * t  * t_inv4 +
    control_points[2] * 10.0 * t2 * t_inv3 +
    control_points[3] * 10.0 * t3 * t_inv2 +
    control_points[4] *  5.0 * t4 * t_inv  +
    control_points[5] *        t5
  );
}

function transform_sun_zenith(sun_zenith: number) {
  const elevation = M_PI / 2.0 - sun_zenith;
  return Math.pow(elevation / (M_PI / 2.0), 0.333333);
}

function get_control_points(
  channel: AxisCIE,
  albedo: number,
  turbidity: number,
  coeff: number,
  control_points: number[],
) {
  for (let i = 0; i < 6; ++i)
    control_points[i] = sample_coeff(channel, albedo, turbidity, i, coeff);
}

function get_control_points_radiance(
  channel: AxisCIE,
  albedo: number,
  turbidity: number,
  control_points: number[],
) {
  for (let i = 0; i < 6; ++i)
    control_points[i] = sample_radiance(channel, albedo, turbidity, i);
}

function get_coeffs(
  channel: AxisCIE,
  albedo: number,
  turbidity: number,
  sun_zenith: number,
  coeffs: number[],
) {
  const t = transform_sun_zenith(sun_zenith);
  for (let i = 0; i < 9; ++i) {
    let control_points = [0, 0, 0, 0, 0, 0];
    get_control_points(channel, albedo, turbidity, i, control_points);
    coeffs[i] = eval_quintic_bezier(control_points, t);
  }
}

function mean_spectral_radiance(
  albedo: number,
  turbidity: number,
  sun_zenith: number,
) {
  const spectral_radiance = math.vec3(0, 0, 0);
  for (let i = 0; i < 3; ++i) {
    let control_points = [0, 0, 0, 0, 0, 0];
    get_control_points_radiance(i, albedo, turbidity, control_points);
    const t = transform_sun_zenith(sun_zenith);
    spectral_radiance[i] = eval_quintic_bezier(control_points, t);
  }
  return spectral_radiance;
}

function F(theta: number, gamma: number, coeffs: number[]) {
  const A = coeffs[0];
  const B = coeffs[1];
  const C = coeffs[2];
  const D = coeffs[3];
  const E = coeffs[4];
  const F = coeffs[5];
  const G = coeffs[6];
  const H = coeffs[8];
  const I = coeffs[7];
  const chi =
    (1.0 + Math.pow(Math.cos(gamma), 2.0)) /
    Math.pow(1.0 + H * H - 2.0 * H * Math.cos(gamma), 1.5);

  return (
    (1.0 + A * Math.exp(B / (Math.cos(theta) + 0.01))) *
    (C +
      D * Math.exp(E * gamma) +
      F * Math.pow(Math.cos(gamma), 2.0) +
      G * chi +
      I * Math.sqrt(Math.cos(theta)))
  );
}

function spectral_radiance(
  theta: number,
  gamma: number,
  albedo: number,
  turbidity: number,
  sun_zenith: number,
) {
  const XYZ = math.vec3(0, 0, 0);
  for (let i = 0; i < 3; ++i) {
    let coeffs = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    get_coeffs(i, albedo, turbidity, sun_zenith, coeffs);
    XYZ[i] = F(theta, gamma, coeffs);
  }
  return XYZ;
}

// Returns angle between two directions defined by zentih and azimuth angles
function angle(z1: number, a1: number, z2: number, a2: number) {
  const dist =
    Math.sin(z1) * Math.cos(a1) * Math.sin(z2) * Math.cos(a2) +
    Math.sin(z1) * Math.sin(a1) * Math.sin(z2) * Math.sin(a2) +
    Math.cos(z1) * Math.cos(z2);
  return Math.acos(clamp(dist, -1, 1));
}

function sample_sky(
  view_zenith: number,
  view_azimuth: number,
  sun_zenith: number,
  sun_azimuth: number,
) {
  const gamma = angle(view_zenith, view_azimuth, sun_zenith, sun_azimuth);
  const theta = view_zenith;
  return spectral_radiance(
    theta,
    gamma,
    ALBEDO,
    TURBIDITY,
    sun_zenith,
  ).times_pairwise(mean_spectral_radiance(ALBEDO, TURBIDITY, sun_zenith));
}

// CIE-XYZ to linear RGB
function XYZ_to_RGB(XYZ: math.Vector3) {
  const XYZ_to_linear: matrix3x3 = [
    [3.24096994, -1.53738318, -0.49861076],
    [-0.96924364, 1.8759675, 0.04155506],
    [0.5563008, -0.20397696, 1.05697151],
  ];
  return linearTransform(XYZ_to_linear, XYZ);
}

// Clamps color between 0 and 1 smoothly
function tonemap(color: math.Vector3, exposure: number) {
  const two = math.vec3(2.0, 2.0, 2.0);
  const one = math.vec3(1.0, 1.0, 1.0);

  const divide_pairwise = (a: math.Vector3, b: math.Vector3) => {
    return math.vec3(a[0] / b[0], a[1] / b[1], a[2] / b[2]);
  };

  const colorDiv = color.times(-exposure);
  colorDiv[0] = 1.0 + Math.exp(colorDiv[0]);
  colorDiv[1] = 1.0 + Math.exp(colorDiv[1]);
  colorDiv[2] = 1.0 + Math.exp(colorDiv[2]);

  return divide_pairwise(two, colorDiv).minus(one);
}

export function getHorizonColor(props: {
  // high noon at 0, horizon at pi/2
  sun_zenith: number;
  // starts at x-axis moves clockwise towards z at pi/2
  sun_azimuth: number;
}) {
  const { sun_zenith, sun_azimuth } = props;
  // built using Desmos
  // https://www.desmos.com/3d/912f2ca12c
  const N_SAMPLES = 12;
  const AVG_SAMPLE_RATE = 1 / N_SAMPLES;
  const sun_zenith_safe = clamp(sun_zenith, 0.0, H_PI);
  let t = 0;
  let view_azimuth = 0;
  let sample,
    sum_of_samples = math.vec3(0, 0, 0);
  for (let i = 0; i < N_SAMPLES; ++i) {
    t = i / N_SAMPLES;
    view_azimuth = 11 * M_PI * 2 * t;
    sample = sample_sky(H_PI, view_azimuth, sun_zenith_safe, sun_azimuth);
    sample.scale_by(AVG_SAMPLE_RATE);
    sum_of_samples.add_by(sample);
  }

  const RGB = math.vec3(...XYZ_to_RGB(sum_of_samples));
  // adjust brightness gain
  const col = tonemap(RGB, 0.1);

  if (sun_zenith > H_PI) {
    let alpha = 1.0 / (10.0 * (sun_zenith - H_PI) + 1.0);
    col.scale_by(alpha);
  }

  // assign final color
  return clampV3(col, 0, 1).to4(1.0);
}

export function getAverageSkyColor(props: {
  // high noon at 0, horizon at pi/2
  sun_zenith: number;
  // starts at x-axis moves clockwise towards z at pi/2
  sun_azimuth: number;
}) {
  const { sun_zenith, sun_azimuth } = props;
  // built using Desmos
  // https://www.desmos.com/3d/912f2ca12c
  const N_SAMPLES = 51;
  const AVG_SAMPLE_RATE = 1 / N_SAMPLES;
  const sun_zenith_safe = clamp(sun_zenith, 0.0, H_PI);
  let t = 0;
  let view_zenith = 0;
  let view_azimuth = 0;
  let sample,
    sum_of_samples = math.vec3(0, 0, 0);
  for (let i = 0; i < N_SAMPLES; ++i) {
    t = i / N_SAMPLES;
    // same as sun zenith but for the sky
    view_zenith = (Math.sqrt(t) * M_PI) / 2;
    // same as sun azimuth but for the sky
    view_azimuth = 11 * M_PI * 2 * t;
    sample = sample_sky(
      view_zenith,
      view_azimuth,
      sun_zenith_safe,
      sun_azimuth,
    );
    sample.scale_by(AVG_SAMPLE_RATE);
    sum_of_samples.add_by(sample);
  }

  const RGB = math.vec3(...XYZ_to_RGB(sum_of_samples));
  // adjust brightness gain
  const col = tonemap(RGB, 0.1);

  if (sun_zenith > H_PI) {
    let alpha = 1.0 / (10.0 * (sun_zenith - H_PI) + 1.0);
    col.scale_by(alpha);
  }

  // assign final color
  return clampV3(col, 0, 1).to4(1.0);
}

export function getSunColor(props: {
  // high noon at 0, horizon at pi/2
  sun_zenith: number;
  // starts at x-axis moves clockwise towards z at pi/2
  sun_azimuth: number;
}) {
  const { sun_zenith, sun_azimuth } = props;
  const sun_zenith_safe = clamp(sun_zenith, 0.0, H_PI);
  const view_zenith = sun_zenith_safe;
  const view_azimuth = sun_azimuth;

  const sample = sample_sky(
    view_zenith,
    view_azimuth,
    sun_zenith_safe,
    sun_azimuth,
  );

  const RGB = math.vec3(...XYZ_to_RGB(sample));
  // adjust brightness gain
  const col = tonemap(RGB, 0.1);

  if (sun_zenith > H_PI) {
    const alpha = 1.0 / (10.0 * (sun_zenith - H_PI) + 1.0);
    col.scale_by(alpha * alpha);
  }

  // assign final color
  return clampV3(col, 0, 1).to4(1.0);
}

export function getGrayscale(color: math.Vector4) {
  return 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
}

export function calculateSunPosition(
  hour_of_day: number,
  axis_tilt: number,
  month: number,
) {
  // Convert hour of the day to fractional hours (0 to 23.9999)
  const fractional_hour = hour_of_day % 24;

  // Convert month of the year to fractional months (0 to 11.9999)
  const fractional_month = month % 12;

  // Calculate declination angle (δ) of the sun
  const declination =
    23.44 * Math.sin((2 * Math.PI * (284 + fractional_month)) / 365);

  // Calculate hour angle (H) of the sun
  const hour_angle = (fractional_hour - 12) * 15;

  // Calculate zenith angle (θ) of the sun
  const sun_zenith = Math.acos(
    Math.sin(axis_tilt) * Math.sin((declination * Math.PI) / 180) +
      Math.cos(axis_tilt) *
        Math.cos((declination * Math.PI) / 180) *
        Math.cos((hour_angle * Math.PI) / 180),
  );

  // Calculate azimuth angle (φ) of the sun
  let sun_azimuth = Math.atan2(
    -Math.sin((hour_angle * Math.PI) / 180),
    Math.tan(axis_tilt) * Math.cos(declination) -
      Math.sin(declination) * Math.cos((hour_angle * Math.PI) / 180),
  );

  // Convert azimuth to the range [0, 2π)
  if (sun_azimuth < 0) {
    sun_azimuth += 2 * Math.PI;
  }

  return { sun_zenith, sun_azimuth };
}
