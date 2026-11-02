# Lorba Medical — demo de reserva de citas

Demo comercial de una consulta **ficticia** de medicina general en Estados Unidos, con tres
sedes (Downtown, Northside y Westside), web pública bilingüe y un recorrido de reserva
completo. Incluye además una vista de recepción con cuatro pantallas: resumen de las tres
sedes, agenda del día, listado y **lista de espera** para cubrir cancelaciones.

Todo —la marca, los profesionales, las sedes, los horarios y las citas— es inventado.
No es un sistema médico ni se conecta con ningún servicio externo.

---

## Requisitos

- **Node 20 o superior.** El Node del sistema (18) no sirve: Vite 5 y Vitest fallan.
  Con nvm:
  ```bash
  nvm use 20          # o: export PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"
  ```
- npm 9 o superior.
- Para las pruebas de extremo a extremo, Chromium de Playwright
  (`npx playwright install chromium`, ~120 MB, solo una vez).

## Instalación y ejecución

```bash
npm install
npm run dev          # http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` para revisar el build |
| `npm run typecheck` | Solo `vue-tsc`, sin generar nada |
| `npm run test` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Recorrido completo en navegador (Playwright) |
| `npm run verify` | Tipos + pruebas unitarias + build, en ese orden |

`npm run test:e2e` levanta él mismo un servidor de previsualización en el puerto 4178.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Portada |
| `/care` | Servicios y enfoque de atención |
| `/team` | Equipo (tres perfiles de demostración) |
| `/locations` | Las tres sedes |
| `/patient-information` | Primera visita, pago, preguntas frecuentes y créditos de imágenes |
| `/book/:step` | Asistente de reserva (`visit`, `place`, `when`, `details`) |
| `/booking/:reference` | Confirmación de una reserva |
| `/demo/reception` | Vista de recepción: resumen, agenda, listado y lista de espera |

El asistente no deja saltarse pasos: si entras por una URL profunda sin haber contestado los
anteriores, te devuelve al primero que falte.

---

## Estructura

```
src/
├── types/           Modelos compartidos (Service, Provider, ClinicLocation, Slot, Appointment…)
├── data/            Datos ficticios: sedes, servicios, profesionales, agenda inicial, créditos
├── services/
│   ├── clinicTime.ts      Hora de las clínicas (America/New_York) y formatos por idioma
│   ├── availability.ts    Generación de huecos y capacidad (pura, determinista)
│   ├── waitlist.ts        Reglas de compatibilidad de la lista de espera (puras)
│   ├── metrics.ts         Métricas del panel de sedes (puras, derivadas del estado)
│   ├── schedulingApi.ts   ← la costura que sustituirías por una API real
│   ├── calendarFile.ts    Generación del archivo .ics
│   └── storage.ts         Envoltorio de sessionStorage
├── stores/
│   ├── schedule.ts        Estado único de citas: lo usan la web y recepción
│   └── booking.ts         Borrador del asistente y validación
├── i18n/            vue-i18n + locales/en.ts y locales/es.ts
├── router/          Rutas y la guarda que protege los pasos del asistente
├── styles/          tokens.css (variables de diseño) y base.css
├── components/
│   ├── ui/          Primitivas: botón, campo, tarjeta de opción, diálogo, icono, insignia
│   ├── layout/      Cabecera, pie, logotipo, selector de idioma
│   ├── home/        Secciones de la portada
│   ├── locations/   Plano esquemático del entorno de cada sede
│   ├── booking/     Progreso, resumen, un componente por paso, calendario y lista de horas
│   ├── waitlist/    Alta en la lista de espera desde la web pública
│   └── reception/   Resumen, agenda, listado, lista de espera, ofertas y actividad
└── views/           Un componente por ruta

tests/               Pruebas unitarias (lógica, traducciones, primitivas)
e2e/                 Recorrido completo en navegador
scripts/             Utilidades de revisión: capturas de pantalla
public/images/       Fotografía en WebP + CREDITS.md
```

---

## Dónde tocar cada cosa

