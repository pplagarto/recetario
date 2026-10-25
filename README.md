# Recetario de pepe

Web: https://recetario-de-pepe.pepe-lag-gar-3da.workers.dev/

Recetario personal en HTML, CSS y JavaScript. La aplicación no tiene dependencias de ejecución; Node.js sirve la vista local y Wrangler se utiliza para publicar en Cloudflare.

## Abrir

Desde esta carpeta ejecuta `npm start` y abre http://localhost:4173. Para detener el servidor, usa Ctrl+C en la terminal que lo ejecuta. Requiere Node.js 22 o posterior. No requiere `npm install`.

## Uso

1. Filtra por desayuno, comida o cena; también puedes buscar por nombre o ingrediente.
2. Abre una receta desde su ilustración, nombre o enlace para consultar ingredientes, pasos y notas.
3. Ajusta las cantidades con los botones − / + o escribiendo un número entero entre 1 y 100.
4. Marca las recetas que quieras y pulsa **Crear lista de compras**.
5. Revisa la lista agrupada por área del supermercado. Puedes seguir ajustando cantidades, marcar ingredientes, copiar, descargar texto o imprimir.

Las categorías iniciales son una propuesta editorial: brownies en desayuno; burritos y caldo en comida y cena. Las ilustraciones son SVG locales. Las recetas se muestran en una sola columna de ancho completo, con filas compactas y controles táctiles para celular.

## Cálculos y datos

- Brownies: la unidad es una preparación completa, porque la fuente no indica porciones individuales.
- Burritos: la unidad es un burrito; caldo: una porción abundante.
- Ingredientes y rangos se escalan proporcionalmente. Los tiempos no se multiplican.
- Ingredientes compartidos se suman por identificador y unidad compatible. No se convierten piezas de cebolla a gramos ni se fusionan productos distintos sin equivalencia.
- Los ingredientes al gusto siguen sin cantidad fija. Cuando se suman a una cantidad conocida, se muestra esa cantidad más «al gusto».
- Los extras se activan individualmente dentro de la receta. No cambian automáticamente su rendimiento.
- La compra de latas o cuñas se redondea hacia arriba como sugerencia, conservando la cantidad requerida.
- Al cambiar una cantidad se desmarca el ingrediente afectado para que se revise otra vez.
- Los pasos están adaptados para referirse a las cantidades escaladas; la fuente íntegra está en `data/recetario-original.md`.

Las recetas viven en `data/recipes.js`: añadir un objeto con un identificador único, categorías, rendimiento base e ingredientes permite ampliar el recetario. Esta primera versión no incluye un formulario para crear o editar recetas desde la web.

## Guardado

La selección, cantidades, extras y marcas de compra se guardan inmediatamente con cada cambio en localStorage del navegador para este origen, sin esperar a cerrar la página ni confirmar la lista. Al volver a la misma dirección, incluso tras cerrar la pestaña, se recuperan. La interfaz indica si el guardado fue exitoso o si falló. Las recetas están en archivos del proyecto. No hay sincronización entre navegadores ni dispositivos; borrar los datos del navegador borra el plan, no las recetas. El modo privado no ofrece persistencia después de cerrar la sesión privada. El servidor escucha únicamente en 127.0.0.1: la URL localhost del Mac aún no es accesible desde el celular. La vista móvil se puede revisar localmente en `/tests/mobile-preview.html`. Desde el teléfono, abre el enlace público de Cloudflare indicado arriba.

## Verificación

`npm test` comprueba escalado, rangos, agrupación, opcionales, ingredientes al gusto, límites y las marcas de compra al cambiar cantidades.

## Próximas mejoras sugeridas

- Formulario para agregar y editar recetas, con respaldo exportable del recetario.
- Despensa con existencias para descontar lo que ya tienes.
- Menú semanal para asignar recetas a días y comidas.
- Fotos propias y etiquetas adicionales, como congelable o preparación rápida.

