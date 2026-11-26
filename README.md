# Grilla IG en Notion

Tu feed de Instagram dentro de Notion, armado directo desde tu calendario de contenido.
Sin rehacer la grilla en Canva cada vez que cambiás algo.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/TU_USUARIO/grilla-ig-notion)

## Qué hace

1. Muestra tu grilla al lado de tu plan de contenido.
2. Se actualiza desde tu calendario: subís la portada, tocás Refresh y aparece.
3. Imita el perfil: foto, nombre, bio, link y destacadas.
4. Hasta 3 posts fijados (casilla "Fijado" en Notion).
5. 9 o 12 posts.
6. Una grilla por cliente.
7. Modo claro y oscuro.
8. Gratis: Notion gratis + Netlify gratis + GitHub gratis.

## Instalación

Guía paso a paso con capturas: `guia/guia.pdf`.

## Columnas que lee del calendario

| Columna | Tipo | Para qué |
|---|---|---|
| Nombre | Título | Nombre del post |
| Fecha | Fecha | Orden de la grilla (más nuevo arriba) |
| Portada | Archivos | La imagen que se ve en la grilla |
| Cliente | Selección | Para separar grillas por cliente |
| Fijado | Casilla | Fija el post arriba (máx. 3) |
| Tipo | Selección | Post, Carrusel o Reel (muestra el iconito) |

Los nombres pueden cambiar un poco: el widget también reconoce "Imagen", "Cover", "Cuenta", "Formato", etc.

## Base Perfil (una fila por cliente)

Cliente (título), Usuario, Nombre, Categoría, Bio, Link, Foto, Publicaciones, Seguidores, Seguidos, Destacadas.
En Destacadas subís las imágenes: el nombre del archivo es el título (ej: `Tips.png`).

## Para quien lo modifica

1. `public/` el widget (`index.html`) y el asistente (`setup.html`).
2. `netlify/functions/notion.mjs` lee Notion con el token guardado en `NOTION_TOKEN`.
3. Sin dependencias ni paso de build.
