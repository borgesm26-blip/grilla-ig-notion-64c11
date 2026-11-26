// Función de Netlify: lee el calendario y el perfil desde Notion.
// El navegador no puede hablar directo con Notion, por eso existe este "puente".

const API = "https://api.notion.com/v1";
const VERSION_NUEVA = "2025-09-03";
const VERSION_VIEJA = "2022-06-28";

export const config = { path: "/api/notion" };

export default async (req) => {
  const url = new URL(req.url);
  const token = process.env.NOTION_TOKEN;

  if (!token) {
    return responder(
      {
        error: "falta_token",
        mensaje:
          "Falta el token de Notion. En Netlify: Site configuration > Environment variables > NOTION_TOKEN.",
      },
      500
    );
  }

  const calId = limpiarId(url.searchParams.get("cal"));
  const perfilId = limpiarId(url.searchParams.get("perfil"));
  const cliente = (url.searchParams.get("cliente") || "").trim();

  if (!calId) {
    return responder(
      { error: "falta_calendario", mensaje: "Falta el link del calendario." },
      400
    );
  }

  try {
    const [filasCal, filasPerfil] = await Promise.all([
      leerBase(calId, token, "calendario"),
      perfilId ? leerBase(perfilId, token, "perfil") : Promise.resolve([]),
    ]);

    const todos = filasCal.map(leerPost);
    const clientes = [
      ...new Set(todos.flatMap((p) => p.clientes).filter(Boolean)),
    ].sort();

    const posts = todos.filter(
      (p) => !cliente || p.clientes.length === 0 || coincide(p.clientes, cliente)
    );

    const perfiles = filasPerfil.map(leerPerfil);
    const perfil =
      (cliente && perfiles.find((p) => coincide([p.cliente], cliente))) ||
      (cliente ? null : perfiles[0]) ||
      null;

    for (const p of perfiles) if (p.cliente && !clientes.includes(p.cliente)) clientes.push(p.cliente);

    return responder({ posts, perfil, clientes: clientes.sort() });
  } catch (e) {
    return responder(
      { error: e.codigo || "notion", mensaje: e.message },
      e.status || 502
    );
  }
};

// ---------- Notion ----------

