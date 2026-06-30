import dayjs from "@calcom/dayjs";
import type { CalendarEvent, Person } from "@calcom/types/Calendar";

import { BaseScheduledEmail } from "./BaseScheduledEmail";

export const AttendeeScheduledEmail = (
  props: {
    calEvent: CalendarEvent;
    attendee: Person;
  } & Partial<React.ComponentProps<typeof BaseScheduledEmail>>
) => {
  const isConsulenza = true;

  const meetLink =
    props.calEvent.videoCallData?.url ||
    (typeof props.calEvent.location === "string" && props.calEvent.location.startsWith("https://")
      ? props.calEvent.location
      : null);

  const startTime = dayjs(props.calEvent.startTime).tz(props.attendee.timeZone);
  const dateStr = startTime.format("DD/MM/YYYY");
  const timeStr = startTime.format("HH:mm");

  const customMessage = isConsulenza ? (
    <div style={{ fontFamily: "sans-serif", fontSize: "14px", color: "#374151", lineHeight: "1.7", marginTop: "28px", borderTop: "1px solid #e5e7eb", paddingTop: "24px" }}>
        <div style={{background:'#fef3c7', padding:'8px', fontSize:'10px', fontFamily:'monospace', wordBreak:'break-all', marginBottom:'12px'}}>
          loc: {String(props.calEvent.location)}<br/>
          vcd: {String(props.calEvent.videoCallData?.url)}<br/>
          desc: {String((props.calEvent as any).description).substring(0, 300)}
        </div>     
      <p style={{ margin: "0 0 12px 0" }}>Gentile Cliente,</p>
      <p style={{ margin: "0 0 12px 0" }}>
        con la presente Le confermo che la Sua richiesta di consulenza legale in videochiamata è stata registrata con successo.
      </p>
      <p style={{ margin: "0 0 8px 0" }}>Di seguito i dettagli dell'incontro:</p>
      <ul style={{ margin: "0 0 16px 0", paddingLeft: "20px" }}>
        <li style={{ marginBottom: "8px" }}>
          <strong>Data e Ora:</strong> {dateStr} alle ore {timeStr}
        </li>
        <li style={{ marginBottom: "8px" }}>
          <strong>Collegamento alla Videochiamata:</strong> Per accedere all'incontro nel giorno e all'orario stabiliti, Le basterà cliccare sul seguente link protetto:{" "}
          {meetLink
            ? <a href={meetLink} style={{ color: "#2E8B8B", wordBreak: "break-all" }}>{meetLink}</a>
            : "il link sarà disponibile nell'invito calendario"
          }
        </li>
      </ul>
      <p style={{ margin: "0 0 12px 0" }}>
        Al fine di garantire un'analisi chirurgica e mirata della Sua situazione e ottimizzare il tempo a nostra disposizione, La invito a inoltrare in tempi utili – e preferibilmente almeno 24/48 ore prima dell'incontro – eventuale documentazione in Suo possesso (es. atti giudiziari, denunce, provvedimenti, messaggi o relazioni tecniche).
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        Può rispondere direttamente a questa e-mail allegando i files in formato pdf (qualsiasi documento inviato in formato fotografico non verrà preso in considerazione).
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        Questo mi permetterà di esaminare accuratamente il materiale prima del nostro colloquio.
      </p>
      <p style={{ margin: "0 0 12px 0" }}>
        Le ricordo che la fattura relativa al pagamento da Lei effettuato Le verrà recapitata in modalità elettronica all'indirizzo e-mail o al codice SDI da Lei indicato.
      </p>
      <p style={{ margin: "0 0 20px 0" }}>
        Rimanendo a Sua disposizione per qualsiasi chiarimento, Le porgo i miei migliori saluti.
      </p>
      <p style={{ margin: "0" }}>
        <img
          src="https://staging.difesamaltrattamenti.it/logo_firma.png"
          alt="Avv. Antonella Potenza – difesamaltrattamenti.it"
          width="220"
          style={{ display: "block", maxWidth: "100%", height: "auto" }}
        />
      </p>
    </div>
  ) : undefined;

  return (
    <BaseScheduledEmail
      locale={props.attendee.language.locale}
      timeZone={props.attendee.timeZone}
      t={props.attendee.language.translate}
      timeFormat={props.attendee?.timeFormat}
      subject={isConsulenza
        ? "Conferma prenotazione consulenza legale online – Difesamaltrattamenti.it"
        : undefined
      }
      hideDefaultContent={isConsulenza}
      customMessage={customMessage}
      {...props}
    />
  );
};
