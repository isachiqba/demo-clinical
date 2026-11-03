# Dr. Lorba — demo de solicitud de citas

Demo comercial de la consulta personal de un médico de familia **ficticio** en Estados
Unidos, el **Dr. Lorba**, que pasa consulta en tres sedes (Downtown, Northside y Westside).
Incluye web pública bilingüe, un recorrido de **solicitud** de cita y, en recepción, el
recorrido del paciente dentro de la clínica: llegada, consultorio y volante de atención. Incluye además una vista de recepción con cinco pantallas: resumen de las tres sedes,
**bandeja de pendientes en CureMD**, agenda del día, listado y **lista de espera** para cubrir
cancelaciones.

Dos ideas sostienen la demo, y las dos vienen de la consulta real a la que se dirige:

- **Hay un solo médico.** No hay equipo, ni red de profesionales, ni nada que elegir: todas
  las citas son con el Dr. Lorba. Las tres sedes son tres sitios donde se sienta la misma
  persona, así que hay **una sola agenda**, no tres.
- **El paciente pide, no reserva.** La cita no existe de verdad hasta que alguien del
  mostrador la ha **registrado a mano en CureMD**. La demo hace visible ese trabajo
  pendiente en lugar de esconderlo.

Todo —el médico, las sedes, los horarios y las citas— es inventado. No es un sistema médico,
**no se conecta con CureMD** ni con ningún otro servicio externo. No se atribuye al Dr. Lorba
ninguna titulación, colegiación, certificación, premio, años de experiencia ni afiliación
hospitalaria, y su retrato es una fotografía ilustrativa de banco de imágenes.

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
| `/team` | Conozca al Dr. Lorba: perfil, idiomas y horario de consulta |
| `/locations` | Las tres sedes |
| `/patient-information` | Primera visita, pago, preguntas frecuentes y créditos de imágenes |
| `/book/:step` | Asistente de solicitud (`visit`, `place`, `when`, `details`) |
| `/booking/:reference` | Resguardo de la solicitud (no es una confirmación) |
| `/demo/reception` | Recepción: resumen, bandeja CureMD, pacientes en clínica, agenda, listado y lista de espera |

El asistente no deja saltarse pasos: si entras por una URL profunda sin haber contestado los
anteriores, te devuelve al primero que falte. **En ningún momento se pide elegir profesional**,
porque solo hay uno: el paciente elige tipo de consulta, sede y hora, y en el resumen aparece
el Dr. Lorba como dato fijo.

---

## Estructura

