# Guiones de presentación

Dos recorridos, pensados para enseñarlos en este orden:

1. **3 minutos — la web y el mostrador.** Qué ve el paciente y dónde aparece lo que pide.
2. **3 min y medio — la cadena completa con CureMD.** El recorrido operativo, de la solicitud al
   panel actualizado. Es el que interesa al dueño de la consulta.
3. **2 minutos — el paciente dentro de la clínica.** Llegada, consultorio, etapas de atención y
   el volante de papel. Es el que interesa a quien está en el mostrador.

Los tiempos son orientativos; lo importante es el orden, porque cada paso prepara el
siguiente. Todas las etiquetas están escritas tal como aparecen **en español**; si lo enseñas
en inglés, el sitio está igual de completo.

**Antes de empezar:** `npm run dev`, abre `http://localhost:5173` a pantalla completa y, si
has estado probando, entra en `/demo/reception` → *Restaurar datos de ejemplo* → *Sí,
restaurar*. Ten esa pestaña abierta en segundo plano para no hacer esperar a nadie.

**Las dos frases que conviene decir pronto**, porque de ellas cuelga todo lo demás:

> «Esto no es una clínica con una plantilla de médicos: es **su** consulta. Un solo médico en
> tres sitios, así que hay **una agenda**, no tres.»

> «Y el paciente **pide** una hora. No la reserva. La cita no existe de verdad hasta que
> alguien del mostrador la ha metido en CureMD, y eso aquí se ve.»

---

# Guion de 3 minutos — la web y el mostrador

## 0:00 — La web (35 s)

Portada, desplazándote despacio.

> «La consulta del Dr. Lorba. Un médico de familia que pasa consulta en tres sedes de barrio.
> Fíjate en que no hay marca de clínica por ningún sitio: el logotipo es su nombre.»

Señala los dos botones del encabezado:

> «Pedir cita, y conocer al médico. No hay más que decidir, porque no hay entre quién elegir.»

> «Todo esto es inventado: el médico, las sedes y las citas. La foto es ilustrativa y lo dice
> la propia página. No se le atribuye ninguna titulación, colegiación ni años de experiencia,
> y eso es deliberado.»

Señala el conmutador **EN / ES** de la cabecera y cámbialo. Vuelve a inglés.

> «Todo el sitio está en los dos idiomas, y cambiar de idioma no pierde nada de lo que lleves
> hecho. Las horas se muestran en formato de 12 horas en inglés y de 24 en español.»

## 0:35 — El médico y las sedes (35 s)

Menú → **Conozca al Dr. Lorba**.

> «Su presentación, los idiomas en los que atiende y, debajo, su **horario de consulta**:
> dónde está cada día de la semana. Esto no es decorativo: es exactamente el horario del que
> salen las horas que se le ofrecen al paciente.»

Menú → **Sedes**.

> «Y aquí están las dos cosas separadas, que es importante: el **horario de apertura de la
> clínica** y las **horas en las que él está aquí**. Una clínica puede estar abierta un
> martes en el que él está en otra.»

> «Cada sede con cómo llegar y su propio plano del entorno. Es un esquema dibujado a mano,
> no un mapa: no hay direcciones ni teléfonos reales, para que ninguna consulta existente
> pueda confundirse con esta.»

Pulsa **Pedir cita** en una sede: entrarás en el asistente con esa sede ya puesta.

## 1:00 — Pedir una hora (75 s)

Tres pasos y los datos. Sin prisa:

1. **Consulta** — elige *Primera cita* y un tipo de consulta.
   > «Solo el tipo de consulta y si es la primera vez. Nunca se piden síntomas ni historia
   > clínica por internet.»
2. **Sede** — ya viene elegida; señala la frase de debajo y el resumen de la derecha.
   > «No hay selector de médico, porque solo hay uno. Y no por omisión: ahí a la derecha, en
   > el resumen, el Dr. Lorba aparece desde el primer paso como dato fijo.»
3. **Día y hora** — elige un día y una hora.
   > «Las horas van **de diez en diez minutos**, y solo aparecen las horas en las que él está
   > en esta sede. El calendario dice cuántas quedan libres cada día.»

   Si hay tiempo, vuelve atrás y cambia de sede:
   > «Fíjate en que al cambiar de sede cambian los días: no es el mismo calendario con otra
   > etiqueta, es la agenda de una persona repartida entre tres sitios. Y los diez minutos son
   > el paso con el que se ofrecen las horas, no lo que dura la consulta.»

   Señala la frase que hay bajo las horas:
   > «"La fecha y hora seleccionadas están sujetas a confirmación de la clínica." Está dicho
   > **antes** de enviar nada, no después.»