async function notion(ruta, token, version, body) {
  const res = await fetch(API + ruta, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": version,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function leerBase(id, token, cual) {
  // 1. Versión actual de la API: base > data source > query
  const base = await notion(`/databases/${id}`, token, VERSION_NUEVA);

  if (!base.ok) throw errorNotion(base, cual);

  const fuentes = base.data.data_sources || [];
  if (fuentes.length) {
    return paginar(`/data_sources/${fuentes[0].id}/query`, token, VERSION_NUEVA, cual);
  }
  // 2. Respaldo: versión anterior de la API
  return paginar(`/databases/${id}/query`, token, VERSION_VIEJA, cual);
}

async function paginar(ruta, token, version, cual) {
  const filas = [];
  let cursor;
  for (let i = 0; i < 10; i++) {
    const r = await notion(ruta, token, version, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    if (!r.ok) throw errorNotion(r, cual);
    filas.push(...r.data.results);
    if (!r.data.has_more) break;
    cursor = r.data.next_cursor;
  }
  return filas;
}

function errorNotion(r, cual) {
  const err = new Error();
  err.status = r.status === 401 || r.status === 404 ? r.status : 502;
  if (r.status === 401) {
    err.codigo = "token_invalido";
    err.message = "El token de Notion no es válido. Revisalo en Netlify.";
  } else if (r.status === 404 || r.data?.code === "object_not_found") {
    err.codigo = "sin_acceso";
    err.message = `No encuentro la base de ${cual}. ¿La compartiste con la integración? (··· > Conexiones > tu integración)`;
  } else if (r.data?.code === "validation_error") {
    err.codigo = "link_invalido";
    err.message = `El link de ${cual} no es una base de datos. Copiá el link de la base, no de la página que la contiene.`;
  } else {
    err.message = r.data?.message || "Notion no respondió. Probá de nuevo en un rato.";
  }
  return err;
}

// ---------- Lectura de filas ----------

function leerPost(fila) {
  const p = fila.properties || {};
  const portada =
    archivos(buscar(p, ["portada", "cover", "imagen", "foto", "archivo"], "files"))[0] ||
    portadaDePagina(fila);

  return {
    id: fila.id,
    url: fila.url,
    titulo: texto(buscar(p, ["nombre", "titulo", "título", "name"], "title")),
    fecha: fecha(buscar(p, ["fecha", "publicación", "publicacion", "date", "día"], "date")),
    portada: portada ? portada.url : null,
    fijado: !!buscar(p, ["fijado", "fijar", "pin", "pinned"], "checkbox")?.checkbox,
    tipo: normalizarTipo(texto(buscar(p, ["tipo", "formato", "type"], "select"))),
    estado: texto(buscar(p, ["estado", "status"], "status")),
    clientes: valores(buscar(p, ["cliente", "cuenta", "marca", "client"], "select")),
  };
}

function leerPerfil(fila) {
  const p = fila.properties || {};
  const destacadas = archivos(
    buscar(p, ["destacadas", "highlights", "historias destacadas"], "files")
  ).map((a) => ({ url: a.url, nombre: a.nombre.replace(/\.[a-z0-9]{2,5}$/i, "") }));

  return {
    cliente: valores(buscar(p, ["cliente", "cuenta", "marca", "client"], "select"))[0] ||
      texto(buscar(p, ["cliente"], "title")),
    usuario: texto(buscar(p, ["usuario", "user", "@", "username", "handle"], "rich_text")).replace(/^@/, ""),
    nombre: texto(buscar(p, ["nombre", "name", "nombre visible"], "rich_text")),
    foto: (archivos(buscar(p, ["foto", "foto de perfil", "avatar", "imagen"], "files"))[0] || {}).url || null,
    categoria: texto(buscar(p, ["categoría", "categoria", "rubro"], "rich_text")),
    bio: texto(buscar(p, ["bio", "biografía", "biografia", "descripción"], "rich_text")),
    link: texto(buscar(p, ["link", "web", "enlace", "url", "sitio"], "url")),
    publicaciones: texto(buscar(p, ["publicaciones", "posts"], "number")),
    seguidores: texto(buscar(p, ["seguidores", "followers"], "number")),
    seguidos: texto(buscar(p, ["seguidos", "following"], "number")),
    destacadas,
  };
}

// Busca una propiedad por nombre (sin importar mayúsculas ni tildes).
// Si no la encuentra por nombre, usa la primera del tipo esperado.
function buscar(props, nombres, tipo) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const objetivos = nombres.map(norm);
  const entradas = Object.entries(props);

  const porNombre = entradas.find(([n]) => objetivos.includes(norm(n)));
  if (porNombre) return porNombre[1];

  const parcial = entradas.find(([n]) => objetivos.some((o) => o.length > 2 && norm(n).includes(o)));
  if (parcial) return parcial[1];

  const usarTipo =
    ["title", "date", "checkbox"].includes(tipo) ||
    (tipo === "files" && nombres.includes("portada"));
  if (usarTipo) {
    const porTipo = entradas.find(([, v]) => v.type === tipo);
    if (porTipo) return porTipo[1];
  }
  return null;
}

function texto(prop) {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
    case "rich_text":
      return (prop[prop.type] || []).map((t) => t.plain_text).join("");
    case "select":
    case "status":
      return prop[prop.type]?.name || "";
    case "multi_select":
      return (prop.multi_select || []).map((s) => s.name).join(", ");
    case "number":
      return prop.number == null ? "" : String(prop.number);
    case "url":
    case "email":
    case "phone_number":
      return prop[prop.type] || "";
    case "formula":
      return String(prop.formula?.[prop.formula?.type] ?? "");
    default:
      return "";
  }
}

function valores(prop) {
  if (!prop) return [];
  if (prop.type === "multi_select") return prop.multi_select.map((s) => s.name);
  const t = texto(prop);
  return t ? [t] : [];
}

function fecha(prop) {
  return prop?.type === "date" ? prop.date?.start || null : null;
}

function archivos(prop) {
  if (!prop || prop.type !== "files") return [];
  return (prop.files || [])
    .map((f) => ({
      url: f.type === "external" ? f.external?.url : f.file?.url,
      nombre: f.name || "",
    }))
    .filter((f) => f.url);
}

function portadaDePagina(fila) {
  const c = fila.cover;
  if (!c) return null;
  return { url: c.type === "external" ? c.external?.url : c.file?.url };
}

function normalizarTipo(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("reel") || s.includes("video")) return "reel";
  if (s.includes("carru") || s.includes("carou")) return "carrusel";
  return "post";
}

function coincide(lista, cliente) {
  const c = cliente.toLowerCase();
  return lista.some((x) => (x || "").toLowerCase() === c);
}

function limpiarId(valor) {
  if (!valor) return null;
  const sinQuery = valor.split("?")[0].split("#")[0];
  const plano = sinQuery.replace(/-/g, "");
  const m = plano.match(/[0-9a-f]{32}(?!.*[0-9a-f]{32})/i);
  return m ? m[0] : null;
}

function responder(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
