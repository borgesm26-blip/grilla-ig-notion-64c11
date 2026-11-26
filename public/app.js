(() => {
  const params = new URLSearchParams(location.search);
  const cfg = {
    cal: params.get("cal") || "",
    perfil: params.get("perfil") || "",
    cliente: params.get("cliente") || "",
    filas: params.get("filas") === "4" ? 4 : 3,
    tema: params.get("tema") || "auto",
  };
  const demo = !cfg.cal;
  const claveLocal = "grilla-ig:" + (cfg.cliente || cfg.cal || "demo");
  const $ = (id) => document.getElementById(id);

  // ---------- Preferencias del visor (opcionales) ----------
  const guardado = leerLocal();
  let filas = guardado.filas || cfg.filas;
  let tema = guardado.tema || cfg.tema;
  let ultimo = null;

  function leerLocal() {
    try { return JSON.parse(localStorage.getItem(claveLocal)) || {}; } catch { return {}; }
  }
  function guardarLocal() {
    try { localStorage.setItem(claveLocal, JSON.stringify({ filas, tema })); } catch {}
  }

  // ---------- Tema ----------
  const oscuroSistema = matchMedia("(prefers-color-scheme: dark)");
  function aplicarTema() {
    const oscuro = tema === "oscuro" || (tema === "auto" && oscuroSistema.matches);
    document.documentElement.dataset.theme = oscuro ? "oscuro" : "claro";
  }
  oscuroSistema.addEventListener?.("change", aplicarTema);
  $("btn-tema").addEventListener("click", () => {
    tema = document.documentElement.dataset.theme === "oscuro" ? "claro" : "oscuro";
    aplicarTema(); guardarLocal();
  });

  // ---------- 9 o 12 posts ----------
  const botonesFilas = document.querySelectorAll("[data-filas]");
  function marcarFilas() {
    botonesFilas.forEach((b) => b.classList.toggle("activo", Number(b.dataset.filas) === filas));
  }
  botonesFilas.forEach((b) =>
    b.addEventListener("click", () => {
      filas = Number(b.dataset.filas);
      marcarFilas(); guardarLocal();
      if (ultimo) pintarGrilla(ultimo.posts);
    })
  );

  // ---------- Refresh ----------
  $("btn-refresh").addEventListener("click", cargar);

  async function cargar() {
    const btn = $("btn-refresh");
    btn.classList.add("girando"); btn.disabled = true;
    estado("Leyendo Notion…");
    try {
      const data = demo ? datosDemo() : await pedir();
      ultimo = data;
      pintarPerfil(data.perfil, data.posts.length);
      pintarGrilla(data.posts);
      estado("Actualizado " + new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }));
      if (demo) {
        aviso('Esto es una DEMO. <a href="setup.html" target="_blank">Conectá tu calendario acá</a>.');
      } else if (!data.perfil && cfg.perfil) {
        aviso(`No encontré "${esc(cfg.cliente)}" en tu base Perfil. Revisá que el nombre del cliente sea igual en las dos bases.`);
      } else {
        aviso("");
      }
    } catch (e) {
      estado("");
      aviso(esc(e.message), true);
    } finally {
      btn.classList.remove("girando"); btn.disabled = false;
    }
  }

  async function pedir() {
    const q = new URLSearchParams({ cal: cfg.cal });
    if (cfg.perfil) q.set("perfil", cfg.perfil);
    if (cfg.cliente) q.set("cliente", cfg.cliente);
    let res;
    try {
      res = await fetch("/api/notion?" + q, { cache: "no-store" });
    } catch {
      throw new Error("Sin conexión. Revisá internet y tocá Refresh.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.mensaje || "Algo falló al leer Notion. Tocá Refresh.");
    return data;
  }

  // ---------- Pintar perfil ----------
  function pintarPerfil(p, totalPosts) {
    p = p || {};
    $("usuario").textContent = p.usuario || "tu_usuario";
    $("foto").src = p.foto || avatarVacio();
    $("n-posts").textContent = formato(p.publicaciones || totalPosts);
    $("n-seguidores").textContent = formato(p.seguidores || 0);
    $("n-seguidos").textContent = formato(p.seguidos || 0);
    $("nombre").textContent = p.nombre || "";
    $("categoria").textContent = p.categoria || "";
    $("bio").textContent = p.bio || "";
    const link = $("link");
    link.textContent = (p.link || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    link.href = p.link ? (/^https?:/.test(p.link) ? p.link : "https://" + p.link) : "#";

    const cont = $("destacadas");
    cont.innerHTML = "";
    (p.destacadas || []).forEach((d) => {
      const el = document.createElement("div");
      el.className = "destacada";
      el.innerHTML = `<div class="circulo"><img alt=""></div><span></span>`;
      el.querySelector("img").src = d.url;
      el.querySelector("span").textContent = d.nombre;
      cont.appendChild(el);
    });
  }

  // ---------- Pintar grilla ----------
  function ordenar(posts) {
    const conPortada = posts.filter((p) => p.portada);
    const porFecha = (a, b) => (b.fecha || "").localeCompare(a.fecha || "");
    const fijados = conPortada.filter((p) => p.fijado).sort(porFecha).slice(0, 3);
    const resto = conPortada.filter((p) => !fijados.includes(p)).sort(porFecha);
    return [...fijados, ...resto];
  }

  function pintarGrilla(posts) {
    const grilla = $("grilla");
    grilla.innerHTML = "";
    const lista = ordenar(posts).slice(0, filas * 3);

    lista.forEach((p) => {
      const a = document.createElement(p.url ? "a" : "div");
      a.className = "post";
      if (p.url) { a.href = p.url; a.target = "_blank"; a.rel = "noopener"; a.title = p.titulo || ""; }
      const img = document.createElement("img");
      img.loading = "lazy"; img.alt = p.titulo || "";
      img.src = p.portada;
      img.onerror = () => { img.remove(); a.classList.add("vacio"); a.textContent = "Imagen vencida. Tocá Refresh."; };
      a.appendChild(img);

      const marca = p.fijado && lista.indexOf(p) < 3 ? ICONOS.fijado : ICONOS[p.tipo];
      if (marca) {
        const m = document.createElement("span");
        m.className = "marca" + (marca === ICONOS.fijado || marca === ICONOS.reel ? " relleno" : "");
        m.innerHTML = marca;
        a.appendChild(m);
      }
      if (p.fecha) {
        const f = document.createElement("span");
        f.className = "fecha";
        f.textContent = new Date(p.fecha + (p.fecha.length === 10 ? "T12:00" : "")).toLocaleDateString("es", { day: "numeric", month: "short" });
        a.appendChild(f);
      }
      grilla.appendChild(a);
    });

    for (let i = lista.length; i < filas * 3; i++) {
      const v = document.createElement("div");
      v.className = "post vacio";
      v.innerHTML = i === lista.length
        ? `<span>Subí una portada en Notion y tocá Refresh</span>`
        : "";
      grilla.appendChild(v);
    }
  }

  const ICONOS = {
    fijado: `<svg viewBox="0 0 24 24"><path d="M15.5 2.5 21.5 8.5l-2.2.7-3.7 3.7.4 4.6-1.6 1.6-4-4-5.2 5.2-1-1 5.2-5.2-4-4L7 8.5l4.6.4 3.7-3.7z"/></svg>`,
    carrusel: `<svg viewBox="0 0 24 24"><rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></svg>`,
    reel: `<svg viewBox="0 0 24 24"><path d="M6 4.5v15l13-7.5z"/></svg>`,
    post: "",
  };

  // ---------- Utilidades ----------
  function estado(t) { $("estado").textContent = t; }
  function aviso(html, error) {
    const el = $("aviso");
    el.hidden = !html;
    el.innerHTML = html;
    el.classList.toggle("error", !!error);
  }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function formato(n) {
    const s = String(n).trim();
    const num = Number(s.replace(/[.,\s]/g, ""));
    if (!/^\d[\d.,\s]*$/.test(s) || !isFinite(num)) return s;
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "").replace(".", ",") + " M";
    if (num >= 1e4) return (num / 1e3).toFixed(1).replace(/\.0$/, "").replace(".", ",") + " mil";
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function avatarVacio() {
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#c7c7c7"/><circle cx="50" cy="40" r="18" fill="#fff"/><path d="M18 92c4-20 18-28 32-28s28 8 32 28" fill="#fff"/></svg>`);
  }

  // ---------- Demo ----------
  function tile(a, b, txt, i) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <rect width="300" height="400" fill="url(#g)"/>
      <circle cx="${60 + (i * 47) % 180}" cy="${90 + (i * 61) % 220}" r="${40 + (i * 13) % 50}" fill="#fff" opacity=".14"/>
      <text x="150" y="205" text-anchor="middle" font-family="Georgia,serif" font-size="30" font-weight="700" fill="#fff">${txt}</text></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  function datosDemo() {
    const paleta = [
      ["#f6a5c0", "#c84b7a", "Tip #1"], ["#2b2d42", "#8d99ae", "Detrás<tspan x='150' dy='34'>de escena</tspan>"],
      ["#ffd6a5", "#e76f51", "Nuevo"], ["#a8dadc", "#457b9d", "3 errores"], ["#cdb4db", "#6d597a", "Antes y<tspan x='150' dy='34'>después</tspan>"],
      ["#f4a261", "#9c4a1a", "Reel"], ["#b7e4c7", "#2d6a4f", "Lanzamiento"], ["#ffafcc", "#a2d2ff", "Clienta<tspan x='150' dy='34'>feliz</tspan>"],
      ["#264653", "#2a9d8f", "Guía"], ["#e9c46a", "#bc6c25", "Promo"], ["#f8edeb", "#d8a48f", "Rutina"], ["#3d405b", "#e07a5f", "FAQ"],
      ["#90e0ef", "#0077b6", "Sorteo"],
    ];
    const tipos = ["post", "carrusel", "post", "reel", "carrusel", "reel", "post", "post", "carrusel", "post", "reel", "post", "post"];
    const hoy = new Date();
    const posts = paleta.map(([a, b, t], i) => ({
      id: "demo" + i, url: null, titulo: t.replace(/<[^>]+>/g, " "),
      fecha: new Date(hoy - i * 2 * 864e5).toISOString().slice(0, 10),
      portada: tile(a, b, t, i), tipo: tipos[i], fijado: i === 4 || i === 8,
    }));
    const dest = [["Tips", "#f6a5c0", "#c84b7a"], ["Clientas", "#a8dadc", "#457b9d"], ["Promos", "#e9c46a", "#bc6c25"], ["Proceso", "#cdb4db", "#6d597a"], ["FAQ", "#b7e4c7", "#2d6a4f"]];
    return {
      perfil: {
        usuario: "estudio.luz", nombre: "Estudio Luz", categoria: "Estética",
        bio: "Piel sana, sin vueltas.\nTurnos por DM o en el link.\nBuenos Aires",
        link: "estudioluz.com", publicaciones: "128", seguidores: "12400", seguidos: "310",
        foto: tile("#f6a5c0", "#6d597a", "EL", 3),
        destacadas: dest.map(([n, a, b], i) => ({ nombre: n, url: tile(a, b, "", i) })),
      },
      posts,
      clientes: [],
    };
  }

  // ---------- Inicio ----------
  $("foto").src = avatarVacio();
  aplicarTema();
  marcarFilas();
  cargar();
})();
