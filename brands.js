/* ============================================================
   DROOOLY Wheel Co. — brand + wheel catalog data
   Real, verified model lineups per brand.
   configs: "single" | "dually" | "super single"
   img (optional): path under assets/ for a real product photo
   ============================================================ */
window.BRANDS = [
  {
    slug: "jtx", name: "JTX Forged", kind: "Forged", featured: true,
    site: "https://jtxforged.com", tagline: "Premium forged wheels for trucks & duallies — made in the USA.",
    models: [
      { model: "404", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Ace", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Alpha", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Arcane", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Archetype", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Avalon", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Ballistic", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Bandit", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Bio", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Bludgeon", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Botanic", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Bristle", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Cadaver", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Cannon", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"], img: "assets/wheel-angle-1.png" },
      { model: "Capital", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Capo", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Capo Max", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Carbine", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Centerfire", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Chamber", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Chief", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Chisel", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Chrono", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Citation", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Combat", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"], img: "assets/wheel-angle-2.png" },
      { model: "Commander", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Conflict", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Contra", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Crater", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Credo", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Culprit", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Czar", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-200", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-201", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-202", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-203", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-204", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-205", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-206", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-207", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-208", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-209", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-210", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-211", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-212", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-213", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-214", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-215", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-216", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "D-217", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Defector", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Dime", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Dominion", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Empire", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Era", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Felon", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Flight", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"], img: "assets/wheel-angle-3.png" },
      { model: "Fracture", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Game", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Giza", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Grip", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Icon", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Imperial", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Infidel", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Infinity", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Inhibitor", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Intrepid", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Jefe", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Joro", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Judge", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Keen", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Krueger", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Lok", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Lotus", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Major", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"], img: "assets/wheel-face-1.png" },
      { model: "Manifest", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Maze", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Melee", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Militia", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Monarch", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Mortal", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Myriad", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Myth", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Omen", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Orbit", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Paradigm", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Phoenix", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Pike", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Pinnacle", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Prime", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Prodigy", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Pronto", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Prophet", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Psycho", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Raider", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Reaper", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"], img: "assets/wheel-face-2.png" },
      { model: "Recluse", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Recon", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Revolt", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Rozay", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Rumble", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Rupture", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Savage", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Savant", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Scathe", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Schizo", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Schizo Max", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Scissor", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Semi", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Sensu", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Silencer", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Slayer", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-200", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-201", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-202", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-203", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-204", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-205", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-206", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-207", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-208", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-209", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-210", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-211", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-212", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-213", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-214", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-215", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-216", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-217", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-218", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-219", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-220", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-221", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-222", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-223", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-224", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-225", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "SS-226", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Stiletto", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Sublime", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Summit", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Suppressor", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Surge", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Tenet", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Tomahawk", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Triad", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25","28x8.25","30x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Trinity", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Vanquish", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Veil", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Vertex", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Vex", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Widow", configs: ["single","dually","super single"], sizes: ["22x12","22x8.25","24x14","24x8.25","26x16","26x8.25","28x8.25"], finishes: ["Polished","Brushed","Black","Black Milled"] },
      { model: "Zone", configs: ["single"], sizes: ["22x12","24x14","26x16","28x16","30x16"], finishes: ["Polished","Brushed","Black","Black Milled"] }
    ]
  },
  {
    slug: "american-force", name: "American Force", kind: "Forged", featured: true,
    site: "https://www.americanforcewheels.com", tagline: "Truly All-American forged single-piece & dually wheels.",
    models: [
      { model: "Independence SS", configs: ["single","dually"], sizes: ["22x10","22x12","24x14","26x16"], finishes: ["Polished","Black","Brushed"], img: "assets/wheel-americanforce.png" },
      { model: "11 Independence DRW", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Black","Custom"] },
      { model: "611 Independence SD", configs: ["super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Black"] },
      { model: "6N33 Barrage", configs: ["dually","single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Black Milled"] },
      { model: "6N32 Trooper", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Black Milled"] },
      { model: "Trax SS", configs: ["single"], sizes: ["22x10","22x12","24x14","26x14"], finishes: ["Polished","Black","Brushed"] },
      { model: "Octane SS", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black","Machined"] },
      { model: "Blade SS", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black","Brushed"] },
      { model: "Kash SS", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black","Brushed"] },
      { model: "Rebel SS", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black","Brushed"] },
      { model: "Flux SS", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black","Brushed"] },
      { model: "Atom SS", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black","Machined"] },
      { model: "N65 Scout", configs: ["single"], sizes: ["22x12","24x12","26x14"], finishes: ["Polished","Black Milled"] },
      { model: "CKH61 Slingshot", configs: ["single"], sizes: ["22x12","24x12","26x14"], finishes: ["Polished","Brushed","Black"] }
    ]
  },
  {
    slug: "kg1", name: "KG1 Forged", kind: "Forged", featured: true,
    site: "https://kg1forged.com", tagline: "True forged custom dually & super single wheels.",
    models: [
      { model: "Master (KD001)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed","Custom"] },
      { model: "Honor (KD002)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "Sarge (KD003)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black","Custom"] },
      { model: "Razor (KD005)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "Blitz (KD006)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black"] },
      { model: "Orbital (KD008)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "Luxor (KD016)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black","Custom"] },
      { model: "Vegas (KD051)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "Czar (KD060)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black"] },
      { model: "Guilttrip (KD115)", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] }
    ]
  },
  {
    slug: "fuel", name: "Fuel", kind: "Forged", featured: true,
    site: "https://www.fueloffroad.com", tagline: "Fuel Forged — the largest forged wheels in the business.",
    models: [
      { model: "FF19", configs: ["single"], sizes: ["22x10","22x12","24x14","28x10"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "FF19D", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25","22x12"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "FF09", configs: ["single"], sizes: ["22x10","22x12","24x14","26x14"], finishes: ["Polished","Gloss Black Milled","Matte Black Milled"] },
      { model: "FF09D", configs: ["dually","super single"], sizes: ["20x8.25","22x8.25","24x8.25"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "FF39", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished"] },
      { model: "FF39D", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "FF29", configs: ["single"], sizes: ["22x12","24x14","26x14"], finishes: ["Gloss Black Milled","Brushed","Polished"] },
      { model: "FFC129 Crime", configs: ["single"], sizes: ["22x12","24x14","26x16","30x16"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "FFC130 Impulse", configs: ["single"], sizes: ["22x12","24x14","26x16"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "Triton D581", configs: ["single","dually"], sizes: ["20x8.25","22x8.25","22x12"], finishes: ["Chrome","Black Milled","Gloss Black"] },
      { model: "Maverick", configs: ["single","dually"], sizes: ["20x8.25","22x8.25","22x10"], finishes: ["Chrome","Black","Black Milled"] },
      { model: "Cleaver", configs: ["single","dually"], sizes: ["20x8.25","22x10","24x12"], finishes: ["Chrome","Black","Black Milled"] }
    ]
  },
  {
    slug: "hostile", name: "Hostile", kind: "Forged", featured: true,
    site: "https://www.hostilewheels.com", tagline: "Take no prisoners — Hostile Forged, dually & super single.",
    models: [
      { model: "H401 Sprocket", configs: ["dually","super single","single"], sizes: ["20x8.25","22x8.25","22x12"], finishes: ["Black Milled","Satin Black","Blade Cut"], img: "assets/wheel-hostile.png" },
      { model: "H402 Diablo", configs: ["dually","super single","single"], sizes: ["20x8.25","22x8.25","22x12"], finishes: ["Black Milled","Satin Black","Blade Cut"] },
      { model: "H404 Ghost", configs: ["dually","super single"], sizes: ["20x8.25","22x8.25","22x12"], finishes: ["Gloss Black","Gloss Black Milled"] },
      { model: "H403 Kodiak", configs: ["dually"], sizes: ["20x8.25","22x8.25"], finishes: ["Black Milled","Gloss Black"] },
      { model: "HF02 Superbeast", configs: ["single"], sizes: ["22x12","24x12","26x12"], finishes: ["Polished"] },
      { model: "HF07 Tomahawk", configs: ["single"], sizes: ["22x12","24x12","26x14"], finishes: ["Polished","Gloss Black"] },
      { model: "HF08 Savage", configs: ["single"], sizes: ["22x12","24x12","26x12"], finishes: ["Polished","Gloss Black"] },
      { model: "HF17 Trident", configs: ["single"], sizes: ["22x12","24x12","26x14"], finishes: ["Polished","Gloss Black"] },
      { model: "HF108 Sprocket", configs: ["single"], sizes: ["22x12","24x12","26x14"], finishes: ["Polished"] },
      { model: "HF127 Titan", configs: ["single"], sizes: ["24x12","26x14"], finishes: ["Polished","Gloss Black"] },
      { model: "Sprocket H108", configs: ["single"], sizes: ["20x12","22x12","24x12"], finishes: ["Chrome","Black Milled","Blade Cut"] },
      { model: "Gauntlet H107", configs: ["single"], sizes: ["20x10","20x12","22x12"], finishes: ["Blade Cut","Asphalt","Black Milled"] }
    ]
  },
  {
    slug: "amani", name: "Amani Forged", kind: "Forged", featured: true,
    site: "https://amaniforged.com", tagline: "Multi-piece forged dually wheels with billet floaters.",
    models: [
      { model: "Allora", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Apollo", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Chile", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Conrad", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Cultura", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Desire", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Devine", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Empire", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Magnolia", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Napoliano", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] },
      { model: "Perdomo", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Brushed Silver","Brushed Silver Red"] }
    ]
  },
  {
    slug: "fenix", name: "Fenix Forged", kind: "Forged",
    site: "https://fenixforged.com", tagline: "Built to outlast the road — forged single, dually & super single.",
    models: [
      { model: "L2002 Liberty", configs: ["super single","dually"], sizes: ["22","24","26"], finishes: ["Polished","Black"] },
      { model: "L2003 Hurricane", configs: ["super single","dually"], sizes: ["22","24","26"], finishes: ["Polished","Black"] },
      { model: "L2004 Strata", configs: ["super single","dually"], sizes: ["22","24","26"], finishes: ["Polished","Black"] },
      { model: "FD002", configs: ["single"], sizes: ["22x10","22x12","24x14"], finishes: ["Polished","Black"] },
      { model: "FD012", configs: ["single"], sizes: ["20x12","22x12","24x14"], finishes: ["Polished","Black"] },
      { model: "FD014 Throwback", configs: ["single","dually"], sizes: ["20","22","24"], finishes: ["Polished","Black"] },
      { model: "BT002 Omega", configs: ["single","dually"], sizes: ["22","24","26"], finishes: ["Polished","Black"] },
      { model: "FDS Super Single", configs: ["super single","dually"], sizes: ["22","24","26"], finishes: ["Polished","Black"] }
    ]
  },
  {
    slug: "liberty", name: "Liberty Forged", kind: "Forged",
    site: "https://www.libertyforged.com", tagline: "Billet floaters with every set — forged super singles & duallies.",
    models: [
      { model: "Super Single Series", configs: ["single","super single"], sizes: ["22x12","24x14","26x16"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "Concave Series", configs: ["single"], sizes: ["24x14","26x14","26x16"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "LBTYD07 Dually", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "LBTYD12 Dually", configs: ["dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "LBTYD16 Dually", configs: ["dually"], sizes: ["22x8.25","24x8.25","28x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "LBTYD19 Dually", configs: ["dually"], sizes: ["24x8.25","26x8.25","28x8.25"], finishes: ["Polished","Gloss Black","Brushed"] },
      { model: "LBTYD23 Dually", configs: ["dually"], sizes: ["24x8.25","26x8.25","30x8.25"], finishes: ["Polished","Gloss Black","Brushed"] }
    ]
  },
  {
    slug: "axe", name: "AXE Offroad", kind: "Forged",
    site: "https://axewheels.com", tagline: "Defined by design — forged directional duallies & off-road.",
    models: [
      { model: "AF6 Forged", configs: ["single","dually"], sizes: ["22x8.25","24x8.25","24x14"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "AF10 Directional", configs: ["single","dually"], sizes: ["22x8.25","24x8.25","26x8.25"], finishes: ["Polished","Gloss Black Milled"] },
      { model: "AF12 Xerox", configs: ["single"], sizes: ["24x12","26x14"], finishes: ["Polished","Black Milled"] },
      { model: "AX1.1", configs: ["single"], sizes: ["20x10","22x12","24x14"], finishes: ["Gloss Black","Chrome","Bronze"] },
      { model: "AX2.2", configs: ["single"], sizes: ["20x9.5","22x12","24x12"], finishes: ["Black Milled","Polished","Chrome"] },
      { model: "AX6.1", configs: ["single"], sizes: ["20x10","22x12","24x14"], finishes: ["Black Milled","Polished","Matte Black"] },
      { model: "Kratos", configs: ["single"], sizes: ["20x12","22x12","24x12"], finishes: ["Gloss Black Milled","Bronze"] }
    ]
  },
  {
    slug: "tis", name: "TIS Wheels", kind: "Off-Road",
    site: "https://tiswheels.com", tagline: "Patented deep-lip monoblock truck & dually wheels.",
    models: [
      { model: "544 Dually", configs: ["single","dually"], sizes: ["20x8.25","22","24"], finishes: ["Gloss Black","Black Milled","Chrome","Brushed"] },
      { model: "547", configs: ["single"], sizes: ["20","22","24"], finishes: ["Gloss Black","Black Milled","Chrome"] },
      { model: "560", configs: ["single"], sizes: ["20","22","24"], finishes: ["Gloss Black","Black Milled","Chrome"] },
      { model: "566", configs: ["single"], sizes: ["20","22","24"], finishes: ["Gloss Black","Black Milled","Chrome"] },
      { model: "567", configs: ["single"], sizes: ["20","22","24"], finishes: ["Gloss Black","Black Milled","Chrome"] },
      { model: "556", configs: ["single"], sizes: ["20","22","24"], finishes: ["Satin Black","Anthracite"] },
      { model: "538", configs: ["single"], sizes: ["20","22"], finishes: ["Gloss Black","Matte Black","Black Milled"] }
    ]
  },
  {
    slug: "vision", name: "Vision Wheel", kind: "HD / Dually",
    site: "https://www.visionwheel.com", tagline: "HD workhorse duallies and off-road truck wheels.",
    models: [
      { model: "181 Hauler Dually", configs: ["dually"], sizes: ["16","17","19.5"], finishes: ["Chrome","Machined","Matte Black"] },
      { model: "181NR Hauler 19.5", configs: ["dually"], sizes: ["19.5"], finishes: ["Chrome","Machined","Matte Black"] },
      { model: "401 Rival Dually", configs: ["dually"], sizes: ["20"], finishes: ["Gloss Black Machined","Satin Black"] },
      { model: "410 Korupt Dually", configs: ["dually"], sizes: ["16","17"], finishes: ["Gloss Black Milled","Satin Black"] },
      { model: "408 Manx 2 Dually", configs: ["dually"], sizes: ["16","17"], finishes: ["Satin Black","Satin Grey"] },
      { model: "56 Midway", configs: ["dually","single"], sizes: ["16","17","20"], finishes: ["Polished","Satin Black"] },
      { model: "412 Rocker", configs: ["single"], sizes: ["18","20","22","24"], finishes: ["Chrome","Gloss Black","Satin Black"] },
      { model: "111 Nemesis Forged Beadlock", configs: ["single"], sizes: ["17","18","20"], finishes: ["Polished Forged","Matte Black","Gunmetal"] }
    ]
  },
  {
    slug: "fittipaldi", name: "Fittipaldi Off Road", kind: "Forged",
    site: "https://www.fittipaldioffroad.com", tagline: "Forged truck & dually wheels — directional, true left/right.",
    models: [
      { model: "FDF600 Dually", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black","Black Milled"] },
      { model: "FDF601 Dually", configs: ["dually","super single"], sizes: ["22x8.25","24x8.25"], finishes: ["Polished","Gloss Black","Black Milled"] },
      { model: "FTF501", configs: ["single"], sizes: ["20x10","22x10","24x12"], finishes: ["Gloss Black","Black Milled","Brushed"] },
      { model: "FTF503", configs: ["single"], sizes: ["20x10","22x12","24x12"], finishes: ["Gloss Black","Black Milled"] },
      { model: "FTF507", configs: ["single"], sizes: ["22x12","24x12"], finishes: ["Polished","Gloss Black","Black Milled"] }
    ]
  },
  {
    slug: "arkon", name: "Arkon Off-Road", kind: "Off-Road",
    site: "https://www.arkonoffroad.com", tagline: "Proper directional deep-concave show-truck wheels.",
    models: [
      { model: "Lincoln", configs: ["single"], sizes: ["20x10","20x12","22x12","24x14"], finishes: ["Black Milled","Chrome","Gloss Black"] },
      { model: "Roosevelt", configs: ["single"], sizes: ["20x10","20x12","22x12","24x14"], finishes: ["Black Milled","Chrome","Gloss Black"] },
      { model: "Caesar", configs: ["single"], sizes: ["20x10","20x12","22x12","24x14"], finishes: ["Black Milled","Chrome"] },
      { model: "Alexander", configs: ["single"], sizes: ["20x10","20x12","22x12","24x14"], finishes: ["Black Milled","Chrome","Gloss Black"] },
      { model: "Churchill", configs: ["single"], sizes: ["20x12","22x12","24x14","26x14"], finishes: ["Black Milled","Chrome"] },
      { model: "Torx (Forged)", configs: ["single"], sizes: ["22x12","24x14","26x14"], finishes: ["Brushed","Black Milled","Polished"] }
    ]
  },
  {
    slug: "cali", name: "Cali Off-Road", kind: "Off-Road",
    site: "https://www.calioffroadwheels.com", tagline: "Raising traditions — deep-lip truck & dually wheels.",
    models: [
      { model: "Summit", configs: ["single","dually"], sizes: ["20x10","22x12","24x14","20x8.25"], finishes: ["Gloss Black","Polished","Polished Milled"] },
      { model: "Summit Dually", configs: ["dually"], sizes: ["20x8.25","22x8.25"], finishes: ["Polished","Gloss Black Milled","Matte Black"] },
      { model: "Sevenfold", configs: ["single"], sizes: ["20x10","22x12","24x14"], finishes: ["Gloss Black Milled","Gloss Black","Polished"] },
      { model: "Vertex", configs: ["single"], sizes: ["20x10","22x12","24x14","26x14"], finishes: ["Chrome","Gloss Black Milled","Gloss Black"] },
      { model: "Purge", configs: ["single"], sizes: ["20x10","22x12","24x14"], finishes: ["Gloss Black","Brushed","Polished"] },
      { model: "Brutal", configs: ["dually"], sizes: ["20x8.25","22x8.25"], finishes: ["Chrome","Gloss Black"] }
    ]
  },
  {
    slug: "hardrock", name: "Hardrock Offroad", kind: "Off-Road",
    site: "https://hardrockoffroad.com", tagline: "Aggressive off-road & dually wheels — unbeatable value.",
    models: [
      { model: "H700 Affliction", configs: ["single","dually"], sizes: ["20x12","22x12","24x12","20x8.25"], finishes: ["Gloss Black","Gloss Black Milled","Chrome"] },
      { model: "H504 Slammer Xposed", configs: ["single","dually"], sizes: ["20x10","22x12","24x12","20x8.25"], finishes: ["Gloss Black Milled","Chrome"] },
      { model: "H704 Crusher", configs: ["single"], sizes: ["20x12","22x12","24x12"], finishes: ["Gloss Black","Gloss Black Milled"] },
      { model: "H708 Overdrive", configs: ["single"], sizes: ["20x12","22x12","24x12"], finishes: ["Gloss Black","Gloss Black Milled"] },
      { model: "H905 (Forged)", configs: ["single"], sizes: ["20x10","22x10","24x12"], finishes: ["Brushed","Gloss Black Milled"] }
    ]
  },
  {
    slug: "hardcore", name: "Hardcore Off-Road", kind: "Off-Road",
    site: "https://hcoffroad.com", tagline: "Concave truck wheels built for spiked lug nuts.",
    models: [
      { model: "HC19", configs: ["single","dually"], sizes: ["20x12","22x12","24x14","26x14"], finishes: ["Gloss Black Milled","Chrome","Brushed"] },
      { model: "HC13", configs: ["single"], sizes: ["20x12","22x12","24x12"], finishes: ["Gloss Black Milled","Chrome"] },
      { model: "HC17", configs: ["single"], sizes: ["20x12","22x12","24x14"], finishes: ["Gloss Black Milled","Chrome","Bronze"] },
      { model: "HC21", configs: ["single"], sizes: ["22x12","24x12","26x14"], finishes: ["Gloss Black Milled","Chrome"] },
      { model: "Forged DOGE", configs: ["single","dually"], sizes: ["22x8.25","24x8.25","24x14"], finishes: ["Polished","Brushed"] },
      { model: "Forged Elon", configs: ["single","dually"], sizes: ["22x8.25","24x8.25","24x14"], finishes: ["Polished","Brushed"] }
    ]
  },
  {
    slug: "xf", name: "XF Offroad", kind: "Off-Road",
    site: "https://www.xfoffroad.com", tagline: "Flow-forged XFX series & aggressive cast off-road.",
    models: [
      { model: "XFX-301", configs: ["single"], sizes: ["20x10","22x12","24x12"], finishes: ["Brushed","Gloss Black"] },
      { model: "XFX-302", configs: ["single"], sizes: ["20x10","22x12","24x12"], finishes: ["Brushed","Gloss Black"] },
      { model: "XFX-306", configs: ["single"], sizes: ["20x10","22x12","24x12"], finishes: ["Brushed","Gloss Black"] },
      { model: "XF-224", configs: ["single"], sizes: ["20x10","20x12","22x12"], finishes: ["Chrome","Satin Black","Black & Red Milled"] },
      { model: "XF-206", configs: ["single"], sizes: ["20x9","20x10","22x12"], finishes: ["Chrome","Satin Black","Black Milled"] },
      { model: "XF-210", configs: ["single"], sizes: ["20x10","22x12","24x14"], finishes: ["Chrome","Satin Black","Black Milled"] }
    ]
  },
  {
    slug: "method", name: "Method Race Wheels", kind: "Off-Road",
    site: "https://www.methodracewheels.com", tagline: "Engineered for the extreme — Bead Grip & HD truck wheels.",
    models: [
      { model: "305 NV", configs: ["single"], sizes: ["17x8.5","18x9","20x10"], finishes: ["Matte Black","Bronze","Machined"] },
      { model: "305 NV HD", configs: ["single"], sizes: ["17x8.5","18x9","20x10"], finishes: ["Matte Black","Machined"] },
      { model: "701 Bead Grip", configs: ["single"], sizes: ["17x8.5","18x9","20x9"], finishes: ["Matte Black","Bronze","Machined"] },
      { model: "703 Bead Grip", configs: ["single"], sizes: ["17x8.5","18x9","20x10"], finishes: ["Matte Black","Machined","Bronze"] },
      { model: "MR309 Grid", configs: ["single"], sizes: ["17x8.5","18x9","20x10"], finishes: ["Matte Black","Titanium","Bronze"] },
      { model: "315", configs: ["single"], sizes: ["17x8.5","18x9","20x10"], finishes: ["Matte Black","Bronze"] }
    ]
  },
  {
    slug: "kmc", name: "KMC Wheels", kind: "Off-Road",
    site: "https://www.kmcwheels.com", tagline: "XD-series off-road & HD dually truck wheels.",
    models: [
      { model: "XD811 Rockstar 2", configs: ["single"], sizes: ["18x9","20x10","20x12"], finishes: ["Matte Black","PVD Chrome","Chrome"] },
      { model: "XD820 Grenade", configs: ["single"], sizes: ["20x9","20x10","20x12","22x12"], finishes: ["Black","Black Machined","Chrome"] },
      { model: "XD847 Outbreak", configs: ["single"], sizes: ["17x9","18x9","20x10"], finishes: ["Satin Black","Gray Machined"] },
      { model: "XD Grenade Dually", configs: ["dually"], sizes: ["20x8.25","22x8.25"], finishes: ["Satin Black","Chrome","Black Machined"] },
      { model: "XD775 Rockstar Dually", configs: ["dually"], sizes: ["20x8.25"], finishes: ["Matte Black","Satin Black"] }
    ]
  },
  {
    slug: "raceline", name: "Raceline Wheels", kind: "Off-Road",
    site: "https://racelinewheels.com", tagline: "Family owned since '96 — Bead Grip & forged beadlock.",
    models: [
      { model: "951 Ryno", configs: ["single","dually"], sizes: ["16x8","17x9","18x9"], finishes: ["Satin Black","Textured Bronze","Machined"] },
      { model: "RT951F Forged Beadlock", configs: ["single"], sizes: ["17x8.5","17x9"], finishes: ["Satin Black","Machined"] },
      { model: "Defender", configs: ["single","dually"], sizes: ["17x9","18x9","20x9"], finishes: ["Machined","Gunmetal","Grey"] },
      { model: "Assault", configs: ["single"], sizes: ["17x9","18x9","20x10"], finishes: ["Black","Machined","Bronze"] },
      { model: "Twist", configs: ["single"], sizes: ["17x9","18x9","20x9"], finishes: ["Black","Machined","Bronze"] }
    ]
  },
  {
    slug: "black-rhino", name: "Black Rhino", kind: "Off-Road",
    site: "https://www.blackrhinowheels.com", tagline: "Built for the modern adventurer — HD truck & dually.",
    models: [
      { model: "Aliso Dually", configs: ["dually"], sizes: ["16x6"], finishes: ["Matte Black"] },
      { model: "Arsenal", configs: ["single"], sizes: ["17x9","18x9","20x9.5"], finishes: ["Sand on Black","Textured Matte Black"] },
      { model: "Abrams", configs: ["single"], sizes: ["17x8.5","18x9.5","20x9.5"], finishes: ["Gunblack Machined","Olive Drab","Matte Gunmetal"] },
      { model: "Warlord", configs: ["single"], sizes: ["17x9","18x9.5","20x9.5"], finishes: ["Matte Black","Matte Gunmetal"] },
      { model: "Overland", configs: ["single"], sizes: ["17x8","18x8","20x9"], finishes: ["Matte Black"] }
    ]
  }
];
