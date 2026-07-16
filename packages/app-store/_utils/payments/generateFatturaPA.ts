function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseAddress(raw: string): { indirizzo: string; cap: string; comune: string } {
  const capMatch = raw.match(/\b(\d{5})\b/);
  const cap = capMatch ? capMatch[1] : "00000";
  const cityMatch = raw.match(/\d{5}\s+([^,]+)/);
  const comune = cityMatch ? cityMatch[1].trim() : raw.split(",").pop()?.trim() || "ND";
  const indirizzo = raw.split(",")[0]?.trim() || raw;
  return { indirizzo, cap, comune };
}

export interface FatturaPAParams {
  invoiceNumber: string;
  date: Date;
  clientName: string;
  clientCF: string;
  clientAddress: string;
}

export function generateFatturaPA(params: FatturaPAParams): string {
  const { invoiceNumber, date, clientName, clientCF, clientAddress } = params;
  const dateStr = date.toISOString().split("T")[0];
  const progressivo = invoiceNumber.replace("/", "-");

  const nameParts = clientName.trim().split(" ");
  const cognome = nameParts.length > 1 ? nameParts.pop()! : clientName;
  const nome = nameParts.join(" ") || cognome;

  const { indirizzo, cap, comune } = parseAddress(clientAddress);

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12"
  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>01879020517</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${progressivo}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>02004300667</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>PTNNNL86B41A515M</CodiceFiscale>
        <Anagrafica>
          <Nome>Antonella</Nome>
          <Cognome>Potenza</Cognome>
        </Anagrafica>
        <RegimeFiscale>RF19</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Viale delle Milizie n. 22</Indirizzo>
        <CAP>00192</CAP>
        <Comune>Roma</Comune>
        <Provincia>RM</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>${escapeXml(clientCF.toUpperCase())}</CodiceFiscale>
        <Anagrafica>
          <Nome>${escapeXml(nome)}</Nome>
          <Cognome>${escapeXml(cognome)}</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(indirizzo)}</Indirizzo>
        <CAP>${cap}</CAP>
        <Comune>${escapeXml(comune)}</Comune>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${dateStr}</Data>
        <Numero>${escapeXml(invoiceNumber)}</Numero>
        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>2.00</ImportoBollo>
        </DatiBollo>
        <DatiCassaPrevidenziale>
          <TipoCassa>TC01</TipoCassa>
          <AlCassa>4.00</AlCassa>
          <ImportoContributoCassa>5.77</ImportoContributoCassa>
          <ImponibileCassa>144.23</ImponibileCassa>
          <AliquotaIVA>0.00</AliquotaIVA>
          <Ritenuta>NO</Ritenuta>
          <Natura>N2.2</Natura>
        </DatiCassaPrevidenziale>
        <ImportoTotaleDocumento>150.00</ImportoTotaleDocumento>
        <Causale>Operazione effettuata ai sensi dell&apos;art. 1, commi 54-89, L. 190/2014 e ss. mm, non soggetta a ritenuta d&apos;acconto - Regime forfettario. Imposta di bollo assolta virtualmente.</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Prestazione professionale di consulenza legale strategica con Difesamaltrattamenti.it</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>144.23</PrezzoUnitario>
        <PrezzoTotale>144.23</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>144.23</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Art. 1, commi 54-89, L. 190/2014 - Regime forfetario</RiferimentoNormativo>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP08</ModalitaPagamento>
        <ImportoPagamento>150.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
}