4. **Tus datos** — pulsa **Usar datos de ejemplo**.
   > «Nombre, apellidos, correo y teléfono opcional. No se pide póliza, documento, fecha de
   > nacimiento ni tarjeta.»

Pulsa **Enviar solicitud**.

> «**Solicitud recibida · pendiente de confirmación.** La clínica revisará la disponibilidad
> y confirmará la cita. Fíjate en lo que **no** dice: no dice cita confirmada, no dice reserva garantizada y no dice que se
> haya mandado un correo, porque no se ha mandado ninguno.»

Señala que **no** hay botón de calendario todavía.

> «El archivo .ics aparece cuando la clínica confirma, no antes. Mientras es una solicitud, no
> hay nada que meter en la agenda de nadie.»

**Apunta la referencia.** Te hará falta ahora.

## 2:15 — Dónde ha caído (45 s)

Abre `/demo/reception` → pestaña **Bandeja CureMD**.

> «Y esto es el mostrador. No es otra agenda: es exactamente el mismo estado. La solicitud que
> acabamos de enviar ya está aquí, en la lista de lo que falta por meter en CureMD.»

Busca la referencia que apuntaste en el buscador de la bandeja.

> «Se puede buscar por nombre, por referencia nuestra o por referencia de CureMD, y filtrar
> por sede, por tipo de operación y por día de la cita.»

## 3:00 — Cierre

> «Es una demostración: no hay backend, ni envíos, ni autenticación, **ni conexión con
> CureMD**, y los datos viven en esta pestaña del navegador. Toda la lógica está detrás de una
> sola interfaz, así que conectar un sistema real es sustituir un archivo.»

---

# Guion de 3 min y medio — la cadena completa con CureMD

El recorrido operativo entero: solicitud web → bandeja de pendientes → registro manual
simulado → confirmación → cancelación pendiente → cancelación completada → oferta de lista de
espera → aceptación → registro del reemplazo → panel actualizado.

Son clics exactos y no hay nada que escribir. Dura unos tres minutos y medio a ritmo cómodo.

**Antes de empezar:** `/demo/reception` → *Restaurar datos de ejemplo* → *Sí, restaurar*.
Déjalo en **Resumen**, a pantalla completa.

### 0:00 — El punto de partida (20 s)

Estás en **Resumen**, periodo *Hoy*.

> «Las tres sedes, y la ocupación contada en franjas de diez minutos. Y una cosa importante:
> la capacidad de cada sede son **solo las horas que él pasa allí**. No se multiplica su
> jornada por tres clínicas. Un día que no va a Westside, la capacidad de Westside es cero
> aunque esté abierta.»

> «Por ahora cada franja es un paciente: es un supuesto que pusimos nosotros, y se cambia por
> sede en cuanto me digáis el número real.»

Señala, en **Ahora mismo**: *Por registrar en CureMD: 1*, *Cambios por aplicar: 1*,
*Cancelaciones por hacer: 1*, *Pacientes en lista de espera: 3*, *Huecos cubiertos: 0*.

> «Ese es el trabajo pendiente del mostrador, a la vista. Hoy ese trabajo existe igual, pero
> no está en ninguna pantalla: está en la cabeza de quien atiende.»

### 0:20 — La agenda del día (15 s)

Pestaña **Agenda del día**.

> «Una columna por sede, y cada columna dice su horario de consulta ese día o que hoy no pasa
> consulta allí. Es una sola persona repartida en tres columnas, no tres agendas paralelas:
> por eso nunca verás dos citas suyas a la misma hora en sitios distintos.»

### 0:35 — La bandeja (20 s)

Pestaña **Bandeja CureMD**.

> «Tres clases de trabajo: registrar una cita nueva, aplicar un cambio y retirar una
> cancelación. Ordenadas por lo que lleva más tiempo esperando, no por la fecha de la cita:
> algo pedido hace tres días para dentro de un mes corre más prisa que algo pedido hace diez
> minutos para mañana. Por eso se muestran las dos cosas por separado.»

Señala la advertencia de la cabecera.

> «Y lo dice sin rodeos: esta aplicación **nunca** habla con CureMD. Lo que hay aquí son
> declaraciones de recepción, no una comprobación.»

### 0:55 — Registro manual y confirmación (40 s)

1. Barra lateral → **Abrir la solicitud por registrar**.
   > «Bernard Castille, Downtown. Fíjate en los dos distintivos: la **cita** está *Solicitada*
   > y en **CureMD** está *Por registrar*. Son dos estados distintos y nunca se mezclan. Se
   > distinguen por forma e icono, no solo por color.»
