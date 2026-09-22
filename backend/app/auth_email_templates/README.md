# Plantillas de correo de Supabase Auth

Estos NO los manda nuestro backend: los manda Supabase directamente cuando alguien
se registra o pide restablecer su contraseña, con sus propias plantillas. Son
correos aparte de los de `app/emails.py` (que son solo de pedidos).

## Como se aplican

1. Panel de Supabase → **Authentication → Email Templates**.
2. Cada archivo de esta carpeta corresponde a una plantilla: copia y pega el HTML
   completo en el campo "Message body (HTML)" de la plantilla del mismo nombre.
   Las variables `{{ .ConfirmationURL }}` las rellena Supabase solo, no se tocan.
3. **Sin SMTP propio, Supabase manda estos correos desde su propio dominio y con
   un limite muy bajo** (unos 2-4 por hora, pensado solo para pruebas). Para
   producción, en **Authentication → Settings → SMTP Settings**, activa
   "Enable Custom SMTP" y usa las mismas credenciales que `app/emails.py`:

   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: el valor de `SMTP_USER`
   - Password: el valor de `SMTP_PASSWORD` (la clave de aplicacion de 16 digitos)
   - Sender email: el mismo `SMTP_USER`
   - Sender name: `Another NPC Shop`

   Con eso, tanto los correos de pedidos como los de cuenta salen del mismo
   Gmail, sin depender de Resend ni de ningun otro servicio.

## Por que no se hacen desde el backend

Supabase dispara estos correos el solo en el momento del registro o de pedir
restablecer contraseña; reimplementarlo en `emails.py` significaria dejar de
usar la confirmacion de Supabase Auth (o duplicarla). Para un catalogo con dos
plantillas, es mas simple editar el HTML aqui que montar un flujo propio.
