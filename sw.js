/* ==============================================================
   MonDjai — service worker (mode hors ligne)
   Sprint 4. Aucun appel réseau n'est fait par l'application :
   ce fichier ne sert qu'à garder les 4 fichiers sur le téléphone
   pour que MonDjai s'ouvre sans connexion, une fois installée.

   IMPORTANT : à chaque nouvelle version déposée sur GitHub Pages,
   le numéro ci-dessous change. C'est ce qui dit au téléphone
   « va rechercher les fichiers, ils ont été mis à jour ».
   ============================================================== */
var CACHE = "mondjai-v4";

var FICHIERS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-512.png"
];

/* --- installation : on range les fichiers dans le cache --- */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      /* fichier par fichier : si l'icône manque, l'installation réussit quand même */
      return Promise.all(FICHIERS.map(function(f){
        return cache.add(new Request(f, {cache: "reload"})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

/* --- activation : on jette les caches des versions précédentes --- */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(cles){
      return Promise.all(cles.map(function(c){
        return (c === CACHE) ? null : caches.delete(c);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* --- lecture : le cache d'abord (donc instantané et hors ligne),
       puis mise à jour discrète en arrière-plan si le réseau existe --- */
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(function(rep){
      var reseau = fetch(req).then(function(fraiche){
        if(fraiche && fraiche.status === 200 && fraiche.type === "basic"){
          var copie = fraiche.clone();
          caches.open(CACHE).then(function(cache){ cache.put(req, copie); });
        }
        return fraiche;
      }).catch(function(){
        /* hors ligne : on se rabat sur la page d'accueil mise en cache */
        return rep || caches.match("./index.html");
      });
      return rep || reseau;
    })
  );
});