## Comparar estilos antes del despliegue

El selector **Probar estilos** del recetario permite alternar entre Original (crema y verde editorial), Mercado (papel cálido, rojo y amarillo, títulos serif marcados) y Minimal (superficies blancas, tipografía sans serif y azul). Se aplican también a las fichas y la lista de compras. La preferencia se guarda aparte del plan, en `mi-cocina:theme`, y no cambia las recetas, cantidades ni productos marcados. Las reglas están en `themes.css`. El selector se oculta al imprimir. En producción está fijado Mercado y el selector permanece oculto.

## Publicación en Cloudflare

`npm run build` genera `dist/` usando una lista explícita de archivos. La publicación fija Mercado y oculta el selector de estilos; las vistas de comparación permanecen solo en el proyecto local. No se incluyen servidor local, pruebas, capturas, archivos de configuración ni credenciales en el sitio.

El código se mantiene en https://github.com/pplagarto/recetario. En Cloudflare Workers, conecta este repositorio con los siguientes valores:

- Nombre del Worker: `recetario-de-pepe` (debe coincidir con `wrangler.jsonc`).
- Rama de producción: `main`.
- Directorio raíz: `/`.
- Comando de compilación: `npm test && npm run build`.
- Comando de despliegue: `npx wrangler@4 deploy`.

Cada cambio enviado a `main` activa una publicación. Si las pruebas fallan, se detiene antes del despliegue. Cloudflare gestiona la conexión con GitHub; no se guardan credenciales en el repositorio.

Como alternativa manual, desde una red con acceso al registro oficial de npm ejecuta `npx wrangler@4 login` y después `npm run deploy`. Wrangler se descarga al invocarlo; no es necesario para desarrollar ni ejecutar las pruebas locales.

La configuración solo sirve archivos estáticos; no ejecuta un Worker de backend ni usa una base de datos.

La URL de producción tendrá su propio almacenamiento del navegador: la selección de localhost no se transfiere automáticamente. El guardado persiste entre visitas al mismo origen; no sincroniza dispositivos. La web requiere conexión para cargar y no incluye todavía caché para uso sin conexión.

Para actualizar recetas, edita `data/recipes.js`, ejecuta `npm test` y envía los cambios a `main`. Conserva el nombre del Worker para mantener la dirección y el almacenamiento de los usuarios.

## Mi despensa

En **Mi despensa** puedes marcar los ingredientes disponibles o escribir una lista y revisar las coincidencias antes de añadirlas. El catálogo se construye a partir de los ingredientes de las recetas, incluidos sus extras; por ahora las recomendaciones se limitan a esas recetas. El reconocimiento de texto es local y admite nombres conocidos, comas, saltos de línea y «y». No consulta un servicio de IA ni inventa recetas. Los nombres ambiguos o desconocidos se muestran para revisión; las cantidades repetidas conservan la última mención.

Las cantidades son opcionales y usan la unidad que indica cada ingrediente. El texto admite conversiones de kg a g y de ml a l; no se convierten piezas a gramos ni se intercambian productos distintos. Una cantidad vacía significa «lo tengo, pero no sé cuánto»; cero significa agotado. Las recomendaciones priorizan recetas con cantidades cubiertas, luego recetas con todos los ingredientes registrados y finalmente las que aprovechan más ingredientes. Se actualizan con las porciones y extras seleccionados. Los ingredientes al gusto requieren revisión.

**Añadir al plan y ver compras** conserva las recetas ya seleccionadas y activa **Descontar lo que tengo en casa**. Primero se agregan las cantidades de todo el plan y después se descuenta la despensa una sola vez. Las cantidades desconocidas permanecen en la lista con una nota para revisar. El inventario no disminuye al planificar ni al marcar una compra: actualízalo conforme consumas o repongas ingredientes. La despensa se guarda con el plan en el navegador, sin sincronización entre dispositivos.
