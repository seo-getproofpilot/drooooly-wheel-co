/* ============================================================
   DROOOLY Wheel & Tire — cart (localStorage) + slide-out drawer
   ============================================================ */
(function () {
  /* THE KEY CHANGED BECAUSE THE OLD PRICES WERE INVENTED.

     Until v413 the grid priced every card with a formula, and whatever it
     produced was written into the browser's stored cart. Those numbers
     outlive the fix: a drawer restored from the old key would go on quoting
     a JTX 404 at $1,445 against no published price, on the one surface where
     a customer is closest to asking us to honour it.

     A stored cart cannot be re-priced here, because this file does not know
     the catalogue — so the old one is abandoned rather than migrated. Nobody
     loses an order: there is no checkout behind it. */
  var KEY = "drooolyBuild1";
  try { localStorage.removeItem("drooolyCart"); } catch (e) {}
  var cart = load();

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function count() { return cart.reduce(function (n, i) { return n + i.qty; }, 0); }
  /* A LINE MAY HAVE NO PRICE, AND THAT IS NOT ZERO.

     Most of the catalogue carries no publishable price — CLAUDE.md rule 4,
     and catalog.js's realPrice() is where that is decided. The drawer used to
     multiply whatever arrived by the quantity, so a wheel added with no price
     landed as $0 and a formula-priced one landed as a number nobody set: a
     JTX 404 showed a $1,445 subtotal against no stored price at all.

     So the total is only over the lines we can actually price, and when any
     line cannot be priced the drawer says the total is partial rather than
     printing a figure that looks final. */
  function priced(i) { return typeof i.price === "number" && isFinite(i.price) && i.price > 0; }
  function subtotal() {
    return cart.reduce(function (n, i) { return priced(i) ? n + i.price * i.qty : n; }, 0);
  }
  function unpricedCount() {
    return cart.reduce(function (n, i) { return priced(i) ? n : n + i.qty; }, 0);
  }
  function money(n) { return "$" + n.toLocaleString("en-US"); }

  // public API
  window.Cart = {
    add: function (item) {
      var ex = cart.filter(function (i) { return i.key === item.key; })[0];
      if (ex) ex.qty += (item.qty || 1); else cart.push({ key: item.key, brand: item.brand, name: item.name, price: item.price, img: item.img, qty: item.qty || 1 });
      save(); render(); open();
    },
    setQty: function (key, q) { cart.forEach(function (i) { if (i.key === key) i.qty = Math.max(1, q); }); save(); render(); },
    remove: function (key) { cart = cart.filter(function (i) { return i.key !== key; }); save(); render(); },
    open: open, close: close, count: count
  };

  // ---- drawer DOM (injected once) ----
  var overlay, drawer;
  function ensureDrawer() {
    if (drawer) return;
    overlay = document.createElement("div"); overlay.className = "cart-overlay"; overlay.addEventListener("click", close);
    drawer = document.createElement("aside"); drawer.className = "cart-drawer"; drawer.setAttribute("aria-label", "Cart");
    drawer.innerHTML =
      '<div class="cart-drawer__head"><h3>Your build <span class="cart-head-n"></span></h3>' +
      '<button class="cart-drawer__close" aria-label="Close">✕</button></div>' +
      '<div class="cart-items"></div>' +
      '<div class="cart-foot">' +
        '<div class="cart-sub"><span class="cart-sub-k">Subtotal</span><b class="cart-sub-v">$0</b></div>' +
        '<p class="cart-foot__note">Per-wheel pricing. A DROOOLY specialist confirms your dually/super-single set count, tires &amp; final out-the-door total on your fitment consult.</p>' +
        '<a href="index.html#fitment" class="btn btn--primary">Checkout &amp; get fitted</a>' +
      '</div>';
    document.body.appendChild(overlay); document.body.appendChild(drawer);
    drawer.querySelector(".cart-drawer__close").addEventListener("click", close);
    drawer.querySelector(".cart-items").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var key = b.getAttribute("data-key"), act = b.getAttribute("data-act");
      var it = cart.filter(function (i) { return i.key === key; })[0];
      if (act === "inc") window.Cart.setQty(key, (it ? it.qty : 1) + 1);
      else if (act === "dec") window.Cart.setQty(key, (it ? it.qty : 1) - 1);
      else if (act === "rm") window.Cart.remove(key);
    });
  }
  function open() { ensureDrawer(); render(); overlay.classList.add("open"); drawer.classList.add("open"); document.body.style.overflow = "hidden"; }
  function close() { if (!drawer) return; overlay.classList.remove("open"); drawer.classList.remove("open"); document.body.style.overflow = ""; }

  function render() {
    // header badges
    var n = count();
    document.querySelectorAll(".cart-count").forEach(function (el) {
      el.textContent = n; el.classList.toggle("show", n > 0);
    });
    if (!drawer) return;
    drawer.querySelector(".cart-head-n").textContent = n ? "(" + n + ")" : "";

    /* Label the figure for what it is. With an unpriced line in the build,
       "Subtotal $1,552" reads as the price of everything in the drawer. */
    var sub = subtotal(), un = unpricedCount();
    var k = drawer.querySelector(".cart-sub-k");
    var v = drawer.querySelector(".cart-sub-v");
    if (un && sub) {
      k.textContent = "Priced so far";
      v.textContent = money(sub);
    } else if (un) {
      k.textContent = "Subtotal";
      v.textContent = "On request";
    } else {
      k.textContent = "Subtotal";
      v.textContent = money(sub);
    }
    var note = drawer.querySelector(".cart-foot__note");
    note.innerHTML = un
      ? (un === n ? "These are priced with the brand on your fitment consult \u2014 we do not publish a number we have not been given."
                  : un + " of these " + (un === 1 ? "is" : "are") + " priced with the brand on your fitment consult, so the figure above covers the rest. A DROOOLY specialist confirms your set count, tires &amp; final out-the-door total.")
      : "Per-wheel pricing. A DROOOLY specialist confirms your dually/super-single set count, tires &amp; final out-the-door total on your fitment consult.";
    var box = drawer.querySelector(".cart-items");
    if (!cart.length) {
      box.innerHTML = '<div class="cart-empty"><svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>Your build is empty.<br>Add a set to get started.</div>';
      return;
    }
    box.innerHTML = cart.map(function (i) {
      return '<div class="citem"><div class="citem__img"><img src="' + i.img + '" alt=""></div>' +
        '<div class="citem__b"><div class="citem__brand">' + i.brand + '</div><div class="citem__name">' + i.name + '</div>' +
        '<div class="citem__qty"><button data-act="dec" data-key="' + i.key + '">−</button><span>' + i.qty + '</span><button data-act="inc" data-key="' + i.key + '">+</button></div></div>' +
        '<div class="citem__r"><div class="citem__price' + (priced(i) ? '' : ' citem__price--ask') + '">' +
          (priced(i) ? money(i.price * i.qty) : 'Priced on request') + '</div>' +
        '<button class="citem__rm" data-act="rm" data-key="' + i.key + '">Remove</button></div></div>';
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".cart-btn").forEach(function (b) { b.addEventListener("click", open); });
    render();
  });
})();
