/* ============================================================
   DROOOLY — vehicle library for the visualizer
   One entry per fitment-distinct platform. Single source of truth: script.js
   derives its homepage finder lists from this, so the finder and the
   visualizer can hand off to each other.

   IMPORTANT — `measured`:
     fenderRadiusIn (hub centre -> fender lip) and faceToFenderIn (hub mounting
     face -> outer fender edge) are ESTIMATES until someone puts a tape on a
     real truck. While measured:false the UI describes stance in words rather
     than printing a decimal, because inventing precision is exactly the
     "misled by numbers" problem this tool exists to prevent.

     faceToFenderIn is back-solved from the factory wheel, which is the one
     data point we can trust: a stock truck sits about flush to slightly
     tucked, so fender edge ~= (stock rim width / 2) - stock offset, plus a
     small margin. Dually rears come out around 1-2" because the outer wheel's
     lip sits barely outboard of its own mounting face -- the pedestal does the
     work, not the barrel. Getting this wrong is what made a factory truck read
     as "well inside the fender" when it is nothing of the sort.
   ============================================================ */
window.VEHICLES = [
  { id:"f250", make:"Ford", models:["F-250 Super Duty","F-350 Super Duty"],
    years:[2017,2026], config:"srw", hd:true, bolt:"8x180",
    stockOffsetMm:13, fenderRadiusIn:20.5, faceToFenderIn:4.0, measured:false,
    body:{ cab:"crew", bedTop:0.30, rocker:0.86, archLift:0 } },

  { id:"f450", make:"Ford", models:["F-450 Super Duty"],
    years:[2017,2026], config:"drw", hd:true, bolt:"10x225",
    stockOffsetMm:86, fenderRadiusIn:21.5, faceToFenderIn:1.6, measured:false,
    body:{ cab:"crew", bedTop:0.30, rocker:0.88, archLift:0 } },

  { id:"gm2500", make:"Chevrolet", models:["Silverado 2500HD","Silverado 3500HD"],
    years:[2020,2026], config:"srw", hd:true, bolt:"8x180",
    stockOffsetMm:20, fenderRadiusIn:20.0, faceToFenderIn:3.7, measured:false,
    body:{ cab:"crew", bedTop:0.31, rocker:0.86, archLift:0 } },

  { id:"gmc2500", make:"GMC", models:["Sierra 2500HD","Sierra 3500HD"],
    years:[2020,2026], config:"srw", hd:true, bolt:"8x180",
    stockOffsetMm:20, fenderRadiusIn:20.0, faceToFenderIn:3.7, measured:false,
    body:{ cab:"crew", bedTop:0.31, rocker:0.86, archLift:0 } },

  { id:"gm3500drw", make:"Chevrolet", models:["Silverado 3500HD DRW"],
    years:[2020,2026], config:"drw", hd:true, bolt:"8x180",
    stockOffsetMm:79, fenderRadiusIn:21.0, faceToFenderIn:1.8, measured:false,
    body:{ cab:"crew", bedTop:0.31, rocker:0.88, archLift:0 } },

  { id:"ram2500", make:"RAM", models:["2500","3500"],
    years:[2019,2026], config:"srw", hd:true, bolt:"8x165.1",
    stockOffsetMm:19, fenderRadiusIn:20.5, faceToFenderIn:3.75, measured:false,
    body:{ cab:"crew", bedTop:0.30, rocker:0.86, archLift:0 } },

  { id:"ram3500drw", make:"RAM", models:["3500 DRW","4500","5500"],
    years:[2019,2026], config:"drw", hd:true, bolt:"8x165.1",
    stockOffsetMm:102, fenderRadiusIn:21.5, faceToFenderIn:1.0, measured:false,
    body:{ cab:"crew", bedTop:0.30, rocker:0.88, archLift:0 } },

  /* half-tons — the catalog carries 6x135 and 5x139.7 wheels, so they belong
     here even though the homepage finder is HD-only today. */
  { id:"f150", make:"Ford", models:["F-150"],
    years:[2021,2026], config:"srw", hd:false, bolt:"6x135",
    stockOffsetMm:44, fenderRadiusIn:18.5, faceToFenderIn:3.0, measured:false,
    body:{ cab:"crew", bedTop:0.32, rocker:0.85, archLift:0 } },

  { id:"ram1500", make:"RAM", models:["1500"],
    years:[2019,2026], config:"srw", hd:false, bolt:"5x139.7",
    stockOffsetMm:25, fenderRadiusIn:18.5, faceToFenderIn:3.5, measured:false,
    body:{ cab:"crew", bedTop:0.32, rocker:0.85, archLift:0 } }
];

/* Paint options. Names are what a customer would say, not manufacturer codes. */
window.VEHICLE_PAINT = [
  { name:"Black",          hex:"#0d0f13" },
  { name:"White",          hex:"#eef1f4" },
  { name:"Iconic Silver",  hex:"#9aa1a9" },
  { name:"Carbonized Grey",hex:"#4d5359" },
  { name:"Race Red",       hex:"#8e1b22" },
  { name:"Blue Jeans",     hex:"#274a72" },
  { name:"Army Green",     hex:"#404a38" },
  { name:"Agate Black",    hex:"#16181c" },
  { name:"Bronze Fire",    hex:"#8a4a1e" },
  { name:"Atlas Blue",     hex:"#16324f" }
];

/* Resolve a stored {year, make, model} from the homepage finder to a platform. */
window.matchVehicle = function (year, make, model) {
  var list = window.VEHICLES || [];
  var m = String(model || "").toLowerCase().trim();
  var mk = String(make || "").toLowerCase().trim();
  var best = null, bestLen = -1;
  list.forEach(function (v) {
    if (String(v.make).toLowerCase() !== mk) return;
    v.models.forEach(function (mm) {
      var a = mm.toLowerCase();
      if (a === m) { best = v; bestLen = 999; return; }        // exact wins outright
      if (bestLen === 999) return;
      /* Longest match wins, or "3500 DRW" lands on the single-rear 3500 —
         which is a different truck with a different stance entirely. */
      if ((m.indexOf(a) > -1 || a.indexOf(m) > -1) && a.length > bestLen) {
        best = v; bestLen = a.length;
      }
    });
  });
  return best;
};