2. **Marcar como registrada**.
   > «El diálogo dice exactamente qué hay que teclear en CureMD, y dice que **no envía nada**:
   > es una anotación de que alguien ya lo ha hecho a mano.»
3. Escribe una referencia cualquiera en **Referencia CureMD** (por ejemplo `CMD-77421`).
4. Marca **He registrado esta cita en CureMD** y deja marcado **Confirmar también la cita**.
5. **Marcar como registrada**.

> «Ahora sí: la cita queda *Confirmada* y en CureMD *Registrada*. Y queda anotado quién lo
> declaró, cuándo y con qué referencia. Si mañana alguien pregunta quién metió esto, está
> escrito.»

Señala **Qué se ha declarado**, abajo en la ficha.

> «Una cosa importante: **no se puede confirmar una cita que no esté registrada en CureMD**.
> El botón no existe hasta entonces. Así no puede haber una cita confirmada al paciente que
> en CureMD no aparezca.»

### 1:35 — Una cancelación que todavía no lo es (35 s)

6. Barra lateral → **Abrir la cancelación pendiente**.
   > «Walter Ibsen. El paciente ha anulado, pero en CureMD su cita **sigue viva**.»

Señala los dos distintivos: la cita sigue *Confirmada*, CureMD dice *Cancelación pendiente*.

7. Pestaña **Lista de espera**. No hay ningún hueco por cubrir.

> «Y esto es lo que hace honesto el sistema: ese hueco **no se ofrece a nadie** todavía.
> Mientras CureMD crea que la cita existe, esa hora está ocupada. Ofrecerla ahora sería
> montar un solape.»

8. Vuelve a **Bandeja CureMD** → en la fila de Walter Ibsen, **Marcar cancelación como
   realizada** → marca la casilla → confirma.

> «Recepción lo ha hecho en CureMD y lo declara aquí. **Ahora** el hueco está libre de
> verdad.»

### 2:10 — La lista de espera (40 s)

9. Pestaña **Lista de espera**. Ya aparece el hueco, con el número real de pacientes que
   encajan.
10. Pulsa **2 pacientes encajan con esta hora**.

> «Nadia la primera, porque lleva más tiempo esperando. Debajo dice por qué encaja cada una:
> la franja horaria y la sede. Marguerite además adelantaría una cita que ya tiene.»

Señala abajo a **Iris Lindqvist**:

> «Iris está en la lista y no aparece como candidata: quiere otra consulta, en otra sede y por
> la tarde. El filtro hace el trabajo, y son reglas escritas: tipo de consulta, sede, fechas,
> días y franja horaria. Nada de diagnóstico, seguro ni ingresos, y no hace falta ninguna IA
> para esto.»

11. En la fila de **Nadia Okonjo** → **Ofrecer este horario**.
    > «Esto es lo que recibiría la paciente, en su idioma. No se envía: la demo no manda
    > correos ni SMS.»
12. **Ofrecer el horario**.
    > «El horario queda retenido quince minutos: desaparece del calendario público y no se le
    > puede ofrecer a nadie más. Aquí dice hasta cuándo.»
13. **Simular que el paciente acepta** → **Cerrar**.
    > «No hay una paciente real que conteste, así que contestamos nosotros.»

### 2:50 — El reemplazo también hay que registrarlo (25 s)

14. Pestaña **Bandeja CureMD**. Ahí está Nadia Okonjo, pendiente de registrar.

> «Y aquí está la parte que se suele olvidar: haber cubierto el hueco **no** significa que esté
> hecho. La cita de Nadia es una solicitud más, y hay que meterla en CureMD como cualquier
> otra. El sistema no deja que eso se pierda.»

15. En su fila → **Marcar como registrada** → marca la casilla → confirma.

### 3:15 — El panel (20 s)

16. Barra lateral → **Resumen**.

> «Ahora el panel lo recoge: un hueco cubierto con la lista de espera, una paciente menos
> esperando, ninguna retención abierta y la bandeja más corta. Abajo, la secuencia completa
> con su hora: la cancelación, la retirada de CureMD, la oferta, la aceptación y el registro.»

Señala *Huecos cubiertos con la lista: 1*.

> «Ese contador solo sube cuando el reemplazo está confirmado **y** registrado en CureMD a la
> hora que se ofreció. No cuenta trabajo que todavía no se ha hecho.»

### Cierre

