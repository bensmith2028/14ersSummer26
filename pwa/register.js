/* Registers sw.js for offline/installable support. Kept out of app.js so the
   map logic has no dependency on this, and failures here are contained. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Relative, not "/sw.js": this site is served from a repo subpath on
    // GitHub Pages, and a leading slash would point at the domain root.
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* offline support just won't be available -- the site itself still works */
    });
  });
}
