import { RouteOptimizer } from "./RouteOptimizer.js";
import { hasCoordinates, haversineKm } from "./geo.js";

/** Vitesse moyenne supposée en ville l'hiver, pour une durée indicative. */
const AVERAGE_SPEED_KMH = 30;
/** Bornes de sécurité : une route réelle (~100 arrêts) converge en quelques passes. */
const MAX_PASSES = 50;
/** Longueurs de segment déplacées par Or-opt. */
const OR_OPT_SEGMENTS = [1, 2, 3];

/**
 * Optimiseur local, gratuit et sans réseau : plus proche voisin, puis amélioration par
 * 2-opt (inverser un tronçon) et Or-opt (déplacer 1 à 3 arrêts consécutifs) jusqu'à stabilité.
 * Distances à vol d'oiseau : il ne connaît ni les rues ni les sens uniques. Sert au dev
 * (ROUTE_OPTIMIZATION_DRY_RUN=true) et de repli si Google n'est pas configuré.
 */
export class LocalRouteOptimizer extends RouteOptimizer {
  get provider() {
    return "local";
  }

  async optimize({ start, end, stops }) {
    const skipped = stops.filter((s) => !hasCoordinates(s)).map((s) => ({ id: s.id, reason: "Pas de coordonnées" }));
    const usable = stops.filter(hasCoordinates);
    if (usable.length === 0) {
      return { provider: this.provider, orderedIds: [], skipped, distanceKm: 0, durationMinutes: 0 };
    }

    // Matrice de distances : index 0 = départ, 1..n = arrêts, n+1 = retour
    const points = [start, ...usable, end];
    const n = points.length;
    const dist = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : haversineKm(points[i], points[j]))));

    let tour = nearestNeighbor(dist, usable.length);
    tour = improve(dist, tour);

    const distanceKm = tourLength(dist, tour);
    const visitSeconds = usable.reduce((sum, s) => sum + (s.visitSeconds ?? 0), 0);
    return {
      provider: this.provider,
      orderedIds: tour.map((index) => usable[index - 1].id),
      skipped,
      distanceKm,
      durationMinutes: Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60 + visitSeconds / 60)
    };
  }
}

/** Tournée = indices des arrêts (1..count), départ (0) et retour (count+1) implicites. */
const tourLength = (dist, tour) => {
  const last = dist.length - 1;
  let km = dist[0][tour[0]];
  for (let i = 1; i < tour.length; i++) km += dist[tour[i - 1]][tour[i]];
  return km + dist[tour[tour.length - 1]][last];
};

const nearestNeighbor = (dist, count) => {
  const remaining = new Set(Array.from({ length: count }, (_, i) => i + 1));
  const tour = [];
  let current = 0;
  while (remaining.size) {
    let best = null;
    for (const candidate of remaining) {
      if (best === null || dist[current][candidate] < dist[current][best]) best = candidate;
    }
    tour.push(best);
    remaining.delete(best);
    current = best;
  }
  return tour;
};

const EPSILON = 1e-9;

const improve = (dist, initial) => {
  let tour = initial;
  let best = tourLength(dist, tour);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = orOpt(dist, twoOpt(dist, tour));
    const length = tourLength(dist, next);
    if (length >= best - EPSILON) break;
    tour = next;
    best = length;
  }
  return tour;
};

/** 2-opt : inverse tour[i..j] si ça raccourcit ; extrémités (départ/retour) fixes. */
const twoOpt = (dist, input) => {
  const tour = [...input];
  const last = dist.length - 1;
  const at = (k) => (k < 0 ? 0 : k >= tour.length ? last : tour[k]);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        const delta = dist[at(i - 1)][at(j)] + dist[at(i)][at(j + 1)] - dist[at(i - 1)][at(i)] - dist[at(j)][at(j + 1)];
        if (delta < -EPSILON) {
          reverseInPlace(tour, i, j);
          improved = true;
        }
      }
    }
  }
  return tour;
};

const reverseInPlace = (array, i, j) => {
  while (i < j) {
    [array[i], array[j]] = [array[j], array[i]];
    i++;
    j--;
  }
};

/**
 * Or-opt : déplace un bloc de 1 à 3 arrêts (dans un sens ou l'autre) à l'endroit qui
 * raccourcit le plus. Gains calculés en O(1) par insertion : O(n²) par balayage.
 */
const orOpt = (dist, input) => {
  let tour = [...input];
  const last = dist.length - 1;
  let improved = true;
  while (improved) {
    improved = false;
    for (const size of OR_OPT_SEGMENTS) {
      for (let i = 0; i + size <= tour.length && !improved; i++) {
        const first = tour[i];
        const end = tour[i + size - 1];
        const prev = i === 0 ? 0 : tour[i - 1];
        const next = i + size >= tour.length ? last : tour[i + size];
        const removeGain = dist[prev][first] + dist[end][next] - dist[prev][next];

        // Chemin sans le bloc : départ, arrêts restants, retour
        const rest = [...tour.slice(0, i), ...tour.slice(i + size)];
        const path = [0, ...rest, last];
        for (let k = 0; k < path.length - 1 && !improved; k++) {
          const a = path[k];
          const b = path[k + 1];
          if (k === i) continue; // position d'origine
          const forward = dist[a][first] + dist[end][b] - dist[a][b];
          const backward = dist[a][end] + dist[first][b] - dist[a][b];
          const reversed = size > 1 && backward < forward;
          if (Math.min(forward, size > 1 ? backward : Infinity) - removeGain < -EPSILON) {
            const block = tour.slice(i, i + size);
            if (reversed) block.reverse();
            tour = [...rest.slice(0, k), ...block, ...rest.slice(k)];
            improved = true;
          }
        }
      }
      if (improved) break;
    }
  }
  return tour;
};