| Qué quieres cambiar | Dónde |
| --- | --- |
| **Marca (nombre, símbolo)** | `src/components/layout/LogoMark.vue` y `public/favicon.svg` |
| **Colores, tipografías, espaciado, radios** | `src/styles/tokens.css` (nada está escrito a mano fuera de ahí) |
| **Fuentes web** | `index.html` (Newsreader para titulares, Inter para interfaz) |
| **Textos de la interfaz** | `src/i18n/locales/en.ts` y `src/i18n/locales/es.ts` |
| **Servicios / tipos de consulta** | `src/data/services.ts` (nombre, descripción y duración) |
| **Profesionales** | `src/data/providers.ts` (idiomas, servicios y sedes que atienden) |
| **Sedes** | `src/data/locations.ts` (descripción, cómo llegar, teléfono, horario) |
| **Plano del entorno** | `src/components/locations/ClinicLocator.vue` (SVG en línea, una escena por sede; las etiquetas se posicionan en porcentaje sobre el `viewBox`) |
| **Agenda inicial de recepción** | `src/data/demoSchedule.ts` (citas sueltas) y `src/data/demoScenario.ts` (escenario guionizado y carga de trabajo de fondo) |
| **Reglas de la lista de espera** | `src/services/waitlist.ts` |
| **Duración de la retención de un horario** | `HOLD_MINUTES` en `src/services/schedulingApi.ts` |
| **Definición de las métricas del panel** | `src/services/metrics.ts` |
| **Fotografías** | `public/images/` + `src/data/imageCredits.ts` |

Los nombres de servicios, profesionales y sedes están tipados: si añades uno, TypeScript te
señala todos los sitios que hay que completar. La duración de cada servicio define el paso de
la rejilla de horas, así que dos huecos ofrecidos nunca se solapan.

Las traducciones tienen una prueba que exige **paridad exacta de claves** entre los dos
idiomas y que todos los mensajes se compilen. Ojo con el carácter `@`: vue-i18n lo trata como
sintaxis de mensaje enlazado y hay que escribirlo literal, `{'@'}`.

---

## Los datos ficticios

- La **disponibilidad no está escrita a mano**: se genera con un generador pseudoaleatorio
  con semilla a partir de `profesional + sede + fecha`. El mismo día da siempre la misma
  rejilla, así que puedes recargar o repetir la demostración sin que el calendario cambie de
  forma. Todas las fechas se calculan desde hoy: la demo no caduca.
- Las **citas** viven en `sessionStorage`. Sobreviven a una recarga y desaparecen al cerrar la
  pestaña. Nada sale del navegador.
- La **agenda inicial** se ancla al primer día que las clínicas abren (hoy, o el lunes si hoy
  es domingo), de modo que recepción nunca abre vacía.
- **El escenario guionizado** (`src/data/demoScenario.ts`) prepara la demostración: una cita
  futura lista para anular y tres pacientes en lista de espera, dos compatibles con ese hueco
  —uno de ellos adelantaría una cita que ya tiene— y uno incompatible, para que se vea
  funcionar el filtrado. Además se reserva de forma determinista unos dos tercios de los
  huecos de los tres primeros días abiertos, para que el panel muestre una ocupación creíble.
- **Controles de demostración**, en la barra lateral de `/demo/reception` y separados de las
  acciones normales del mostrador:
  - *Cargar escenario de ejemplo*: repone la cita preparada y los tres pacientes en espera si
    faltan, **sin** descartar lo reservado durante la sesión.
  - *Abrir la cita preparada para anular*: salta a su día y abre su ficha.
  - *Restaurar datos de ejemplo*, con confirmación: borra todo —citas, lista de espera,
    ofertas, retenciones, actividad y contadores— y vuelve al estado inicial.
- Cerrar la pestaña equivale a restaurar.
- Reglas que se respetan de verdad: no se ofrecen horas pasadas ni fuera del horario de
  apertura, hay dos horas de margen mínimo, una cita reservada deja de ofrecerse, una anulada
  libera el hueco, y antes de confirmar se vuelve a validar la disponibilidad.

### Lista de espera

- Al **anular o mover** una cita futura, el horario que queda libre se registra como hueco
  por cubrir y se anota en la actividad con el número real de pacientes compatibles.
- La **compatibilidad** es un conjunto de reglas deterministas en `src/services/waitlist.ts`:
  tipo de consulta y duración, sede aceptada, profesional concreto o cualquiera, intervalo de
  fechas, días de la semana y franja horaria. Si la inscripción está ligada a una cita que el
  paciente ya tiene, la alternativa debe ser **anterior**. El orden es por antigüedad en la
  lista. No se usa diagnóstico, seguro, ingresos ni ningún otro dato sensible.
