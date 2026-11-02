# Guion de presentación — 3 minutos

Para quien enseñe la demo. Los tiempos son orientativos; lo importante es el orden, porque
cada paso prepara el siguiente.

**Antes de empezar:** `npm run dev`, abre `http://localhost:5173` en pantalla completa y, si
has estado probando, entra en `/demo/reception` y pulsa *Restaurar datos de ejemplo*. Ten la
pestaña de recepción abierta en segundo plano para no hacer esperar a nadie al final.

---

## 0:00 — La web (35 s)

Abre la portada y baja despacio.

> «Esto es Lorba Medical, una consulta ficticia con tres clínicas de barrio. Todo lo que van
> a ver está inventado: la marca, los profesionales y las citas.»

Qué señalar:

- El titular y la fotografía: tono cercano, sin promesas ni estadísticas inventadas.
- Los cuatro tipos de consulta, cada uno con su duración.
- El aviso de demo, arriba del todo, visible pero sin estorbar.

Cambia a **ES** en la cabecera y vuelve a **EN**.

> «La web está completa en inglés y español, y cambiar de idioma no pierde nada de lo que el
> paciente haya elegido.»

## 0:35 — Comparar sedes (30 s)

Entra en **Locations**.

> «Tres sedes, cada una con su horario y su forma de llegar. No hay direcciones postales a
> propósito, para que no se confunda con ninguna consulta real.»

Señala el plano que acompaña a cada sede:

> «Cada sede lleva un esquema de su entorno: el puerto y el casco viejo en Downtown, la
> biblioteca y sus jardines en Northside, el parque en Westside. Son dibujos, no mapas: la
> demo no apunta a ninguna dirección real.»

Señala el indicador *Open now / Closed now* y añade:

> «El horario de las clínicas es zona horaria de Nueva York, y el sitio muestra siempre esa
> hora, esté donde esté el paciente.»

Pulsa **Book at this clinic** en una sede.

> «La sede ya viene elegida.»

## 1:05 — Reservar (70 s)

Vas a entrar en el asistente con la sede puesta. Completa los cuatro pasos sin prisa:

1. **Consulta** — elige *Annual wellness* y *This is my first appointment*.
   > «Solo el tipo de consulta y si es la primera visita. Nunca pedimos síntomas ni historia
   > clínica por internet.»
2. **Sede y profesional** — elige *First available*.
   > «Cada profesional muestra su próximo hueco real, calculado sobre la agenda, para poder
   > comparar. Y "el primero disponible" es eso: el hueco más próximo con cualquiera.»
3. **Día y hora** — elige un día del calendario y una hora.
   > «El calendario dice cuántos huecos tiene cada día. Nunca ofrece horas pasadas ni fuera
   > del horario de apertura.»
4. **Tus datos** — pulsa **Use sample details**.
   > «Para la demostración hay un botón que rellena datos de ejemplo. Nombre, apellidos,
   > correo y, opcional, teléfono. No pedimos póliza, documento ni tarjeta.»

Pulsa **Confirm booking**.

> «Queda reservado, con su referencia. Y lo dice claro: es una reserva simulada y no se ha
> enviado ningún correo ni SMS, porque no se ha enviado.»

Enseña **Add to calendar (.ics)** sin descargarlo (o descárgalo si quieres abrirlo).

> «El archivo de calendario va marcado como DEMO y con la hora correcta de la clínica.»

**Apunta la referencia.** Te hará falta ahora.

## 2:15 — Recepción (45 s)

Pulsa **Change it in the reception demo** (o abre `/demo/reception`).

> «Y esto es lo que ve el mostrador. No es una agenda aparte: es exactamente el mismo estado.
> La cita que acabamos de crear ya está aquí.»

Qué señalar, rápido:

- La cita nueva en la columna de su profesional, en la agenda del día.
- Las tarjetas de resumen: citas del día, pendientes, anuladas, primeras visitas.
- Los filtros por sede, profesional y estado, y la búsqueda por nombre o referencia.

Abre la cita y cambia el estado a **Arrived**.

> «Desde aquí se marca que el paciente ha llegado, se completa o se anula.»

Pulsa **Reschedule**, elige otra hora y confirma.

> «Al reprogramar solo se ofrecen horas realmente libres, así que no se puede crear un
> solape. Y si se anula, el hueco vuelve a la web inmediatamente.»

## 3:00 — Cierre

> «Es una demostración: no hay backend, ni envíos, ni autenticación real, y los datos viven
> en la pestaña del navegador. Toda la lógica de agenda está detrás de una sola interfaz, así
> que conectar un sistema real es sustituir ese archivo.»

---

## Si algo se tuerce