```
src/
├── types/           Modelos compartidos (Service, Provider, ClinicLocation, Slot, Appointment…)
├── data/            Datos ficticios: el médico y su horario, sedes, servicios, agenda, créditos
├── services/
│   ├── clinicTime.ts      Hora de las clínicas (America/New_York) y formatos por idioma
│   ├── availability.ts    La agenda única: rejilla de 10 min, capacidad y conflictos entre sedes
│   ├── curemd.ts          Coherencia entre los dos estados y qué tarea queda pendiente
│   ├── careFlow.ts        La visita: llegada, salas y conflictos entre ellas
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
│   └── reception/   Resumen, bandeja CureMD, agenda, listado, espera, ofertas y actividad
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
| **El médico: nombre, idiomas, textos, retrato** | `src/data/doctor.ts` (un solo archivo) |
| **Su horario de consulta por sede** | `blocks` en `src/data/doctor.ts` |
| **Margen de traslado entre sedes** | `TRAVEL_BUFFER_MINUTES` en `src/data/doctor.ts` (hoy, 45 min) |
| **Consultorios de cada sede** | `src/data/rooms.ts` |
| **Reglas de la visita y de las salas** | `src/services/careFlow.ts` |
| **Contenido y diseño del volante** | `src/components/reception/CareSlip.vue` + claves `slip.*` en los idiomas |
| **Logotipo (nombre, símbolo)** | `src/components/layout/LogoMark.vue` y `public/favicon.svg` |
| **Colores, tipografías, espaciado, radios** | `src/styles/tokens.css` (nada está escrito a mano fuera de ahí) |
| **Fuentes web** | `index.html` (Newsreader para titulares, Inter para interfaz) |
| **Textos de la interfaz** | `src/i18n/locales/en.ts` y `src/i18n/locales/es.ts` |
| **Servicios / tipos de consulta** | `src/data/services.ts` (nombre, descripción y duración orientativa) |
| **Sedes** | `src/data/locations.ts` (descripción, cómo llegar, teléfono, horario de apertura y `slotCapacity`) |
| **Intervalo entre horas ofrecidas** | `SLOT_MINUTES` en `src/types/index.ts` (hoy, 10 minutos) |
| **Pacientes por hueco en cada sede** | `slotCapacity` en `src/data/locations.ts` (hoy, 1) |
| **Reglas de coherencia entre los dos estados** | `src/services/curemd.ts` |
| **Plano del entorno** | `src/components/locations/ClinicLocator.vue` (SVG en línea, una escena por sede; las etiquetas se posicionan en porcentaje sobre el `viewBox`) |
| **Agenda inicial de recepción** | `src/data/demoSchedule.ts` (citas sueltas) y `src/data/demoScenario.ts` (escenario guionizado y carga de trabajo de fondo) |
| **Reglas de la lista de espera** | `src/services/waitlist.ts` |
| **Duración de la retención de un horario** | `HOLD_MINUTES` en `src/services/schedulingApi.ts` |
| **Definición de las métricas del panel** | `src/services/metrics.ts` |
| **Fotografías** | `public/images/` + `src/data/imageCredits.ts` (el retrato es `doctor-lorba.webp`) |

Los nombres de servicios y sedes están tipados: si añades uno, TypeScript te
señala todos los sitios que hay que completar. La rejilla de horas la define `SLOT_MINUTES`,
no la duración del servicio: todas las sedes ofrecen horas cada 10 minutos.

Las traducciones tienen una prueba que exige **paridad exacta de claves** entre los dos
idiomas y que todos los mensajes se compilen. Ojo con el carácter `@`: vue-i18n lo trata como
sintaxis de mensaje enlazado y hay que escribirlo literal, `{'@'}`.

---

## Una sola agenda

Hay un médico y tres sedes, así que hay **una agenda, no tres**. Todo el comportamiento de
disponibilidad sale de ahí, y está en `src/data/doctor.ts` y `src/services/availability.ts`.

El horario semanal son **bloques de consulta**: el Dr. Lorba sentado en una sede, de tal hora
a tal otra, un día de la semana. Un bloque puede llevar una `pause`, que es un descanso dentro
de él. De esos bloques sale la rejilla de horas, no del horario de apertura de la clínica:

| | Mañana | Tarde |
| --- | --- | --- |
| Lunes | Downtown 08:00–12:00 | Northside 14:00–18:00 |
| Martes | Northside 08:30–13:00 | Westside 14:30–17:00 |
| Miércoles | Westside 09:00–13:00 | Downtown 15:00–19:00 |
| Jueves | Downtown 08:00–12:00 | Westside 13:30–16:30 |
| Viernes | Northside 08:30–12:30 | Downtown 14:00–17:00 |
| Sábado | Downtown 09:00–13:00 | — |
| Domingo | — | — |

Las reglas que se mantienen, y que `tests/doctorSchedule.test.ts` comprueba una por una:

- **Los bloques nunca se solapan.** No puede estar en dos sedes a la vez, y la rejilla no
  ofrece el mismo minuto en dos clínicas.
- **Entre dos sedes el mismo día hay al menos `TRAVEL_BUFFER_MINUTES`** (hoy 45) para que le
  dé tiempo a llegar. La comprobación no se limita al horario: una cita, una retención o una
  reprogramación a otra sede demasiado cerca de otra se rechaza, porque esas escrituras
  ponen horas directamente.
- **Un bloque siempre cae dentro del horario de apertura de su clínica.** La clínica puede
  estar abierta un día en que él no está; él nunca está cuando está cerrada. Son dos cosas
  distintas y la web las presenta por separado.
- **La capacidad no se multiplica por el número de clínicas.** La capacidad de una sede son
  los bloques que él pasa allí, y nada más: un día que no va, su capacidad es cero aunque las
  puertas estén abiertas. Sumar las tres sedes da exactamente su jornada, contada una vez.
- **«Cualquier sede» busca en esa agenda única** y devuelve su próxima hora libre, esté donde
  esté. No es una búsqueda en tres calendarios paralelos.
- Se mantiene **un paciente por franja de 10 minutos**, supuesto provisional, configurable por
  sede en `slotCapacity` y nunca repartido por profesional.
- Sigue habiendo dos horas de margen mínimo, no se ofrecen horas pasadas y todo se calcula en
  `America/New_York`.

El intervalo de 10 minutos es **el paso con el que se ofrecen las horas**, no una promesa de
cuánto dura la consulta, y en ningún sitio de la interfaz se presenta como tal.

---

## El paciente dentro de la clínica

Hasta aquí la demo cubría la cita. Esta parte cubre lo que el mostrador hace cuando el
paciente cruza la puerta, y es **deliberadamente corta**:

> **Registrar llegada y asignar consultorio → imprimir volante → finalizar visita.**

El mostrador anota dos momentos —llegó, se fue— y un dato entre medias: en qué consultorio
está. Lo que ocurre dentro de ese consultorio no es cosa de recepción, y pedirle que fiche
cada etapa solo produce una agenda que nadie mantiene al día.

Es un **tercer estado**, independiente de los otros dos. La pantalla no los mezcla nunca,
porque responden a preguntas distintas:

| | Qué contesta |
| --- | --- |
| Estado de la cita | Qué ha acordado la consulta: solicitada, confirmada, anulada… |
| Estado en CureMD | Qué falta por teclear allí a mano |
| **Estado de la visita** | Si el paciente está en la clínica ahora mismo |

En la **agenda del día**, cada estado de la cita tiene su propio color —las completadas en
rojo— y encima del tablero hay una leyenda que los nombra. El color nunca es la única pista:
cada tarjeta sigue llevando sus dos distintivos, que se distinguen por forma e icono, y las
anuladas van además tachadas. El tablero se lee igual en blanco y negro.

Los pacientes que **están en la clínica** llevan una tarjeta más alta, con el consultorio
debajo del nombre: es lo que se pregunta mientras están ahí. La escala del tablero está
puesta para que esa tarjeta alta quepa dentro de su propia franja de diez minutos, de modo
que **nunca tapa la cita siguiente**; hay una prueba que falla si alguna se desborda.

Los tres valores de la visita son: `Pendiente de llegada`, `En clínica` y
`Visita finalizada`.

### Llegada y consultorio, en un solo diálogo

El botón *Registrar llegada* está en la agenda, en el listado y en la ficha de la cita, y abre
**un único diálogo** que hace todo lo que hay que hacer en ese momento:

- Muestra **el resumen del paciente y de la cita**, para comprobar que es quien dice ser.
- Deja **elegir un consultorio** de esa sede, con los ocupados marcados y deshabilitados.
- Registra llegada y asignación **en una sola acción**, con hora y operador de demostración.
- Al terminar, **ofrece imprimir el volante**, que es lo siguiente que cualquiera va a buscar.

También se puede registrar la llegada y **decidir el consultorio más tarde**, que es lo que
pasa cuando están todos ocupados.

- **Pulsar dos veces no duplica la llegada**: una visita ya abierta gana y la hora no se mueve.
- **No se puede registrar llegada** sobre una cita anulada o cerrada como no disponible.
- Si la cita **sigue pendiente de registrar en CureMD**, la llegada se permite igualmente —el
  paciente está ahí— con un aviso visible, y la tarea **se mantiene**. Registrar una llegada no
  toca nunca el registro de CureMD, ni ninguna otra acción de esta pantalla.
- En ese caso la cita tampoco pasa a «Ha llegado»: una solicitud que nadie ha registrado sigue
  siendo una solicitud.

### El consultorio

Un consultorio es **una sala**, no un médico ni un servicio. Están en `src/data/rooms.ts`:
Consultorio 1, 2 y 3 en Downtown y Northside, y 1 y 2 en Westside. Son todos iguales: no hay
una sala con un papel especial.

- Se elige **una sola vez** y se mantiene durante toda la visita. No hay traslados entre sala
  de signos vitales y consulta: ese circuito se quitó porque obligaba a recepción a fichar algo
  que no ve.
- Si se eligió mal, se corrige desde **«Corregir consultorio»**, en el menú secundario de la
  tarjeta, y queda registrado como corrección.
- Solo se ofrecen salas **de la sede de la cita**, y una sala **no admite dos visitas activas**.
- La disponibilidad de salas se ve sobre todo **dentro del diálogo de asignación**, que es
  donde se decide.
- **Tener varias salas no multiplica nada.** La capacidad de citas sale de los bloques de
  consulta del Dr. Lorba y de nada más. Tres salas no son tres médicos.

### Finalizar la visita

Una sola acción, *Finalizar visita*, que hace todo lo que implica terminar:

- registra **la hora de salida**;
- **libera el consultorio**;
- mueve al paciente al listado de **visitas finalizadas**;
- marca la cita como **completada** según las reglas que ya había —es decir, solo cuando eso
  sigue siendo coherente: si el registro en CureMD está pendiente, la cita no se completa,
  porque decirlo afirmaría algo de CureMD que no es cierto;
- y **no resuelve ni modifica nada que esté pendiente en CureMD**. Nunca.

### El volante de atención

*Imprimir volante* aparece en cuanto hay una llegada registrada, y también se ofrece al final
del diálogo de llegada. El volante lleva encabezado **Dr. Lorba**, el título, la marca
**DEMO — DATOS FICTICIOS**, la referencia local, el nombre del paciente, la fecha y hora de la
cita, la hora de llegada, la sede, el consultorio —o **«Por asignar»** si todavía no hay— y el
tipo de consulta. La **referencia CureMD solo aparece si existe**.

Debajo van los espacios en blanco para anotar **a mano**: presión arterial, frecuencia cardíaca,
frecuencia respiratoria, temperatura, saturación de oxígeno, peso, talla, observaciones y quién
toma los signos vitales. Las unidades están impresas junto a la línea.

Lo que el volante **no** lleva, a propósito: correo, teléfono, datos del seguro, diagnósticos.
Es una hoja que se pasea por un edificio y se queda encima de las mesas; cuanto menos diga de
una persona, mejor.

Y lo que la demo **no hace**: no genera ningún valor, no imprime rangos de referencia y no
interpreta nada. Son casillas vacías. Esto no es una historia clínica electrónica y la demo no
simula tener una.

### La impresión

- Hoja **A5 vertical**, que sale centrada y legible en A4.
- **Negro sobre blanco**, sin que ningún color tenga significado.
- Al imprimir se oculta toda la aplicación: no salen ni la navegación ni los botones.
- Comprobado: el volante **cabe en una sola página** en los dos idiomas, sin cortes ni páginas
  en blanco de más.
- El botón abre el **diálogo de impresión del navegador**, desde el que también se puede
  guardar en PDF.
- **Reimprimir no crea otra cita ni cambia ningún estado**, y el volante se genera siempre con
  los datos actuales de la cita y del consultorio.
- El volante se puede imprimir **en inglés o en español** sin tocar el idioma de la aplicación
  ni los datos de la cita.
- Nunca se dice que algo se haya impreso, porque no se puede saber: el diálogo del navegador se
  puede cancelar. Lo que se registra es **«impresión solicitada»**.

### Pacientes en clínica

Cada tarjeta muestra **solo** lo que el mostrador necesita de un vistazo: nombre, sede y hora
de la cita, hora de llegada, consultorio y estado de la visita; más, aparte, los indicadores de
la cita y de CureMD. Dos acciones principales —*Imprimir volante* y *Finalizar visita*— y
*Corregir consultorio* dentro de un menú secundario.

Se filtra por sede y se alterna entre **En clínica** y **Visita finalizada**.

Cuando la visita ha terminado, la ficha de la cita deja de ofrecer acciones sobre ella: lo
único que queda es **programar otra cita**. No hay nada que decidir sobre una visita que ya
ocurrió, y ofrecer botones que no llevan a ninguna parte solo invita a pulsarlos.

Se registran en el historial de la cita: la llegada, la asignación del consultorio, las
correcciones, la solicitud de impresión y la salida. Todo con el operador de demostración; aquí
no hay autenticación de ninguna clase.

---

## Los dos estados

Una cita de esta demo lleva **dos estados independientes**, y la interfaz nunca los mezcla.

| Estado de la cita | Qué significa |
| --- | --- |
| `requested` | El paciente la ha pedido. Nadie la ha confirmado todavía. |
| `confirmed` | La consulta la ha aceptado. Solo se puede llegar aquí si ya está en CureMD. |
| `arrived` | El paciente ha llegado. |
| `completed` | La visita se ha hecho. |
| `cancelled` | Anulada. |
| `unavailable` | La hora pedida no se puede dar; se le propone otra. |

| Estado en CureMD | Qué significa |
| --- | --- |
| `pending-registration` | Hay que meterla en CureMD a mano. |
| `registered` | Alguien del mostrador declara que ya está metida. |
| `change-pending` | Se ha acordado otra hora, pero en CureMD sigue la antigua. |
| `cancellation-pending` | Se ha anulado aquí, pero en CureMD sigue viva. |
| `cancelled` | Sacada también de CureMD. |
| `not-required` | Nunca llegó a entrar en CureMD, así que no hay nada que hacer allí. |

Las combinaciones posibles están escritas en una sola tabla, en `src/services/curemd.ts`, y
de ahí salen las reglas que el resto de la aplicación respeta:

- **No se puede confirmar una cita que no esté registrada en CureMD.** El botón de confirmar
  no aparece hasta entonces.
- Una **cancelación pendiente sigue ocupando su hueco**. Mientras CureMD crea que la cita
  existe, la hora no se ofrece a nadie, ni en la web ni en la lista de espera. El hueco se
  libera en el momento en que recepción declara que ya la ha sacado de CureMD.
- Un **cambio pendiente** funciona igual: la hora nueva queda retenida y la antigua se
  mantiene hasta que el cambio se declara aplicado. Si algo sale mal, el paciente nunca se
  queda sin ninguna de las dos.
- Toda transición vive en `src/services/schedulingApi.ts`. Ninguna vista cambia un estado por
  su cuenta, y cada escritura lleva un `expectedVersion`: si la ficha se ha movido mientras
  tenías el diálogo abierto, la operación se rechaza en vez de pisar el cambio del otro.

### El registro manual

Marcar algo como registrado **no envía nada a ninguna parte**; es una anotación de que una
persona ya lo ha hecho por su cuenta en CureMD. El diálogo lo dice en cada caso y recoge:

- la fecha y la hora en que se declara,
- quién lo declara (en la demo siempre `Demo Reception`, en `DEMO_OPERATOR`),
- una referencia externa opcional, por si se quiere anotar el identificador de CureMD,
- y **la versión de los datos que se declaró**, de modo que luego se puede ver qué hora
  concreta quedó registrada allí, aunque después haya cambiado aquí.

Todo ello se guarda en el historial de la cita, junto con el resto de acontecimientos.

### La bandeja de pendientes

La pestaña *Bandeja CureMD* reúne las tres clases de trabajo pendiente —registrar, aplicar un
cambio y anular— con filtros por sede, tipo de operación, día de la cita y texto libre. Se
ordena por **antigüedad de la tarea**, lo más viejo primero, y distingue siempre la antigüedad
de la tarea de la fecha de la cita: algo pedido hace tres días para dentro de un mes corre más
prisa que algo pedido hace diez minutos para mañana.

Los dos estados se muestran con dos distintivos **visualmente distintos**, no solo por color:
el de la cita lleva borde recto y su propio icono, el de CureMD borde redondeado discontinuo y
otro icono. Se leen igual en blanco y negro.

---

## Los datos ficticios

- La **disponibilidad se calcula**, no está escrita a mano: sale de los bloques de consulta
  del Dr. Lorba, en franjas de 10 minutos, descontando sus descansos. Lo que varía de un día a
  otro es la carga de trabajo de fondo, generada con un generador pseudoaleatorio con semilla,
  así que el mismo día da siempre la misma agenda y puedes recargar o repetir la demostración
  sin que cambie nada. Todas las fechas se calculan desde hoy: la demo no caduca.
- **Capacidad por hueco: un paciente.** Es un supuesto provisional, no un dato de la consulta;
  está en `slotCapacity`, por sede, para poder subirlo cuando se sepa el número real.
- Las **citas** viven en `sessionStorage`. Sobreviven a una recarga y desaparecen al cerrar la
  pestaña. Nada sale del navegador.
- Lo guardado lleva un **número de versión de esquema** (`SCHEMA_VERSION`, en
  `src/services/storage.ts`). Si cambia la forma de los datos, lo guardado por una versión
  anterior **se descarta y se reconstruye el escenario** en lugar de cargarse a medias. Sin
  esto, una pestaña abierta durante un despliegue se quedaba con datos viejos y la demo
  fallaba de formas difíciles de explicar: visitas en una etapa que ya no existe, ausentes del
  listado de la clínica y mostrando la clave de traducción en crudo. Al cambiar el esquema hay
  que subir ese número.
- La **agenda inicial** se ancla al primer día que las clínicas abren (hoy, o el lunes si hoy
  es domingo), de modo que recepción nunca abre vacía.
- **El escenario guionizado** (`src/data/demoScenario.ts`) deja preparada una pieza de cada
  cosa que hay que enseñar: una solicitud por registrar, una cita ya registrada, un cambio por
  aplicar y una anulación por hacer en CureMD; más tres pacientes en lista de espera, dos
  compatibles con el hueco que va a quedar libre —una de ellas adelantaría una cita que ya
  tiene, así que su aceptación se convierte en un cambio pendiente— y uno incompatible, para
  que se vea funcionar el filtrado. Las piezas guionizadas se colocan **antes** que la carga de
  fondo, de modo que una agenda llena nunca puede enterrarlas.
- **Controles de demostración**, en la barra lateral de `/demo/reception` y separados de las
  acciones normales del mostrador:
  - *Cargar escenario de ejemplo*: repone la cita preparada y los tres pacientes en espera si
    faltan, **sin** descartar lo reservado durante la sesión.
  - *Abrir la solicitud por registrar* y *Abrir la anulación pendiente*: saltan a su día y
    abren la ficha correspondiente, para no tener que buscarla delante del cliente.
  - *Restaurar datos de ejemplo*, con confirmación: borra todo —citas, lista de espera,
    ofertas, retenciones, actividad y contadores— y vuelve al estado inicial.
- Cerrar la pestaña equivale a restaurar.
- Reglas que se respetan de verdad: no se ofrecen horas pasadas ni fuera del horario de
  apertura, hay dos horas de margen mínimo, un hueco ocupado deja de ofrecerse, una anulación
  **ya hecha en CureMD** libera el hueco —una pendiente no—, y antes de cada escritura se
  vuelve a validar la disponibilidad.

### Lista de espera

- El hueco se registra como libre **cuando lo está de verdad**: al declarar hecha en CureMD
  una anulación, al declarar aplicado un cambio, o al anular una solicitud que nunca llegó a
  registrarse. Una anulación **pendiente** en CureMD no genera ninguna oferta todavía, porque
  para CureMD esa hora sigue ocupada. Al registrarse, el hueco se anota en la actividad con el
  número real de pacientes compatibles.
- La **compatibilidad** es un conjunto de reglas deterministas en `src/services/waitlist.ts`:
  tipo de consulta, sede aceptada, intervalo de fechas, días de la semana y franja horaria.
  **No hay reglas de profesional**, porque solo hay uno. Antes de ofrecer un hueco y otra vez
  al aceptarlo se comprueba que siga libre **en la agenda única**, incluidos los conflictos
  con otra sede y el margen de traslado. Si la inscripción está
  ligada a una cita que el paciente ya tiene, la alternativa debe ser **anterior**. El orden es
  por antigüedad en la lista. No se usa diagnóstico, seguro, ingresos ni ningún otro dato
  sensible.
- Al **ofrecer** un horario se retiene durante 15 minutos: desaparece del calendario
  público y no puede ofrecerse a otra persona ni reprogramarse encima. La pantalla indica
  hasta cuándo.
- La respuesta se **simula** desde controles marcados como tales. Al aceptar se revalida la
  disponibilidad y la cita que resulta nace como **solicitud pendiente de registrar**: aparece
  en la bandeja de CureMD como cualquier otra, y no cuenta como hueco cubierto hasta que se
  registra. Si el paciente ya tenía una cita registrada, lo que se crea es un **cambio
  pendiente**: conserva la hora antigua hasta que alguien lo aplica en CureMD, así que un fallo
  nunca lo deja sin ninguna. Al rechazar o
  vencer, la retención se libera y el hueco puede ofrecerse al siguiente.
- Al recargar, las ofertas vencidas se concilian: la retención se libera y el paciente vuelve
  a estar en espera.

### Panel de sedes

- La **ocupación se cuenta en huecos, no en minutos**: los huecos de 10 minutos que el médico
  ofrece en esa sede durante el periodo, y cuántos están confirmados, solicitados, retenidos o
  libres. La agenda del día se organiza **por sede**, una columna cada una, y cada columna
  dice su horario de consulta ese día o que no pasa consulta allí.
- Las métricas del periodo seleccionado se separan de las de estado actual: pendientes de
  registrar, cambios por aplicar, anulaciones por hacer, pacientes esperando, ofertas
  pendientes y huecos cubiertos.
- *Huecos cubiertos* solo cuenta una oferta aceptada cuando la cita resultante está
  **confirmada y registrada en CureMD** a la hora que se ofreció. Se deriva del estado, así que
  no se duplica al recargar, y no se adelanta a contar un trabajo que aún no se ha hecho.
- No se calcula ningún ahorro económico ni ingreso recuperado: no hay forma honesta de
  estimarlo desde aquí.

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

- **No hay integración con CureMD, ni real ni simulada.** No se llama a ninguna API suya, no
  se inventan endpoints, no se abre su web y no se automatiza su interfaz. «Registrado en
  CureMD» significa exactamente *una persona ha declarado que lo ha hecho a mano*, nada más.
  Si algún día hubiera integración, el sitio por donde entraría es `schedulingApi.ts`.
- **La disponibilidad es local.** Se calcula solo con lo que esta demo conoce. No sabe nada de
  lo que haya en CureMD ni en ninguna otra agenda, así que puede ofrecer una hora que allí
  estuviera ocupada. Por eso la web dice que la hora está sujeta a confirmación y la cita no
  se confirma hasta que una persona lo ha comprobado.
- **Un paciente por hueco es un supuesto**, puesto provisionalmente a la espera del dato real.
  Es configurable por sede.
- **Esto no es una historia clínica.** El volante son casillas en blanco para rellenar a
  mano. La demo no guarda, no genera y no interpreta ningún signo vital, y no debe
  presentarse como un sistema capaz de hacerlo.
- **No se puede saber si algo se imprimió.** El diálogo del navegador puede cancelarse, así
  que la demo registra «impresión solicitada» y nunca «impreso».
- **Los consultorios son datos de ejemplo** y no aumentan la capacidad de citas del médico.
- **El horario semanal del médico es inventado**, igual que todo lo demás. Es coherente y
  editable, pero no corresponde a la agenda de nadie.
- **No se atribuye al Dr. Lorba ninguna credencial**: ni titulación, ni colegiación, ni
  certificación, ni premios, ni años de ejercicio, ni afiliación hospitalaria. Su retrato es
  una fotografía de banco de imágenes y está etiquetada como ilustrativa allí donde aparece.
- **No hay backend.** Ninguna petición sale del navegador.
- **No se envía nada**: ni correo, ni SMS, ni recordatorios, tampoco las ofertas de la lista
  de espera. El resguardo de la solicitud y la vista previa del mensaje lo dicen expresamente,
  y la respuesta del paciente se simula a mano. La web **nunca** dice «cita confirmada» ni
  «reserva garantizada» al enviar una solicitud.
- El archivo `.ics` solo se ofrece cuando la cita está **confirmada**, y va marcado como DEMO.
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
- El Dr. Lorba es inventado y su retrato es ilustrativo; está indicado en cada sitio donde
  aparece.
- Los datos desaparecen al cerrar la pestaña: no es almacenamiento duradero.
- Probado en Chromium. No se ha verificado en Safari ni en dispositivos reales.

## Imágenes y recursos

Las cinco fotografías son de **Unsplash**, bajo la
[licencia de Unsplash](https://unsplash.com/license), que permite el uso comercial. La autoría
completa está en `public/images/CREDITS.md`, en `src/data/imageCredits.ts` y publicada en la
propia web, en *Patient information → Image credits*.

La persona fotografiada **no es** el Dr. Lorba, que no existe, y no tiene relación con esta
demo.

Cada archivo se descargó, se recortó, se convirtió a WebP y se le quitaron los metadatos. Tipografías: Newsreader e Inter, servidas por Google Fonts. Iconos: Lucide.

---

## Conectar un backend real

El trabajo está acotado a un archivo. `src/services/schedulingApi.ts` exporta la interfaz
`SchedulingApi` y una implementación de demostración; el resto de la aplicación solo conoce la
interfaz.

```ts
export interface SchedulingApi {
  getState(): Promise<DemoState>
  getDaySlots(search): Promise<Slot[]>
  getDayCounts(search): Promise<Record<DateKey, number>>
  getFirstAvailable(search): Promise<Slot | null>