- Al **ofrecer** un horario se retiene durante 15 minutos: desaparece del calendario
  público y no puede ofrecerse a otra persona ni reprogramarse encima. La pantalla indica
  hasta cuándo.
- La respuesta se **simula** desde controles marcados como tales. Al aceptar se revalida la
  disponibilidad; si el paciente tenía una cita posterior, la nueva se crea primero y solo
  entonces se anula la anterior, así que un fallo nunca lo deja sin ninguna. Al rechazar o
  vencer, la retención se libera y el hueco puede ofrecerse al siguiente.
- Al recargar, las ofertas vencidas se concilian: la retención se libera y el paciente vuelve
  a estar en espera.

### Panel de sedes

- La **ocupación** son los minutos reservados divididos entre los minutos que ofrecen los
  profesionales de esa sede en el periodo. Las cancelaciones no cuentan como ocupación y las
  retenciones se muestran aparte.
- Las métricas del periodo seleccionado se separan de las de estado actual (pacientes
  esperando, ofertas pendientes, horarios retenidos, huecos cubiertos).
- *Huecos cubiertos* cuenta únicamente ofertas aceptadas y se deriva del estado, así que no
  se duplica al recargar. Esta demo no tiene estado «pendiente de confirmar»: una reserva
  queda confirmada al hacerse.

## Horario y zona horaria

Las clínicas viven en `America/New_York`. Las horas se guardan como **hora de pared de la
clínica** (`YYYY-MM-DDTHH:mm`) y solo se convierten a un instante real cuando hace falta:
para comparar con «ahora» o para escribir el archivo de calendario. El cambio de horario de
verano se resuelve preguntando a `Intl` el desfase de la zona en ese instante concreto, así
que una cita de las 09:00 son las 09:00 en enero y en julio. El sitio muestra la hora de las
clínicas sea cual sea la zona del dispositivo de quien mira.

En inglés las horas se muestran en formato de 12 horas (`2:30 PM`) y en español en formato de
24 horas (`14:30`).

---

## Limitaciones

- **No hay backend.** Ninguna petición sale del navegador.
- **No se envía nada**: ni correo, ni SMS, ni recordatorios, tampoco las ofertas de la lista
  de espera. La confirmación y la vista previa del mensaje lo dicen expresamente, y la
  respuesta del paciente se simula a mano.
- **No hay autenticación.** `/demo/reception` es pública a propósito y lo avisa: cualquiera
  con el enlace ve la misma agenda inventada. No simula roles ni permisos.
- **No hay pagos, facturación, historia clínica, recetas ni documentos médicos**, y el
  formulario nunca pide síntomas, documento de identidad, fecha de nacimiento, número de
  póliza ni datos bancarios.
- No se presenta ninguna aseguradora como aceptada, ni se afirma cumplimiento normativo.
- Las sedes se describen por su entorno, sin dirección postal, para que ninguna consulta real
  pueda confundirse con esta. Por eso el plano de cada sede es un **esquema dibujado a mano**
  y no un mapa: no hay servicio de mapas ni coordenadas reales. Cada sede tiene el suyo,
  porque en una consulta real las sedes podrían estar lejos unas de otras.
- Los perfiles del equipo son inventados y sus fotografías son ilustrativas; está indicado en
  cada sitio donde aparecen.
- Los datos desaparecen al cerrar la pestaña: no es almacenamiento duradero.
- Probado en Chromium. No se ha verificado en Safari ni en dispositivos reales.

## Imágenes y recursos