| Problema | Qué hacer |
| --- | --- |
| La agenda sale desordenada de pruebas anteriores | *Restaurar datos de ejemplo* en recepción |
| Un día no tiene huecos | El propio paso ofrece *Next opening*, *Allow any clinician* y *Allow any clinic* — úsalo, queda bien |
| Te preguntan si los profesionales son reales | No: son perfiles de demostración y las fotos son ilustrativas; está escrito en la página de equipo |
| Te preguntan por seguros aceptados | La demo no afirma que se acepte ninguno: solo pregunta si vas con seguro o pagas directamente |

## Si hay tiempo extra

- **Patient information** → primera visita, pago y preguntas frecuentes, con los créditos de
  las imágenes al final.
- Reducir la ventana a tamaño móvil durante la reserva: el calendario y las horas están
  pensados para el pulgar.
- Recargar a mitad del asistente para enseñar que no se pierde nada.

---

# Guion de 2 minutos — cubrir una cancelación

El recorrido operativo, para el dueño de las clínicas. Son clics exactos; nada que escribir.

**Antes de empezar:** abre `/demo/reception` y pulsa *Restaurar datos de ejemplo* →
*Sí, restaurar*. Déjalo en **Resumen**. Pantalla completa.

### 0:00 — El punto de partida (20 s)

Estás en **Resumen**, periodo *Hoy*.

> «Esto es lo que ve el dueño: las tres sedes, con su ocupación calculada sobre los minutos
> que ofrecen sus profesionales.»

Señala, en **Ahora mismo**: *Pacientes esperando: 3*, *Huecos por cubrir: 0*,
*Huecos cubiertos con la lista: 0*.

### 0:20 — Un paciente anula (25 s)

1. Barra lateral → **Abrir la cita preparada para anular**.
   > «Bernard Castille, el jueves a las 10:00 en Downtown.»
2. En el panel de la derecha → **Anular la cita** → **Sí, anular**.

El aviso aparece sobre la agenda:

> «La recepción no tiene que buscar nada: el sistema ya le dice que ese hueco encaja con dos
> pacientes de la lista de espera.»

### 0:45 — Quién encaja, y por qué (25 s)

3. En el aviso → **Ver a quién le encaja**.
4. En *Huecos por cubrir* → botón **2 pacientes encajan con esta hora**.

> «Nadia la primera, porque lleva más tiempo esperando. Y debajo dice por qué encaja cada
> uno: la franja horaria, la sede, el profesional. Henry además adelantaría una cita que ya
> tiene.»

Señala abajo, en *En lista de espera*, a **Iris Lindqvist**:

> «Iris está en la lista pero no aparece como candidata: quiere otra consulta, en otra sede y
> por la tarde. El filtro es el que hace el trabajo.»

### 1:10 — La oferta (25 s)

5. En la fila de **Nadia Okonjo** → **Ofrecer este horario**.

> «Esto es lo que recibiría la paciente, en su idioma. No se envía nada: la demo no manda
> correos ni SMS.»

6. **Ofrecer el horario**.

> «El horario queda retenido: desaparece del calendario público y no se le puede ofrecer a
> nadie más. Aquí abajo dice hasta cuándo.»

### 1:35 — La respuesta y el resultado (25 s)

7. En *Controles de demostración* → **Simular aceptación**.
   > «No hay una paciente real que conteste, así que contestamos nosotros.»
8. **Cerrar**.
9. Barra lateral → **Agenda del día**.
   > «La cita de Nadia ya está en el hueco de las 10:00. La anulada sigue visible, marcada.»
10. Barra lateral → **Resumen**.

> «Y el panel lo recoge: un hueco cubierto con la lista de espera, un paciente menos
> esperando, ninguna retención abierta. Abajo, la secuencia completa con su hora:
> anulación, coincidencias, oferta, aceptación.»

### Cierre

> «El hueco que se habría perdido lo ocupa alguien que ya estaba esperando, y el mostrador
> no ha tenido que llamar a nadie para averiguar a quién le servía.»

---

## Variante: adelantar una cita (si hay tiempo)

En el paso 5, elige **Henry Alvarado** en vez de Nadia. El mensaje sale **en español**, que
es el idioma que pidió, y avisa de que sustituiría a su cita posterior. Al simular la
aceptación, la cita anterior se anula y la nueva se crea en el mismo movimiento: en el
listado aparece una suya anulada y otra confirmada, nunca dos activas.

## Si algo se tuerce

| Problema | Qué hacer |
| --- | --- |
| No aparece la cita preparada | *Cargar escenario de ejemplo* y volver a intentarlo |
| La lista de espera está vacía | *Cargar escenario de ejemplo* (repone los tres pacientes sin borrar lo demás) |
| Quedó una oferta pendiente de un ensayo | Ábrela y pulsa *Simular vencimiento*, o restaura la demo |
| Te preguntan si se envía algo de verdad | No: ni correo ni SMS. La respuesta del paciente la simulamos a mano, y está marcado en pantalla |
