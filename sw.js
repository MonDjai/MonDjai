/* ==============================================================
   MonDjai/Salaire — service worker (mode hors ligne)
   Sprint 6A : mécanisme de la famille MonDjai (Revente-E,
   Coiffure-8C), adapté à Salaire. L'application ne fait aucun
   appel réseau : ce fichier garde index.html, manifest.json et
   l'icône sur le téléphone, pour que MonDjai s'ouvre sans
   connexion une fois installée.

   ╔══════════════════════════════════════════════════════════╗
   ║  POUR PUBLIER UNE NOUVELLE VERSION : remplacer index.html ║
   ║  ET sw.js sur GitHub, en changeant seulement ce numéro    ║
   ║  (11 → 12 → 13…), le même que VERSION_APP dans index.html.   ║
   ║  Les téléphones se mettent à jour seuls à l'ouverture,    ║
   ║  sans réinstallation, sans toucher aux données.           ║
   ╚══════════════════════════════════════════════════════════╝
   ============================================================== */
var VERSION_CACHE = "14";

/* Les caches de Salaire commencent par ce préfixe. Seuls ceux-là, et
   ceux des versions 1 à 5B (nommés « mondjai-v1 » à « mondjai-v5 »),
   sont supprimés lors d'une mise à jour : jamais les caches d'une autre
   application MonDjai hébergée à la même adresse (Coiffure, Revente…). */
var PREFIXE_CACHE = "mondjai-salaire-";
var ANCIEN_FORMAT = /^mondjai-v\d+$/;
var CACHE_NAME = PREFIXE_CACHE + "v" + VERSION_CACHE;

/* Fichier indispensable : l'application elle-même. */
var URL_INDEX = new URL("./index.html", self.location.href).href;
/* Fichiers facultatifs : un fichier absent ne fait jamais échouer l'installation. */
var FICHIERS_OPTIONNELS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./icon-monochrome-512.png",
  "./apple-touch-icon.png",
  "./favicon.ico",
  "./favicon-32.png"
];

/* Rappel : un service worker n'a pas accès au localStorage. Ce fichier ne
   lit, n'écrit ni n'efface donc jamais les données (clé mondjai.v2) —
   seulement le cache des fichiers de l'application. */

/* ---------- Installation ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* index.html : toujours redemandé au serveur (cache:"reload" contourne
         le cache HTTP de GitHub Pages). S'il est injoignable, l'installation
         échoue et l'ancienne version reste en place, intacte : le navigateur
         réessaiera à l'ouverture suivante. */
      return cache.add(new Request(URL_INDEX, { cache: "reload" })).then(function () {
        return Promise.all(FICHIERS_OPTIONNELS.map(function (chemin) {
          var url = new URL(chemin, self.location.href).href;
          return fetch(new Request(url, { cache: "reload" })).then(function (rep) {
            if (rep && rep.ok) return cache.put(url, rep);
          }).catch(function () { /* fichier absent ou réseau capricieux : on continue */ });
        }));
      });
    }).then(function () {
      /* La nouvelle version prend la main tout de suite ; la page se
         recharge ensuite d'elle-même, une seule fois, quand c'est sans
         risque (voir index.html). */
      return self.skipWaiting();
    })
  );
});

/* ---------- Activation ---------- */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cles) {
      return Promise.all(cles.filter(function (cle) {
        var miennePrecedente = cle.indexOf(PREFIXE_CACHE) === 0 && cle !== CACHE_NAME;
        return miennePrecedente || ANCIEN_FORMAT.test(cle);
      }).map(function (cle) {
        return caches.delete(cle);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------- Requêtes ---------- */

/* La page de l'application elle-même : le dossier (…/MonDjai/) ou index.html. */
function estPageApplication(url) {
  var dossier = new URL("./", self.location.href).pathname;
  return url.pathname === dossier || url.pathname === dossier + "index.html";
}

/* Rafraîchissement silencieux en arrière-plan : si index.html (ou l'icône)
   a changé sur GitHub, la copie en cache est remplacée pour l'ouverture
   suivante — filet de sécurité si sw.js n'a pas été remplacé en même temps. */
function rafraichir(cache, cle, urlReseau) {
  return fetch(new Request(urlReseau, { cache: "no-cache" })).then(function (rep) {
    if (rep && rep.ok && rep.type === "basic") {
      return cache.put(cle, rep.clone()).then(function () { return rep; }, function () { return rep; });
    }
    return rep;
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  /* Même adresse uniquement : ce service worker ne contacte jamais un autre domaine. */
  if (url.origin !== self.location.origin) return;

  var navigation = req.mode === "navigate";
  var pageApp = navigation && estPageApplication(url);
  var cle = pageApp ? URL_INDEX : req;
  var urlReseau = pageApp ? URL_INDEX : req.url;

  /* Le rafraîchissement en arrière-plan doit pouvoir se terminer après la
     réponse : on prolonge la vie du service worker jusqu'à sa fin. */
  var finArrierePlan;
  event.waitUntil(new Promise(function (resolve) { finArrierePlan = resolve; }));

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(cle).then(function (enCache) {
        if (enCache) {
          /* Cache d'abord : ouverture instantanée, même hors ligne. */
          if (self.navigator.onLine !== false) {
            rafraichir(cache, cle, urlReseau).catch(function () {}).then(finArrierePlan);
          } else {
            finArrierePlan();
          }
          return enCache;
        }
        finArrierePlan();
        /* Pas encore en cache : réseau, puis repli hors ligne. */
        return rafraichir(cache, cle, urlReseau).catch(function () {
          if (navigation) {
            return cache.match(URL_INDEX).then(function (index) { return index || Response.error(); });
          }
          return Response.error();
        });
      });
    }).catch(function () {
      finArrierePlan();
      return fetch(req);
    })
  );
});
