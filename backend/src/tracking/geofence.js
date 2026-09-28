import { haversineKm } from "../routing/geo.js";
import { GEOFENCE_CONFIRMATIONS } from "../components/tracking/tracking.constants.js";
import { ROUTE_RUN_STOP_STATUS, STOP_DONE_SOURCE } from "../components/routeRun/routeRun.constants.js";

/**
 * Géorepérage des arrêts d'une tournée : arrivée, départ, « Fait » automatique.
 *
 * Fonction pure : aucune base de données. Le service lui passe l'état mémorisé
 * (RouteRuns.GeofenceState), les arrêts et les nouvelles positions ; elle renvoie le
 * nouvel état et les arrêts modifiés. Chaque position ne sert qu'une fois (`lastAt`).
 *
 *   (rien) ──2 positions dans le rayon d'un candidat──▶ ARRIVÉ (ArrivedAt = 1re position)
 *   ARRIVÉ ──2 positions au-delà de rayon + marge──▶ REPARTI (DepartedAt = 1re position dehors)
 *       └─ resté ≥ minDwellSeconds : durées enregistrées, « Fait » auto si l'arrêt était à faire
 *       └─ sinon : simple passage, l'arrivée est effacée
 *
 * Candidats : les `lookaheadStops` premiers arrêts encore à faire, dans l'ordre de la tournée,
 * qui ont des coordonnées. Deux entrées voisines ne se confondent pas avec une adresse plus loin.
 */

/** État initial (aussi après chaque départ). */
const idle = (lastAt = null, lastDepartedAt = null) => ({ stopId: null, phase: null, count: 0, candidateAt: null, leftAt: null, lastAt, lastDepartedAt });

const distanceM = (position, stop) =>
  haversineKm({ latitude: position.latitude, longitude: position.longitude }, { latitude: stop.latitude, longitude: stop.longitude }) * 1000;

const seconds = (from, to) => Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));

/**
 * @param {object} params
 * @param {object|null} params.state        état mémorisé (null = début de tournée)
 * @param {object[]} params.stops           { id, sequence, status, latitude, longitude, arrivedAt, departedAt, serviceSeconds, travelSeconds, doneAt, doneSource }
 * @param {object[]} params.positions       { latitude, longitude, recordedAt } triées par recordedAt croissant
 * @param {object} params.settings          réglages `tracking` (rayon, marge, durée minimale, candidats, auto)
 * @param {Date|string} params.runStartedAt début de la tournée (trajet vers le 1er arrêt)
 * @returns {{ state: object, changed: object[] }} arrêts modifiés (copies)
 */
export const advanceGeofence = ({ state, stops, positions, settings, runStartedAt }) => {
  let s = { ...idle(), ...(state ?? {}) };
  const byId = new Map(stops.map((stop) => [stop.id, { ...stop }]));
  const changed = new Set();
  const exitRadius = settings.geofenceRadiusM + settings.exitMarginM;

  const arrive = (stop, at) => {
    stop.arrivedAt = at;
    stop.departedAt = null;
    stop.serviceSeconds = null;
    stop.travelSeconds = seconds(s.lastDepartedAt ?? runStartedAt, at);
    changed.add(stop.id);
  };

  const depart = (stop, at) => {
    const service = seconds(stop.arrivedAt, at);
    const alreadyHandled = stop.status !== ROUTE_RUN_STOP_STATUS.PENDING;
    if (service >= settings.minDwellSeconds || alreadyHandled) {
      stop.departedAt = at;
      stop.serviceSeconds = service;
      if (!alreadyHandled && settings.autoCompleteStops) {
        stop.status = ROUTE_RUN_STOP_STATUS.DONE;
        stop.doneAt = at;
        stop.doneSource = STOP_DONE_SOURCE.AUTO_GPS;
      }
      s = idle(s.lastAt, at);
    } else {
      // Simple passage devant l'adresse : on oublie cette arrivée
      stop.arrivedAt = null;
      stop.travelSeconds = null;
      s = idle(s.lastAt, s.lastDepartedAt);
    }
    changed.add(stop.id);
  };

  const candidatesAt = (position) =>
    [...byId.values()]
      .filter((stop) => stop.status === ROUTE_RUN_STOP_STATUS.PENDING && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, settings.lookaheadStops)
      .map((stop) => ({ stop, distance: distanceM(position, stop) }))
      .filter(({ distance }) => distance <= settings.geofenceRadiusM)
      .sort((a, b) => a.distance - b.distance || a.stop.sequence - b.stop.sequence);

  for (const position of positions) {
    const at = new Date(position.recordedAt);
    if (s.lastAt && at.getTime() <= new Date(s.lastAt).getTime()) continue; // déjà traitée (tampon en retard)
    s.lastAt = at.toISOString();

    // 1. Dans une entrée : attendre le départ
    if (s.phase === "inside" || s.phase === "leaving") {
      const current = byId.get(s.stopId);
      if (!current || !current.arrivedAt) {
        s = idle(s.lastAt, s.lastDepartedAt); // arrêt annulé ou retiré entre-temps
      } else if (distanceM(position, current) > exitRadius) {
        if (s.phase === "inside") {
          s.phase = "leaving";
          s.count = 1;
          s.leftAt = s.lastAt;
        } else {
          s.count += 1;
        }
        if (s.count < GEOFENCE_CONFIRMATIONS) continue;
        depart(current, s.leftAt);
        // puis on regarde tout de suite si cette position est déjà dans l'entrée suivante
      } else {
        s.phase = "inside";
        s.count = 0;
        s.leftAt = null;
        continue;
      }
    }

    // 2. En chemin : chercher une arrivée parmi les prochains arrêts
    const [nearest] = candidatesAt(position);
    if (!nearest) {
      if (s.phase === "entering") s = idle(s.lastAt, s.lastDepartedAt);
      continue;
    }
    if (s.phase === "entering" && s.stopId === nearest.stop.id) {
      s.count += 1;
    } else {
      s = { ...idle(s.lastAt, s.lastDepartedAt), stopId: nearest.stop.id, phase: "entering", count: 1, candidateAt: s.lastAt };
    }
    if (s.count >= GEOFENCE_CONFIRMATIONS) {
      arrive(byId.get(s.stopId), s.candidateAt);
      s.phase = "inside";
      s.count = 0;
    }
  }

  return { state: s, changed: [...changed].map((id) => byId.get(id)) };
};
