/* ==============================================================
   MonDjai — service worker
   Rôle : rendre l'application utilisable sans connexion.
   IMPORTANT : à chaque nouvelle version de l'application,
   changez le numéro dans CACHE (v1 -> v2, etc.) pour que
   les téléphones récupèrent bien les fichiers mis à jour.
   ============================================================== */
"use strict";

var CACHE = "mondjai-v1";

var FICHIERS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-512.png"
];

/* Installation : on met les fichiers en réserve. */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(FICHIERS);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

/* Activation : on supprime les réserves des anciennes versions. */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(cles){
      return Promise.all(cles.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* Lecture : on sert d'abord la réserve locale. */
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then(function(rep){
      if(rep) return rep;
      return fetch(req).then(function(net){
        if(net && net.status === 200 && net.type === "basic"){
          var copie = net.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copie); });
        }
        return net;
      }).catch(function(){
        /* Hors ligne et fichier inconnu : on renvoie la page d'accueil. */
        if(req.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
