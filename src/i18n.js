export const STORAGE_LANG = 'uauu_inv_lang';

// Diccionari castellà. Clau = text en català (tal com apareix al codi).
// Si una clau no existeix aquí, es mostra el text català original.
const ES = {
  // ── Comú ──
  'Tancar':                       'Cerrar',
  'Desar':                        'Guardar',
  'Cancel·lar':                   'Cancelar',
  'Eliminar':                     'Eliminar',
  'Editar':                       'Editar',
  'Reduir quantitat':             'Reducir cantidad',
  'Augmentar quantitat':          'Aumentar cantidad',
  'Tots':                         'Todos',
  'Sí':                           'Sí',
  'No':                           'No',
  '—':                            '—',

  // ── Pantalla selecció usuari ──
  'Qui ets?':                              '¿Quién eres?',
  'Selecciona el teu perfil per continuar':'Selecciona tu perfil para continuar',
  'Encarregat':                            'Encargado',
  'Coordinador':                           'Coordinador',
  'Admin':                                 'Admin',

  // ── Pantalla masia ──
  'Quina masia?':                    '¿Qué masía?',
  'Selecciona la masia per continuar':'Selecciona la masía para continuar',
  "Ca n'Alzina":                     "Ca n'Alzina",
  'Can Macià':                       'Can Macià',
  'Castell de Tous':                 'Castell de Tous',
  'Mas Vivencs':                     'Mas Vivencs',

  // ── Login ──
  'Inicia sessió':                              'Inicia sesión',
  'Entra les teves credencials per continuar':  'Introduce tus credenciales para continuar',
  'Contrasenya':                                'Contraseña',
  'Entrar':                                     'Entrar',
  "Ruta":                                       'Ruta',

  // ── Header / nav ──
  'Ajuda':                          'Ayuda',
  'Canviar contrasenya':            'Cambiar contraseña',
  'Tancar sessió':                  'Cerrar sesión',
  'Configurar sincronització':      'Configurar sincronización',
  'Configuració':                   'Configuración',
  'Importar Excel':                 'Importar Excel',
  'Cerca':                          'Buscar',
  'Articles':                       'Artículos',
  'Categories':                     'Categorías',
  'Resum':                          'Resumen',
  'Catàleg':                        'Catálogo',
  'Historial':                      'Historial',
  'Comandes':                       'Pedidos',
  'Casaments':                      'Bodas',
  'Estadístiques':                  'Estadísticas',
  'Usuaris':                        'Usuarios',
  'Nom o categoria… (Enter per text)':'Nombre o categoría… (Intro para texto)',

  // ── Vista articles ──
  'Inventari buit':                                       'Inventario vacío',
  "Afegeix el primer article per<br>començar a gestionar l'estoc.": 'Añade el primer artículo para<br>empezar a gestionar el stock.',
  'Nou article':                    'Nuevo artículo',
  'Nova comanda':                   'Nuevo pedido',
  'Nou producte':                   'Nuevo producto',
  'Nou usuari':                     'Nuevo usuario',

  // ── Comandes ──
  'Totes':                          'Todos',
  'Pendents':                       'Pendientes',
  'En curs':                        'En curso',
  'Rebudes':                        'Recibidas',
  "Cancel·lades":                   'Canceladas',
  'Pendent':                        'Pendiente',
  'Rebuda':                         'Recibida',
  "Cancel·lada":                    'Cancelada',
  'Sense comandes':                 'Sin pedidos',
  'Afegeix la primera comanda<br>amb el botó de sota.': 'Añade el primer pedido<br>con el botón de abajo.',

  // ── FAB / comú ──
  'Nou article ':                  'Nuevo artículo ',

  // ── Modal article ──
  'Nom *':                          'Nombre *',
  "Nom de l'article":               'Nombre del artículo',
  'Suggeriments de productes':      'Sugerencias de productos',
  'Quantitat':                      'Cantidad',
  'Unitat':                         'Unidad',
  'u, kg, l…':                      'u, kg, l…',
  'Estoc mínim':                    'Stock mínimo',
  'Categoria':                      'Categoría',
  'Notes':                          'Notas',
  'Informació addicional…':         'Información adicional…',
  'Desar article':                  'Guardar artículo',
  'Eliminar article':               'Eliminar artículo',

  // ── Modal categoria ──
  'Nova categoria':                 'Nueva categoría',
  'Nom de la categoria *':          'Nombre de la categoría *',
  'p.ex. Alimentació':              'p.ej. Alimentación',
  'Color':                          'Color',
  'Desar categoria':                'Guardar categoría',

  // ── Modal comanda ──
  'Referència':                     'Referencia',
  'Data':                           'Fecha',
  'Proveïdor':                      'Proveedor',
  'Nom del proveïdor':              'Nombre del proveedor',
  'Estat':                          'Estado',
  'Articles *':                     'Artículos *',
  'Cerca producte…':                'Buscar producto…',
  'Articles / Descripció *':        'Artículos / Descripción *',
  'Detall dels articles demanats…': 'Detalle de los artículos pedidos…',
  'Observacions…':                  'Observaciones…',
  'Desar comanda':                  'Guardar pedido',
  'Eliminar comanda':               'Eliminar pedido',

  // ── Modal usuari ──
  'Email *':                        'Email *',
  'Nom complet':                    'Nombre completo',
  'usuari@uauu.cat':                'usuario@uauu.cat',
  'Contrasenya <span id="user-pw-hint" class="form-hint-inline"></span>': 'Contraseña <span id="user-pw-hint" class="form-hint-inline"></span>',
  'Mínim 6 caràcters':              'Mínimo 6 caracteres',
  'Rol *':                          'Rol *',
  'Masia':                          'Masía',
  'Desar usuari':                   'Guardar usuario',
  'Eliminar usuari':                'Eliminar usuario',

  // ── Import ──
  'Importar articles':              'Importar artículos',
  'Clica o arrossega el fitxer aquí':'Haz clic o arrastra el archivo aquí',
  'Seleccionar fitxer':             'Seleccionar archivo',

  // ── Config GAS ──
  'Sincronització full':            'Sincronización de hoja',
  'URL Apps Script':                'URL Apps Script',
  'Desar URL':                      'Guardar URL',
  'Testa connexió':                 'Probar conexión',

  // ── Nou producte ──
  'Nom del producte *':             'Nombre del producto *',
  'p.ex. Farina de blat':           'p.ej. Harina de trigo',
  'p.ex. ampolla':                  'p.ej. botella',
  'Codi de barres':                 'Código de barras',
  'Escaneja o escriu el codi':      'Escanea o escribe el código',
  'Escanejar codi de barres':       'Escanear código de barras',
  'Afegir al catàleg':              'Añadir al catálogo',
  'Eliminar producte':              'Eliminar producto',

  // ── Modal quantitat ──
  'Caixes':                         'Cajas',
  'Desmarcar':                      'Desmarcar',

  // ── Escàner ──
  'Codi de barres':                 'Código de barras',
  'Apunta la càmera al codi':       'Apunta la cámara al código',
  'Crear producte':                 'Crear producto',

  // ── Canviar contrasenya ──
  'Contrasenya actual *':           'Contraseña actual *',
  'Contrasenya actual':             'Contraseña actual',
  'Nova contrasenya *':             'Nueva contraseña *',
  'Confirma la nova contrasenya *': 'Confirma la nueva contraseña *',
  'Repeteix la nova contrasenya':   'Repite la nueva contraseña',

  // ── Ajuda ──
  'Com funciona':                   'Cómo funciona',

  // ── Editar historial ──
  'Editar inventari':               'Editar inventario',
  'Comentari':                      'Comentario',
  'Comentari opcional…':            'Comentario opcional…',
  'Desar canvis':                   'Guardar cambios',

  // ── Idioma / config modal ──
  'Idioma':                         'Idioma',
  'Català':                         'Català',
  'Castellà':                       'Castellano',

  // ── Comanda edició (coordinador) ──
  "Tornar a l'historial":           'Volver al historial',
  'Comanda':                        'Pedido',
  'Genera comanda →':               'Generar pedido →',

  // ── Offline ──
  "Pendent d'enviar":               'Pendiente de enviar',

  // ── Comandes (dinàmic) ──
  'Cap producte afegit':            'Ningún producto añadido',
  'Clic per canviar estat':         'Clic para cambiar estado',
  'Imprimir comanda':               'Imprimir pedido',
  'Editar comanda':                 'Editar pedido',
  'Eliminar comanda':               'Eliminar pedido',
  'Treure':                         'Quitar',
  'Articles':                       'Artículos',
  'Comanda actualitzada':           'Pedido actualizado',
  'Comanda afegida':                'Pedido añadido',
  "Comanda eliminada. No s'ha pogut revertir la mitjana de: {list} (ja s'han tornat a comandar)":
    'Pedido eliminado. No se ha podido revertir la media de: {list} (ya se han vuelto a pedir)',
  'Comanda eliminada i mitjana revertida ({n} producte{s})': 'Pedido eliminado y media revertida ({n} producto{s})',
  'Comanda eliminada':              'Pedido eliminado',
  'Eliminar la comanda{ref}?':      '¿Eliminar el pedido{ref}?',
  'Estat: {status}':                'Estado: {status}',
  'Producte':                       'Producto',
  'Total caixes:':                  'Total cajas:',
  'Referència:':                    'Referencia:',
  'Data comanda:':                  'Fecha pedido:',
  'Data impressió:':                'Fecha impresión:',
  'Coordinador:':                   'Coordinador:',
  'Notes:':                         'Notas:',
  'Responsable':                    'Responsable',
  'Proveïdor':                      'Proveedor',
  'Data lliurament':                'Fecha entrega',

  // ── Categories / articles (dinàmic) ──
  'Nova':                           'Nueva',
  'article':                        'artículo',
  'articles':                       'artículos',
  'Categoria creada':               'Categoría creada',
  'Eliminar la categoria "{name}"?\nEls articles passaran a "General".':
    'Eliminar la categoría "{name}"?\nLos artículos pasarán a "General".',
  'Categoria eliminada':            'Categoría eliminada',
  'Editar article':                 'Editar artículo',
  'Article actualitzat':            'Artículo actualizado',
  'Article afegit':                 'Artículo añadido',
  'Eliminar "{name}"?':             '¿Eliminar "{name}"?',
  'Article eliminat':               'Artículo eliminado',

  // ── Usuaris (dinàmic) ──
  'Sessió no iniciada':             'Sesión no iniciada',
  'Carregant usuaris…':             'Cargando usuarios…',
  'Cap usuari registrat.':          'Ningún usuario registrado.',
  '(sense nom)':                    '(sin nombre)',
  'Editar usuari':                  'Editar usuario',
  '(deixa-ho buit per no canviar)': '(déjalo vacío para no cambiar)',
  'Omple nom, email i contrasenya': 'Rellena nombre, email y contraseña',
  'Desant…':                        'Guardando…',
  'Usuari actualitzat':             'Usuario actualizado',
  'Usuari creat':                   'Usuario creado',
  'Eliminar l\'usuari "{name}"?\nAquesta acció no es pot desfer.':
    '¿Eliminar el usuario "{name}"?\nEsta acción no se puede deshacer.',
  'Usuari eliminat':                'Usuario eliminado',

  // ── Auth (dinàmic) ──
  'Credencials incorrectes':        'Credenciales incorrectas',
  'Sessió caducada':                'Sesión caducada',
  'Sense inventari':                'Sin inventario',
  'Aquesta setmana':                'Esta semana',
  'Setmana passada':                'Semana pasada',
  'Fa {n} setmanes':                'Hace {n} semanas',
  'Accés':                          'Acceso',
  'Masia':                          'Masía',
  "Perfil sense rol — afegeix user_metadata a Supabase": 'Perfil sin rol — añade user_metadata en Supabase',
  'Aquest compte és {rol}, no {user}': 'Esta cuenta es {rol}, no {user}',
  'Entrant…':                       'Entrando…',
  'Omple tots els camps':           'Rellena todos los campos',
  'La nova contrasenya ha de tenir mínim 6 caràcters': 'La nueva contraseña debe tener mínimo 6 caracteres',
  'Les contrasenyes no coincideixen': 'Las contraseñas no coinciden',
  'Verificant…':                    'Verificando…',
  "No s'ha pogut obtenir el correu de la sessió actual": 'No se ha podido obtener el correo de la sesión actual',
  'Canviant…':                      'Cambiando…',
  'Error {status}':                 'Error {status}',
  'Contrasenya canviada correctament': 'Contraseña cambiada correctamente',
  'La contrasenya actual no és correcta': 'La contraseña actual no es correcta',

  // ── Helpers (dinàmic) ──
  'Filtra…':                        'Filtrar…',
  'Eliminar filtre':                'Eliminar filtro',
  '1 enviament pendent':            '1 envío pendiente',
  '{n} enviaments pendents':        '{n} envíos pendientes',
  "Sense connexió — s'enviarà quan hi hagi WiFi": 'Sin conexión — se enviará cuando haya WiFi',
  '1 enviament pendent enviat':     '1 envío pendiente enviado',
  '{n} enviaments pendents enviats': '{n} envíos pendientes enviados',

  // ── Import (dinàmic) ──
  "No s'ha pogut carregar la llibreria Excel.\nConnecta't a internet i torna a intentar-ho.":
    'No se ha podido cargar la librería Excel.\nConéctate a internet y vuelve a intentarlo.',
  'Columna "Nom" no trobada. Comprova les capçaleres.': 'Columna "Nombre" no encontrada. Comprueba las cabeceras.',
  'Cap fila vàlida trobada.':       'Ninguna fila válida encontrada.',
  'Nom':                            'Nombre',
  '{n} articles detectats{more}':   '{n} artículos detectados{more}',
  ' (mostrant 5)':                  ' (mostrando 5)',
  'Importar {n} article{s}':        'Importar {n} artículo{s}',
  'Importació completada: {created} nous, {updated} actualitzats': 'Importación completada: {created} nuevos, {updated} actualizados',

  // ── Casaments (dinàmic) ──
  "Sense data d'actualització":     'Sin fecha de actualización',
  'Actualitzat:':                   'Actualizado:',
  'Dades desactualitzades':         'Datos desactualizados',
  'Última actualització fa {days} dies — {date}': 'Última actualización hace {days} días — {date}',
  'Actualització fa {days} dies':   'Actualización hace {days} días',
  'Al dia':                         'Al día',
  '{n} adults':                     '{n} adultos',
  '{n} casament{s}':                '{n} boda{s}',
  'Sense resultats':                'Sin resultados',
  'Comentaris':                     'Comentarios',
  'Sense comentaris registrats':    'Sin comentarios registrados',
  'Tornar':                         'Volver',
  'Cercar nom, al·lèrgia…':         'Buscar nombre, alergia…',
  'Carregant casaments…':           'Cargando bodas…',
  'Error carregant casaments. Comprova la connexió.': 'Error al cargar bodas. Comprueba la conexión.',

  // ── Estadístiques (dinàmic) ──
  'total':                          'total',
  'Sense dades':                    'Sin datos',
  'Veure tots ({n} més)':           'Ver todos ({n} más)',
  'Sense categoria':                'Sin categoría',
  'Productes per categoria':        'Productos por categoría',
  'Estat de les comandes':          'Estado de los pedidos',
  'Adults per masia':               'Adultos por masía',
  'Carregant…':                     'Cargando…',

  // ── Ajuda (dinàmic) ──
  'Usuari':                         'Usuario',
  "Fer l'inventari":                'Hacer el inventario',
  'Ves a la pestanya <strong>Catàleg</strong>': 'Ve a la pestaña <strong>Catálogo</strong>',
  'Clica un producte i introdueix les <strong>caixes</strong> i <strong>unitats</strong> disponibles':
    'Haz clic en un producto e introduce las <strong>cajas</strong> y <strong>unidades</strong> disponibles',
  'Repeteix per tots els productes que tens en estoc': 'Repite para todos los productos que tienes en stock',
  'Quan hagis acabat, prem <strong>Enviar inventari</strong> al Resum': 'Cuando hayas acabado, pulsa <strong>Enviar inventario</strong> en el Resumen',
  'Desmarcar un producte':          'Desmarcar un producto',
  'A <strong>Resum</strong>, clica la <strong>×</strong> al costat del producte': 'En <strong>Resumen</strong>, haz clic en la <strong>×</strong> junto al producto',
  'O torna al <strong>Catàleg</strong>, clica el producte i prem <strong>Desmarcar</strong>':
    'O vuelve al <strong>Catálogo</strong>, haz clic en el producto y pulsa <strong>Desmarcar</strong>',
  "Comprovar si l'inventari ha arribat": 'Comprobar si el inventario ha llegado',
  'Ves a la pestanya <strong>Informes</strong>': 'Ve a la pestaña <strong>Informes</strong>',
  "Les entrades amb la icona verda <strong>Rebut</strong> confirmen que el coordinador l'ha vist":
    'Las entradas con el icono verde <strong>Recibido</strong> confirman que el coordinador la ha visto',
  "Generar comanda des d'un inventari": 'Generar pedido desde un inventario',
  "Ves a <strong>Informes</strong> i localitza l'inventari rebut": 'Ve a <strong>Informes</strong> y localiza el inventario recibido',
  'Prem <strong>Generar comanda</strong>': 'Pulsa <strong>Generar pedido</strong>',
  'Revisa i ajusta les quantitats proposades': 'Revisa y ajusta las cantidades propuestas',
  'Prem <strong>Acceptar comanda</strong> per crear-la': 'Pulsa <strong>Aceptar pedido</strong> para crearlo',
  'Crear una comanda manual':       'Crear un pedido manual',
  'Ves a <strong>Comandes</strong> i prem <strong>+ Nova comanda</strong>': 'Ve a <strong>Pedidos</strong> y pulsa <strong>+ Nuevo pedido</strong>',
  'Cerca productes amb el buscador i afegeix-los': 'Busca productos con el buscador y añádelos',
  'Introdueix caixes i unitats per a cada producte': 'Introduce cajas y unidades para cada producto',
  'Omple proveïdor i data i prem <strong>Desar</strong>': 'Rellena proveedor y fecha y pulsa <strong>Guardar</strong>',
  "Canviar l'estat d'una comanda":  'Cambiar el estado de un pedido',
  "A <strong>Comandes</strong>, clica la pastilla d'estat de la comanda": 'En <strong>Pedidos</strong>, haz clic en la pastilla de estado del pedido',
  "L'estat canvia automàticament: Pendent → En curs → Rebuda": 'El estado cambia automáticamente: Pendiente → En curso → Recibida',
  'Veure estadístiques':            'Ver estadísticas',
  'Ves a la pestanya <strong>Estadístiques</strong>': 'Ve a la pestaña <strong>Estadísticas</strong>',
  "Consulta els gràfics d'estat de comandes i adults per masia": 'Consulta los gráficos de estado de pedidos y adultos por masía',
  'Afegir o editar un producte':    'Añadir o editar un producto',
  'Ves a <strong>Catàleg</strong> i prem <strong>+ Nou producte</strong>': 'Ve a <strong>Catálogo</strong> y pulsa <strong>+ Nuevo producto</strong>',
  'Per editar-ne un, mantén premut sobre el producte': 'Para editar uno, mantén pulsado sobre el producto',
  'Defineix nom, categoria, unitat, unitats per caixa i estoc mínim': 'Define nombre, categoría, unidad, unidades por caja y stock mínimo',
  'Gestionar usuaris':               'Gestionar usuarios',
  'Ves a la pestanya <strong>Usuaris</strong>': 'Ve a la pestaña <strong>Usuarios</strong>',
  'Prem <strong>+ Nou usuari</strong> per afegir un Encarregat, Coordinador o Admin':
    'Pulsa <strong>+ Nuevo usuario</strong> para añadir un Encargado, Coordinador o Admin',
  "Per eliminar-ne un, clica l'usuari i prem <strong>Eliminar</strong>": 'Para eliminar uno, haz clic en el usuario y pulsa <strong>Eliminar</strong>',

  // ── Catàleg (dinàmic) ──
  'Sense coincidències':            'Sin coincidencias',
  'Carregant catàleg…':             'Cargando catálogo…',
  "No s'ha pogut carregar l'escàner.": 'No se ha podido cargar el escáner.',
  'Apunta la càmera al codi de barres': 'Apunta la cámara al código de barras',
  "Error carregant l'escàner. Comprova la connexió.": 'Error al cargar el escáner. Comprueba la conexión.',
  "No s'ha pogut accedir a la càmera.": 'No se ha podido acceder a la cámara.',
  'Buscant producte…':              'Buscando producto…',
  'Trobat: {name}':                 'Encontrado: {name}',
  '"{name}" no és al nostre catàleg però existeix a la base de dades pública. Vols afegir-lo?':
    '"{name}" no está en nuestro catálogo pero existe en la base de datos pública. ¿Quieres añadirlo?',
  "El codi {code} no és al nostre catàleg. Vols crear un producte nou a partir d'aquest codi?":
    'El código {code} no está en nuestro catálogo. ¿Quieres crear un producto nuevo a partir de este código?',
  "No s'ha pogut carregar el catàleg.<br>Comprova la connexió a internet.": 'No se ha podido cargar el catálogo.<br>Comprueba la conexión a internet.',
  'Cap producte al catàleg.':       'Ningún producto en el catálogo.',
  'Escaneja codi de barres':        'Escanear código de barras',
  'Cerca producte…':                'Buscar producto…',
  'Nom, categoria, proveïdor… (Enter per text)': 'Nombre, categoría, proveedor… (Intro para texto)',
  'Proveïdor':                      'Proveedor',
  '{name} desmarcat':               '{name} desmarcado',
  'URL desada correctament':        'URL guardada correctamente',
  'URL eliminada':                  'URL eliminada',
  'Enganxa primer la URL':          'Pega primero la URL',
  'Comprova si ha aparegut una fila TEST al full': 'Comprueba si ha aparecido una fila TEST en la hoja',
  'Editar producte':                'Editar producto',
  'Desar canvis':                   'Guardar cambios',
  '"{name}" actualitzat':           '"{name}" actualizado',
  'Eliminar "{name}" del catàleg?': '¿Eliminar "{name}" del catálogo?',
  '"{name}" eliminat del catàleg':  '"{name}" eliminado del catálogo',
  '"{name}" afegit i enviat al full': '"{name}" añadido y enviado a la hoja',
  '"{name}" desat localment':       '"{name}" guardado localmente',
  'Error al desar: {msg}':          'Error al guardar: {msg}',

  // ── Stats / Historial (dinàmic) ──
  "Encara sense connexió. S'enviarà automàticament quan tornis a tenir WiFi.":
    'Aún sin conexión. Se enviará automáticamente cuando vuelvas a tener WiFi.',
  'Inventari enviat.':              'Inventario enviado.',
  'Confirmar?':                     '¿Confirmar?',
  'Eliminant… (id: {id})':          'Eliminando… (id: {id})',
  'Petició enviada al full':        'Petición enviada a la hoja',
  'Error de xarxa al eliminar':     'Error de red al eliminar',
  'Estoc baix':                     'Stock bajo',
  "Encara no s'ha comptat cap producte": 'Todavía no se ha contado ningún producto',
  'Total comptat':                  'Total contado',
  '{n} productes':                  '{n} productos',
  "Canvis pendents d'enviar":       'Cambios pendientes de enviar',
  'Comentari opcional…':            'Comentario opcional…',
  'Enviar inventari al coordinador': 'Enviar inventario al coordinador',
  '{n} producte{s} per sota del mínim': '{n} producto{s} por debajo del mínimo',
  'Per categoria':                  'Por categoría',
  '{n} art.':                       '{n} art.',
  'mín':                            'mín',
  'Sense estoc':                    'Sin stock',
  "Tot l'estoc està en ordre ✓":    'Todo el stock está en orden ✓',
  "Sense connexió: l'inventari s'ha desat i s'enviarà quan tinguis WiFi.":
    'Sin conexión: el inventario se ha guardado y se enviará cuando tengas WiFi.',
  "Inventari enviat. Comprova'l a l'historial.": 'Inventario enviado. Compruébalo en el historial.',
  'Eliminar permanentment':         'Eliminar permanentemente',
  "Ja s'ha generat una comanda a partir d'aquest inventari": 'Ya se ha generado un pedido a partir de este inventario',
  'Comanda generada':               'Pedido generado',
  'Torna a generar':                'Volver a generar',
  'Genera comanda':                 'Generar pedido',
  'Enviar ara':                     'Enviar ahora',
  'Producte nou':                   'Producto nuevo',
  'No enviat':                      'No enviado',
  'Rebut':                          'Recibido',
  'Sense resultats.':               'Sin resultados.',
  'Carregar més ({n} restants)':    'Cargar más ({n} restantes)',
  'Carregant historial…':           'Cargando historial…',
  "Error: s'està llegint el full incorrecte.": 'Error: se está leyendo la hoja incorrecta.',
  'Capçaleres trobades:':           'Cabeceras encontradas:',
  'Error carregant historial. Comprova la connexió.': 'Error al cargar historial. Comprueba la conexión.',
  'Sense historial':                'Sin historial',
  'Els teus inventaris enviats i productes creats apareixeran aquí.': 'Tus inventarios enviados y productos creados aparecerán aquí.',
  "Els encarregats enviaran informes quan acabin l'inventari.": 'Los encargados enviarán informes cuando acaben el inventario.',
  "Sense connexió — mostrant només els inventaris pendents d'enviar.": 'Sin conexión — mostrando solo los inventarios pendientes de enviar.',
  'Cerca producte, usuari…':        'Buscar producto, usuario…',
  'Tot':                            'Todo',
  'Inventaris':                     'Inventarios',
  'Productes nous':                 'Productos nuevos',
  'mín.':                           'mín.',
  'Recomanació basada en la mitjana de caixes per adult': 'Recomendación basada en la media de cajas por adulto',
  'c/adult':                        'c/adulto',
  '{n} com.':                       '{n} ped.',
  "Com s'ha calculat?":             '¿Cómo se ha calculado?',
  'Estoc actual:':                  'Stock actual:',
  "Mitjana de caixes/adult d'aquest producte (calculada amb {n} comanda{s} anteriors):":
    'Media de cajas/adulto de este producto (calculada con {n} pedido{s} anteriores):',
  'adult':                          'adulto',
  "Adults d'aquesta masia:":        'Adultos de esta masía:',
  'Objectiu de caixes = mitjana × adults': 'Objetivo de cajas = media × adultos',
  'Quantitat a demanar = objectiu − estoc actual': 'Cantidad a pedir = objetivo − stock actual',
  'Arrodonit amunt a caixes senceres': 'Redondeado hacia arriba a cajas enteras',
  'Encara sense mitjana; recomanació basada en el mínim del catàleg': 'Todavía sin media; recomendación basada en el mínimo del catálogo',
  'sense mitjana':                  'sin media',
  'Aquest producte no té cap comanda anterior registrada{note}, per tant no hi ha mitjana → es fa servir el mínim del catàleg':
    'Este producto no tiene ningún pedido anterior registrado{note}, por lo tanto no hay media → se usa el mínimo del catálogo',
  ' (o falten adults de la masia)': ' (o faltan adultos de la masía)',
  'Mínim del catàleg:':             'Mínimo del catálogo:',
  'Quantitat a demanar = mínim − estoc actual': 'Cantidad a pedir = mínimo − stock actual',
  'Quantitat a demanar':            'Cantidad a pedir',
  'Comanda — {masia}':              'Pedido — {masia}',
  'suma de tots els casaments de la masia': 'suma de todas las bodas de la masía',
  'adults':                         'adultos',
  'Total':                          'Total',
  'cap casament trobat — valor manual': 'ninguna boda encontrada — valor manual',
  'Inventari del':                  'Inventario del',
  'a les':                          'a las',
  'Adults a la masia':              'Adultos en la masía',
  'Cap producte per demanar':       'Ningún producto para pedir',
  'Inventari del {date} ({hora}) · {comensal}': 'Inventario del {date} ({hora}) · {comensal}',
  'Inventari actualitzat':          'Inventario actualizado',
};

export function getLang() {
  return localStorage.getItem(STORAGE_LANG) === 'es' ? 'es' : 'ca';
}

export function setLang(lang) {
  localStorage.setItem(STORAGE_LANG, lang === 'es' ? 'es' : 'ca');
  document.documentElement.lang = getLang();
  applyI18n();
}

export function t(text, vars) {
  let str = getLang() === 'es' ? (ES[text] ?? text) : text;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}