> «El hueco que se habría perdido lo ocupa alguien que ya estaba esperando; el mostrador no ha
> tenido que llamar a nadie para averiguar a quién le servía; y en ningún momento se ha dicho
> que algo estuviera en CureMD sin que una persona lo hubiera metido allí.»

Y la frase honesta, que conviene decir tú antes de que la pregunten:

> «No hay integración con CureMD. No la hemos simulado ni hemos tocado su web. Esto demuestra
> cómo quedaría el trabajo organizado; el día que haya integración, los tres botones de
> "marcar como hecho" son el sitio exacto por donde entraría.»

---

## Variante: la paciente que ya tiene cita (si hay tiempo)

En el paso 11, elige **Marguerite Oyelaran** en vez de Nadia. El mensaje sale **en español**,
que es el idioma que pidió. Al simular la aceptación, lo que aparece en la bandeja no es un
registro nuevo sino un **cambio por aplicar**:

> «Ella ya tenía una cita, y esa cita está en CureMD. Así que su hora antigua **se mantiene**
> hasta que alguien aplique el cambio allí. Si algo falla por el camino, nunca se queda sin
> ninguna de las dos.»

---

# Guion de 2 minutos — el paciente dentro de la clínica

Para quien está en el mostrador. Empieza con la demo recién restaurada, en
`/demo/reception` → pestaña **Pacientes en clínica**.

La frase con la que conviene abrir:

> «Aquí el mostrador hace tres cosas, y solo tres: registrar la llegada con su consultorio,
> imprimir el volante y finalizar la visita. Lo que pasa dentro del consultorio no se lo
> preguntamos a recepción, porque no lo ve.»

### 0:00 — Quién está en el edificio (25 s)

> «La sala de espera vista desde el mostrador. Quién ha llegado, a qué hora tenía la cita, a
> qué hora llegó de verdad, cuánto lleva aquí y en qué consultorio está.»

Señala las etiquetas de una fila:

> «Y aquí hay **tres cosas distintas** que nunca mezclamos: si está en la clínica, lo que la
> consulta ha acordado con él, y lo que falta por teclear en CureMD. Son tres preguntas
> diferentes, y confundirlas es justo como un mostrador acaba creyéndose algo que no es
> verdad.»

Pulsa la pestaña **Visita finalizada**:

> «Y los que ya se han ido, con su hora de salida. Fíjate en que no ocupan consultorio: al
> finalizar, la sala vuelve a quedar libre.»

### 0:25 — Llega un paciente (45 s)

1. Barra lateral → **Abrir la solicitud por registrar**.
2. En la ficha → **Registrar llegada**.

> «Un solo diálogo, porque es un solo momento. Arriba, el resumen: nombre, referencia, cita,
> sede y tipo de consulta. Es para mirar a quien tienes delante y comprobar que es quien dice
> ser.»

Señala el aviso:

> «Y esto: la cita todavía no está metida en CureMD. Le dejamos registrar la llegada igual,
> porque el paciente está ahí, eso es un hecho. Pero lo dice claro, y **la tarea sigue
> pendiente**. Registrar una llegada no mete nada en CureMD, y finalizar la visita tampoco.»

3. Elige un consultorio de la lista de abajo.

> «Las salas que salen son solo las de **su** sede, y las ocupadas aparecen marcadas y
> deshabilitadas. Si están todas llenas, se registra la llegada y se asigna después.»

4. **Registrar llegada**.

> «Llegada y consultorio en una sola acción. Y en cuanto está, te ofrece el volante, que es lo
> siguiente que ibas a buscar de todas formas.»

### 1:10 — El volante (35 s)

5. **Imprimir el volante**.

> «Esto es lo que se lleva el paciente en la mano. Encabezado del Dr. Lorba, la referencia, el
> nombre, la cita, la hora de llegada, la sede y el consultorio. Si todavía no tiene sala, pone
> *Por asignar*. La referencia de CureMD solo sale si existe.»

Señala los espacios en blanco:

> «Y debajo, casillas **vacías**. Presión, frecuencias, temperatura, saturación, peso, talla,
> observaciones y quién las toma. El sistema no inventa ni un solo valor, no imprime rangos de
> referencia y no interpreta nada: es papel para rellenar a mano. Esto **no** es una historia
> clínica, y no vamos a decir que lo sea.»

6. Pulsa **ES** o **EN** arriba.

> «Se imprime en el idioma que necesite el paciente, sin tocar nada de la cita.»

7. **Abrir el diálogo de impresión** (ciérralo si estás en vivo).

