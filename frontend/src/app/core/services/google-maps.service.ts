import { Injectable } from "@angular/core";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { environment } from "../../../environments/environment";

/** Adresse structurée extraite d'un résultat Google, prête pour le formulaire d'adresse de service. */
export interface ResolvedAddress {
  CivicNumber: string;
  Street: string;
  City: string;
  PostalCode: string;
  PlaceId: string | null;
  Latitude: number;
  Longitude: number;
}

export interface AddressSuggestion {
  mainText: string;
  secondaryText: string;
  prediction: google.maps.places.PlacePrediction;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Résultat d'une recherche texte : coordonnées + identifiant Google permanent. */
export interface GeocodedPlace extends LatLng {
  placeId: string | null;
}

/** Trajet routier calculé par Google (Routes API) : affiché seulement, jamais stocké. */
export interface DrivingRoute {
  path: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
}

/** Trajet routier découpé par tronçon : le tronçon i va du point i au point i + 1. */
export interface DrivingLegs {
  legs: { path: LatLng[]; distanceMeters: number; durationSeconds: number }[];
}

/** Routes API : 25 points intermédiaires max par requête (+ origine + destination). */
const MAX_INTERMEDIATES = 25;

/** Classes Google nécessaires à une carte avec marqueurs numérotés. */
export interface MapLibraries {
  Map: typeof google.maps.Map;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  PinElement: typeof google.maps.marker.PinElement;
  Polyline: typeof google.maps.Polyline;
  LatLngBounds: typeof google.maps.LatLngBounds;
}

/** Rayon de recherche d'un panorama autour de l'adresse (m). Au-delà, la vue ne montre plus l'entrée. */
const STREET_VIEW_RADIUS_METERS = 50;
const SUGGESTION_REGION_CODES = ["ca"];
const LANGUAGE = "fr";

/**
 * Accès unique à l'API Google Maps JS (Places New + Street View).
 * Le script n'est chargé qu'à la première utilisation (pas de coût au démarrage de l'app).
 * Si aucune clé n'est configurée, `isEnabled` est faux et les formulaires restent en saisie manuelle.
 */
@Injectable({ providedIn: "root" })
export class GoogleMapsService {
  readonly isEnabled = Boolean(environment.googleMapsApiKey);
  /** Map ID requis par les marqueurs avancés. DEMO_MAP_ID convient au dev ; en prod, créer un Map ID dans Google Cloud. */
  readonly mapId = environment.googleMapsMapId || "DEMO_MAP_ID";

  private optionsSet = false;
  private sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

  private async places(): Promise<google.maps.PlacesLibrary> {
    this.ensureOptions();
    return importLibrary("places");
  }

  private ensureOptions(): void {
    if (!this.isEnabled) {
      throw new Error("Google Maps n'est pas configuré (googleMapsApiKey manquant).");
    }
    if (!this.optionsSet) {
      setOptions({ key: environment.googleMapsApiKey, v: "weekly", language: LANGUAGE, region: "CA" });
      this.optionsSet = true;
    }
  }

  /**
   * Suggestions d'adresses (Canada seulement). Les appels d'une même saisie partagent un jeton
   * de session : Google facture la session entière comme une seule requête Place Details.
   */
  async searchAddresses(input: string): Promise<AddressSuggestion[]> {
    const { AutocompleteSuggestion, AutocompleteSessionToken } = await this.places();
    this.sessionToken ??= new AutocompleteSessionToken();

    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: this.sessionToken,
      includedRegionCodes: SUGGESTION_REGION_CODES,
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      language: LANGUAGE,
      region: "ca"
    });

