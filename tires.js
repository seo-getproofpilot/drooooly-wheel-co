/* ============================================================
   DROOOLY Wheel Co. — tire catalog
   tread : "Mud-Terrain" | "All-Terrain" | "Highway" | "All-Season" ...
   sizes : every size we list for that tread, sorted by rim diameter
   rims  : distinct rim diameters, derived from sizes
   GENERATED FILE — rebuilt by tools/build-tires.js
   ============================================================ */
window.TIRES = [
  {
    slug: "nitto", name: "Nitto", site: "https://www.nittotire.com",
    tagline: "Street, all-terrain and mud tread built for trucks.", logo: "assets/tires/nitto/logo.svg", pricing: "from",
    models: [
      { model: "Ridge Grappler", tread: "Hybrid All-Terrain / Mud", img: "assets/tires/nitto/ridgegrappler.png", rims: [17,18,20,22], sizes: ["285/70R17","35x12.50R17LT","35x12.50R18LT","33x12.50R20LT","35x11.5R20LT","35x12.50R20LT","37x12.50R20LT","35x12.50R22LT"], priceFrom: 300, feat: 1 },
      { model: "Mud Grappler", tread: "Mud-Terrain", img: "assets/tires/nitto/mudgrappler.png", rims: [17,20], sizes: ["35x12.50R17LT","35x12.50R20LT","37x13.50R20LT"], priceFrom: 449, feat: 2 },
      { model: "NT420V", tread: "Highway / Street", img: "assets/tires/nitto/nt420v.png", rims: [20,22], sizes: ["275/55R20XL","305/50R20XL","305/40R22XL","285/45R22XL","305/45R22XL"], priceFrom: 192, feat: 3 }
    ]
  }
];