> «Hoja A5, que sale bien en A4, negro sobre blanco, y al imprimir desaparece toda la
> aplicación. Desde ese diálogo también se guarda en PDF. Y reimprimir no crea nada ni cambia
> ningún estado: las veces que haga falta.»

### 1:45 — Corregir y terminar (25 s)

8. En una tarjeta → botón de **más acciones** → **Corregir consultorio**.

> «El consultorio se elige una vez y se queda. Si te equivocaste, se corrige desde aquí, y
> queda registrado como corrección. No es un traslado: es un error que se arregla.»

9. En cualquier paciente → **Finalizar visita**.

> «Una sola acción: apunta la hora de salida, libera el consultorio, lo pasa al listado de
> finalizadas y marca la cita como completada. Y lo que **no** hace: tocar nada de CureMD. Si
> quedaba algo pendiente allí, sigue pendiente.»

### Cierre

> «Una cosa que quiero decir con cuidado: nosotros registramos que se **pidió** la impresión,
> no que se imprimiera. El diálogo del navegador se puede cancelar y no hay forma de saberlo.
> Preferimos que el registro diga la verdad.»

## Si algo se tuerce en este guion

| Problema | Qué hacer |
| --- | --- |
| No hay nadie en la clínica | *Restaurar datos de ejemplo*: la demo abre con pacientes dentro y una visita ya terminada |
| Todas las salas salen ocupadas | Finaliza una visita y la sala queda libre al instante, o usa *Decidir el consultorio más tarde* |
| «¿Esto guarda los signos vitales?» | No. Son casillas en papel. La demo no guarda, no genera y no interpreta ningún valor |
| «¿Tres salas no son más citas?» | No. La capacidad sale del horario del Dr. Lorba y de nada más |
| «¿Y si el paciente se mueve de sala?» | No lo seguimos. Recepción anota dónde entra; lo de dentro no lo ve y no se lo preguntamos |
| El diálogo de impresión no aparece | Algunos navegadores lo bloquean en pantallas pequeñas; enseña la vista previa, que es idéntica a lo que sale impreso |

## Si algo se tuerce (cualquiera de los guiones)

| Problema | Qué hacer |
| --- | --- |
| No aparece la pieza preparada | *Cargar escenario de ejemplo* y volver a intentarlo |
| La lista de espera está vacía | *Cargar escenario de ejemplo* (repone los tres pacientes sin borrar lo demás) |
| Quedó una oferta pendiente de un ensayo | Ábrela y pulsa *Simular vencimiento*, o restaura la demo |
| La agenda sale revuelta de pruebas anteriores | *Restaurar datos de ejemplo* en recepción |
| Un día no tiene huecos | El propio paso ofrece *Próxima hora libre* y *Permitir cualquier sede* — úsalo, queda bien |
| «¿Esto escribe en CureMD?» | No. Ni escribe, ni lee, ni abre su web. Son anotaciones de lo que una persona dice haber hecho |
| «¿Entonces la hora que ofrece la web está libre en CureMD?» | No lo sabemos, y por eso la web dice que está sujeta a confirmación y la cita no se confirma hasta que alguien lo comprueba |
| «¿Cuántos pacientes caben por hueco?» | Uno, de momento, porque es el supuesto que pusimos. Es configurable por sede y no está repartido por profesional |
| «¿El Dr. Lorba existe?» | No: es un médico ficticio y la foto es ilustrativa, de banco de imágenes. Está escrito en su página |
| «¿Qué titulación tiene?» | La demo no le atribuye ninguna, a propósito. Esos datos los pondríais vosotros |
| «¿Y si mañana son dos médicos?» | La agenda está en un solo archivo (`src/data/doctor.ts`). Añadir un segundo médico sería trabajo, no un parche, y conviene decirlo así |
| «¿Puede estar en dos sedes a la vez?» | No, y está comprobado: los bloques no se solapan y hay 45 minutos de margen para desplazarse |
| Te preguntan por seguros aceptados | La demo no afirma que se acepte ninguno: solo pregunta si vas con seguro o pagas directamente |

## Si hay tiempo extra

- **Información para pacientes** → primera visita, pago y preguntas frecuentes, con los
  créditos de las imágenes al final.
- Reducir la ventana a tamaño móvil durante la solicitud: el calendario y las horas están
  pensados para el pulgar.
- Recargar a mitad del asistente para enseñar que no se pierde nada.
- En la bandeja, abrir un diálogo, dejarlo abierto y cambiar la misma ficha desde el listado:
  la operación se rechaza en vez de pisar el cambio del otro.
- En *Pacientes en clínica*, finalizar una visita: el consultorio queda libre al instante para
  la siguiente llegada.