  // La web pública solo crea solicitudes, nunca citas confirmadas.
  requestAppointment(input): Promise<Result<{ appointment }>>

  // Lo que recepción declara haber hecho a mano en CureMD.
  declareRegistration(id, input): Promise<Result<{ appointment }>>
  declareChangeApplied(id, guard?): Promise<Result<{ appointment }>>
  declareCancellationDone(id, guard?): Promise<Result<{ appointment }>>

  confirmAppointment(id, guard?): Promise<Result<{ appointment }>>
  requestChange(id, slot, guard?): Promise<Result<{ appointment }>>
  abandonChange(id, guard?): Promise<Result<{ appointment }>>
  requestCancellation(id, guard?): Promise<Result<{ appointment }>>
  markUnavailable(id, guard?): Promise<Result<{ appointment }>>
  proposeAlternative(id, slot, guard?): Promise<Result<{ appointment }>>
  acceptProposal(id, guard?): Promise<Result<{ appointment }>>
  setAttendance(id, status, guard?): Promise<Result<{ appointment }>>
  addNote(id, note, guard?): Promise<Result<{ appointment }>>

  joinWaitlist(input): Promise<Result<{ entry }>>
  updateWaitlistPreferences(id, preferences): Promise<Result<{ entry }>>
  withdrawFromWaitlist(id): Promise<Result<{ entry }>>
  candidatesForOpening(openingId): Promise<Candidate[]>
  offerOpening(openingId, entryId): Promise<Result<{ offer }>>
  respondToOffer(offerId, response): Promise<Result<{ offer; appointment }>>
  dismissOpening(id): Promise<Result<{ opening }>>

