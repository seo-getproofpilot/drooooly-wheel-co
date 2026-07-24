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
  },
  {
    slug: "toyo", name: "Toyo Tires", site: "https://www.toyotires.com",
    tagline: "Open Country all-terrain, mud and rugged tread — plus Proxes street.", logo: "assets/tires/toyo/logo.svg", pricing: "from",
    models: [
      { model: "Open Country A/T III", tread: "All-Terrain", img: "assets/tires/toyo/opencountryatiii.png", rims: [17,18,20,22], sizes: ["35x12.50R17LT","37x12.50R17LT","35x12.50R18LT","P295/55R20","LT275/60R20","33x12.50R20LT","35x12.50R20LT","37x12.50R20LT","35x12.50R22LT"], priceFrom: 367, feat: 1 },
      { model: "Open Country M/T", tread: "Mud-Terrain", img: "assets/tires/toyo/opencountrymt.png", rims: [20], sizes: ["35x12.50R20LT"], priceFrom: 508, feat: 2 },
      { model: "Open Country R/T Trail", tread: "Rugged-Terrain", img: "assets/tires/toyo/opencountryrttrail.png", rims: [17], sizes: ["35x12.50R17LT","37x12.50R17LT"], priceFrom: 442, feat: 3 },
      { model: "Open Country R/T PRO", tread: "Rugged-Terrain", img: "assets/tires/toyo/opencountryrtpro.png", rims: [18,20], sizes: ["35x12.50R18LT","35x12.50R20LT"], priceFrom: 519, feat: 4 },
      { model: "Proxes ST III", tread: "Street / Highway", img: "assets/tires/toyo/proxesstiii.png", rims: [20,22], sizes: ["305/50R20","305/40R22","305/45R22"], priceFrom: 266, feat: 5 }
    ]
  }
];