Las ocho fotografías son de **Unsplash**, bajo la
[licencia de Unsplash](https://unsplash.com/license), que permite el uso comercial. La autoría
completa está en `public/images/CREDITS.md`, en `src/data/imageCredits.ts` y publicada en la
propia web, en *Patient information → Image credits*.

Las personas fotografiadas **no son** los profesionales ficticios que aparecen nombrados y no
tienen relación con esta demo.

Cada archivo se descargó, se recortó, se convirtió a WebP y se le quitaron los metadatos: 368 KB
en total. Tipografías: Newsreader e Inter, servidas por Google Fonts. Iconos: Lucide.

---

## Conectar un backend real

El trabajo está acotado a un archivo. `src/services/schedulingApi.ts` exporta la interfaz
`SchedulingApi` y una implementación de demostración; el resto de la aplicación solo conoce la
interfaz.

```ts
export interface SchedulingApi {
  listAppointments(): Promise<Appointment[]>
  getDaySlots(search): Promise<Slot[]>
  getDayCounts(search): Promise<Record<DateKey, number>>
  getFirstAvailable(search): Promise<Slot | null>
  getProviderAvailability(search): Promise<ProviderAvailability[]>
  book(input): Promise<Result<{ appointment: Appointment }>>
  reschedule(id, slot): Promise<Result<{ appointment: Appointment }>>
  setStatus(id, status): Promise<Result<{ appointment: Appointment }>>

  joinWaitlist(input): Promise<Result<{ entry: WaitlistEntry }>>
  updateWaitlistPreferences(id, preferences): Promise<Result<{ entry: WaitlistEntry }>>
  withdrawFromWaitlist(id): Promise<Result<{ entry: WaitlistEntry }>>
  candidatesForOpening(openingId): Promise<Candidate[]>
  offerOpening(openingId, entryId): Promise<Result<{ offer: Offer }>>
  respondToOffer(offerId, response): Promise<Result<{ offer; appointment }>>
  dismissOpening(id): Promise<Result<{ opening: Opening }>>

  loadScenario(): Promise<DemoState>
  reset(): Promise<DemoState>
}
```

Para enchufar un sistema real:

1. Escribe otro objeto que cumpla `SchedulingApi` llamando a tu API y cambia la última línea
   del archivo (`export const schedulingApi = …`). No hay que tocar vistas ni stores.
2. `src/services/availability.ts` deja de hacer falta: la disponibilidad la calcularía el
   servidor. Conserva las mismas reglas (horario, margen mínimo, solapes) o se notará.
3. Sustituye `src/services/storage.ts` por la sesión real del paciente, y añade autenticación
   de verdad antes de exponer nada parecido a `/demo/reception`.
4. `respondToOffer` sería el webhook por el que llega la respuesta real del paciente, en
   lugar de los botones de simulación. La retención del horario tendría que vivir en el
   servidor para que valga entre varios dispositivos.
5. Lo que esta demo evita a propósito y un sistema real necesita: envío de confirmaciones,
   recordatorios y ofertas por correo o SMS, verificación de cobertura del seguro,
   trazabilidad de cambios, control de acceso por rol y la normativa de datos de salud que
   corresponda. Nada de eso está simulado aquí, y conviene no dar a entender que sí.
6. Los datos ficticios (`src/data/*.ts`) pasarían a venir del servidor; los tipos de
   `src/types/index.ts` sirven como contrato de partida.

---

## Pruebas

```bash
npm run test       # 88 pruebas unitarias
npm run test:e2e   # 21 recorridos en navegador
```

Las unitarias cubren lo que de verdad puede romperse en silencio: conversión de hora de las
clínicas y cambio de horario de verano, generación y determinismo de huecos, horarios de
apertura, bloqueo por cita reservada y liberación al anular, reprogramación sin solapes,
reservas duplicadas, el archivo `.ics`, la paridad de las traducciones y la validación del
formulario.

También cubren la lista de espera: alta y baja, detección de candidatos, exclusión del
incompatible y el porqué, la retención durante una oferta, la aceptación, la sustitución
atómica de una cita posterior, el rechazo y el vencimiento, la imposibilidad de aceptar dos
veces, y las métricas del panel después de cada acción.

Las de navegador recorren la reserva desde el CTA principal, desde una sede concreta y desde
el selector rápido; «cualquier sede» con «el primero disponible»; la invalidación del horario
al cambiar de servicio; volver entre pasos sin perder datos; los campos obligatorios y el
correo inválido; la persistencia al recargar y el cambio de idioma; en recepción: ver la cita
recién creada, que su hora deje de ofrecerse, anular, reprogramar, filtrar, buscar, restaurar
los datos y descargar el `.ics`; y el recorrido completo de la lista de espera —anulación,
coincidencias, oferta, aceptación, agenda y panel actualizados—, además del rechazo, el
adelanto de una cita posterior, el alta desde la web pública y la persistencia al recargar.