  loadScenario(): Promise<DemoState>
  reset(): Promise<DemoState>
}
```

Casi todas las escrituras aceptan un `guard` con `expectedVersion`: si la ficha ha cambiado
desde que se abrió el diálogo, la operación se rechaza en vez de pisar el cambio ajeno. El
objeto que devuelven es una copia, no una referencia viva al estado, justamente para que esa
comprobación pueda fallar cuando tiene que fallar.

Para enchufar un sistema real:

1. Escribe otro objeto que cumpla `SchedulingApi` llamando a tu API y cambia la última línea
   del archivo (`export const schedulingApi = …`). No hay que tocar vistas ni stores.
2. `src/services/availability.ts` deja de hacer falta: la disponibilidad la calcularía el
   servidor. Conserva las mismas reglas (horario, margen mínimo, capacidad del hueco) o se
   notará.
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
7. Si algún día hubiera integración con CureMD, los tres métodos `declare*` son el punto
   exacto por el que entraría: pasarían de anotar lo que alguien dice haber hecho a hacerlo
   de verdad, y el estado `pending-registration` dejaría de existir salvo como reintento. El
   resto de la aplicación no se enteraría.

---

## Pruebas

```bash
npm run test       # 121 pruebas unitarias
npm run test:e2e   # 32 recorridos en navegador
```

Las unitarias cubren lo que de verdad puede romperse en silencio: conversión de hora de las
clínicas y cambio de horario de verano, la rejilla de 10 minutos y su determinismo, horarios
de apertura y hora de comida, el margen mínimo, la capacidad del hueco por sede, el archivo
`.ics`, la paridad de las traducciones y la validación del formulario. Una de ellas recorre
**todos los textos de los dos idiomas** y falla si alguno vuelve a ofrecer al paciente elegir
profesional, o vuelve a nombrar una marca de clínica o un equipo de médicos: es lo más fácil
de dejarse olvidado en una frase suelta.

`tests/doctorSchedule.test.ts` cubre la agenda única: que los bloques no se solapen, que
dejen el margen de traslado, que cada bloque caiga dentro del horario de apertura de su
clínica, que la rejilla no ofrezca el mismo minuto en dos sedes, que los descansos se
salten, que la suma de las capacidades de las tres sedes sea exactamente su jornada contada
una vez, que «cualquier sede» devuelva su primera hora libre de verdad, que una cita en una
sede bloquee las horas incompatibles de las otras dos y que el hueco solo se libere cuando la
cancelación se declara hecha en CureMD.

`tests/careFlow.test.ts` cubre la visita: que la llegada y la sala se registren en una sola
acción con hora y operador, que pulsar dos veces no duplique nada, que se pueda llegar sin sala,
que una sala de otra sede o ya ocupada se rechace **sin registrar la llegada**, que registrar
una llegada **no** toque la tarea pendiente en CureMD ni confirme nada, que no se pueda
registrar llegada sobre una cita anulada; que corregir el consultorio libere el anterior y
quede como corrección, que no se pueda corregir hacia una sala ocupada ni después de terminar;
que finalizar registre la salida, libere la sala y complete la cita **solo** cuando eso sigue
siendo coherente, que deje intacto lo pendiente en CureMD y que sea inofensivo pulsarlo dos
veces; y que pedir el volante dos veces no cambie absolutamente nada.

`tests/curemdFlow.test.ts` cubre el circuito manual: la tabla de coherencia entre los dos estados,
la imposibilidad de confirmar sin registro previo, el registro manual con su sello de
operador, hora y referencia, que una anulación pendiente **no** libere el hueco y que una
declarada hecha sí lo libere, el cambio pendiente que conserva la hora antigua, el rechazo de
una escritura cuya `expectedVersion` ha quedado atrás, y que las métricas no cuenten un hueco
cubierto hasta que el reemplazo está registrado.

También siguen cubiertas la lista de espera —alta y baja, detección de candidatos, exclusión
del incompatible, la retención durante una oferta, la aceptación, la sustitución de una cita
posterior, el rechazo y el vencimiento— y las métricas del panel después de cada acción.

`e2e/journey.spec.ts` recorre la parte pública: que la web se presente como la consulta del
Dr. Lorba —logotipo, titular, los dos CTA, una sola ficha de médico y ninguna mención a
«Lorba Medical» ni a un equipo—, que el horario de consulta se muestre aparte del horario de
apertura, que **en ningún sitio** se pida elegir profesional y que el médico aparezca como
dato fijo en el resumen, que las horas vengan de 10 en 10, que antes de enviar se diga que la hora está
sujeta a confirmación, que el final sea una solicitud y no una reserva confirmada y sin `.ics`,
ir y volver entre pasos sin perder datos, los campos obligatorios y el correo inválido, el
selector rápido y el enlace desde una sede, y la persistencia al recargar y al cambiar de
idioma.

`e2e/clinicFlow.spec.ts` recorre la clínica por dentro: que la tarjeta muestre solo lo
necesario y **ninguno** de los botones del flujo antiguo, el diálogo único de llegada con sala
y el aviso de CureMD pendiente, las salas ocupadas marcadas dentro de ese diálogo, llegar sin
sala, corregir el consultorio desde el menú secundario, finalizar la visita —salida, sala
libre, cita completada, paciente en el listado de finalizadas— y que al finalizar la tarea de
CureMD siga ahí; más el volante: que lleve todos sus campos y **ningún** dato de contacto o de
seguro, que diga «Por asignar» cuando no hay sala, que se imprima en el otro idioma sin tocar
la cita, y que pedirlo dos veces no mueva ni el estado ni la sala.

`e2e/curemd.spec.ts` recorre la de mostrador: la bandeja con sus tres clases de trabajo
ordenadas por antigüedad, el registro manual con su historial y la confirmación que lo sigue,
la anulación que no libera el hueco hasta declararse hecha, el cambio que conserva la hora
registrada, la oferta de lista de espera sobre el hueco ya libre, la aceptación que vuelve a
entrar en la bandeja como pendiente de registrar, el caso de la paciente que ya tenía cita y
la restauración de los datos.

### Qué se ha comprobado y qué no

Ejecutado: `vue-tsc --noEmit` sin errores, las 121 unitarias, `npm run build` y los 32
recorridos de navegador, todos en verde. Un barrido automático comprobó además 96 pantallas
—las seis pestañas de recepción y seis páginas públicas, en inglés y en español, a 375, 768,
1024 y 1440 px— sin desbordamiento horizontal y sin errores de consola, más la vista previa del
volante a esos mismos cuatro anchos en los dos idiomas.

**La impresión sí se ha comprobado**, aunque no en una impresora: se generó el PDF A5 que
produce el navegador, en inglés y en español, y se revisó la imagen resultante. Ambos ocupan
**una sola página**, en negro sobre blanco, con la aplicación oculta y sin cortes. Lo que no se
ha hecho es mandarlo a una impresora física ni probar el diálogo de impresión de otros
navegadores.

No comprobado: Safari, Firefox ni dispositivos físicos; tampoco hay auditoría de
accesibilidad con lector de pantalla real, solo roles y foco revisados a mano.

**Pendiente, y a propósito:** los vídeos y las locuciones de `video/` son material generado
en una fase anterior y hablan todavía de «Lorba Medical» y de varios profesionales. Los
guiones que los producen (`scripts/film.mjs`, `scripts/narrate.mjs`) ya están actualizados,
pero los archivos de salida habría que volver a generarlos y, en el caso de las locuciones,
reescribir el texto: no es un renombrado.