    return suggestions
      .map((s) => s.placePrediction)
      .filter((p): p is google.maps.places.PlacePrediction => p !== null)
      .map((prediction) => ({
        mainText: prediction.mainText?.text ?? prediction.text.text,
        secondaryText: prediction.secondaryText?.text ?? "",
        prediction
      }));
  }

  /** Détails de la suggestion choisie ; clôt la session d'autocomplete. */
  async resolveSuggestion(suggestion: AddressSuggestion): Promise<ResolvedAddress> {
    const place = suggestion.prediction.toPlace();
    await place.fetchFields({ fields: ["addressComponents", "location"] });
    this.sessionToken = null;

    const component = (type: string, short = false): string => {
      const found = place.addressComponents?.find((c) => c.types.includes(type));
      return (short ? found?.shortText : found?.longText) ?? "";
    };

    return {
      CivicNumber: component("street_number"),
      Street: component("route"),
      City: component("locality") || component("sublocality") || component("administrative_area_level_3"),
      PostalCode: component("postal_code").replace(/\s/g, "").toUpperCase(),
      PlaceId: place.id || null,
      Latitude: place.location?.lat() ?? 0,
      Longitude: place.location?.lng() ?? 0
    };
  }

  /** Géocode une adresse texte (adresses saisies avant l'autocomplete). Utilise Places, pas l'API Geocoding. */
  async geocode(text: string): Promise<GeocodedPlace | null> {
    const { Place } = await this.places();
    const { places } = await Place.searchByText({
      textQuery: text,
      fields: ["id", "location"],
      language: LANGUAGE,
      region: "ca",
      maxResultCount: 1
    });
    const location = places[0]?.location;
    return location ? { lat: location.lat(), lng: location.lng(), placeId: places[0].id || null } : null;
  }

  /**
   * Coordonnées à jour d'un lieu connu par son PlaceId (Place Details, champ location seulement).
   * Sert à rafraîchir le cache de coordonnées Google (conditions Google : seul le place_id est permanent).
   */
  async fetchLocation(placeId: string): Promise<LatLng | null> {
    const { Place } = await this.places();
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ["location"] });
    return place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null;
  }

  /**
   * Trajet routier réel (voiture) qui passe par `points` dans l'ordre : départ, arrêts, retour.
   * Au-delà de 25 arrêts intermédiaires, découpé en tronçons consécutifs (100 arrêts ≈ 4-5 requêtes).
   * Requiert « Routes API » activée pour la clé du navigateur. Rien n'est enregistré (conditions Google).
   */
  async computeDrivingRoute(points: LatLng[]): Promise<DrivingRoute> {
    this.ensureOptions();
    const { Route } = await importLibrary("routes");
    const chunks: LatLng[][] = [];
    for (let i = 0; i < points.length - 1; i += MAX_INTERMEDIATES + 1) {
      chunks.push(points.slice(i, i + MAX_INTERMEDIATES + 2));
    }
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const { routes } = await Route.computeRoutes({
          origin: chunk[0],
          destination: chunk[chunk.length - 1],
          intermediates: chunk.slice(1, -1).map((location) => ({ location })),
          travelMode: "DRIVING",
          polylineQuality: "OVERVIEW",
          language: LANGUAGE,
          region: "ca",
          fields: ["path", "distanceMeters", "durationMillis"]
        });
        const route = routes?.[0];
        if (!route) throw new Error("aucun trajet trouvé par Google");
        return route;
      })
    );
    return {
      path: results.flatMap((r) => (r.path ?? []).map((p) => ({ lat: p.lat, lng: p.lng }))),
      distanceMeters: results.reduce((sum, r) => sum + (r.distanceMeters ?? 0), 0),
      durationSeconds: Math.round(results.reduce((sum, r) => sum + (r.durationMillis ?? 0), 0) / 1000)
    };
  }

  /**
   * Même trajet que computeDrivingRoute, mais un tracé par tronçon (arrêt → arrêt suivant),
   * pour griser ce qui est fait et faire ressortir le prochain tronçon. Même coût en requêtes.
   */
  async computeDrivingLegs(points: LatLng[]): Promise<DrivingLegs> {
    this.ensureOptions();
    const { Route } = await importLibrary("routes");
    const chunks: LatLng[][] = [];
    for (let i = 0; i < points.length - 1; i += MAX_INTERMEDIATES + 1) {
      chunks.push(points.slice(i, i + MAX_INTERMEDIATES + 2));
    }
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const { routes } = await Route.computeRoutes({
          origin: chunk[0],
          destination: chunk[chunk.length - 1],
          intermediates: chunk.slice(1, -1).map((location) => ({ location })),
          travelMode: "DRIVING",
          polylineQuality: "OVERVIEW",
          language: LANGUAGE,
          region: "ca",
          fields: ["legs"]
        });
        const legs = routes?.[0]?.legs;
        if (!legs || legs.length !== chunk.length - 1) throw new Error("trajet incomplet renvoyé par Google");
        return legs;
      })
    );
    return {
      legs: results.flat().map((leg) => ({
        path: (leg.path ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
        distanceMeters: leg.distanceMeters ?? 0,
        durationSeconds: Math.round((leg.durationMillis ?? 0) / 1000)
      }))
    };
  }

  /** Charge les librairies de carte et de marqueurs (une seule fois, au premier affichage de carte). */
  async mapLibraries(): Promise<MapLibraries> {
    this.ensureOptions();
    const [{ Map, Polyline }, { AdvancedMarkerElement, PinElement }, { LatLngBounds }] = await Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
      importLibrary("core")
    ]);
    return { Map, Polyline, AdvancedMarkerElement, PinElement, LatLngBounds };
  }

  /**
   * Affiche dans `container` le panorama Street View le plus proche, orienté vers l'adresse
   * (donc vers l'entrée) plutôt que dans l'axe de la rue. Retourne false si aucun panorama.
   */
  async showStreetView(container: HTMLElement, target: LatLng): Promise<boolean> {
    this.ensureOptions();
    const [{ StreetViewService, StreetViewPanorama }, { spherical }] = await Promise.all([
      importLibrary("streetView"),
      importLibrary("geometry")
    ]);

    let data: google.maps.StreetViewPanoramaData;
    try {
      ({ data } = await new StreetViewService().getPanorama({
        location: target,
        radius: STREET_VIEW_RADIUS_METERS,
        preference: google.maps.StreetViewPreference.NEAREST,
        sources: [google.maps.StreetViewSource.OUTDOOR]
      }));
    } catch {
      return false; // ZERO_RESULTS : pas de couverture à cette adresse
    }

    const panoPosition = data.location?.latLng;
    if (!data.location?.pano || !panoPosition) return false;

    new StreetViewPanorama(container, {
      pano: data.location.pano,
      pov: { heading: spherical.computeHeading(panoPosition, target), pitch: 5 },
      zoom: 1,
      addressControl: false,
      fullscreenControl: true,
      motionTracking: false,
      motionTrackingControl: false,
      showRoadLabels: false
    });
    return true;
  }
}
