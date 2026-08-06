import https from "https";
import fs from "fs";
import { promisify } from "util";

interface SoapRequestOptions {
  url: string;
  xml: string;
  certPath: string;
  certPassword: string;
  envelope?: boolean; // envolver em SOAP Envelope (padrão: true)
  soapVersion?: "1.1" | "1.2"; // padrão: "1.2"
  soapAction?: string;
}

const ENVELOPE_12 = '<?xml version="1.0" encoding="UTF-8"?>\n<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>%s</soap12:Body></soap12:Envelope>';
const ENVELOPE_11 = '<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>%s</soap:Body></soap:Envelope>';

export async function soapRequest({ url, xml, certPath, certPassword, envelope = true, soapVersion = "1.2", soapAction }: SoapRequestOptions): Promise<string> {
  const { protocol, hostname, pathname, port } = new URL(url);
  if (protocol !== "https:") {
    throw new Error("O webservice da prefeitura deve ser HTTPS.");
  }

  let pfx: Buffer | undefined;
  if (fs.existsSync(certPath)) {
    pfx = fs.readFileSync(certPath);
  }

  const corpo = envelope
    ? (soapVersion === "1.1" ? ENVELOPE_11 : ENVELOPE_12).replace("%s", () => xml)
    : xml;

  const options: https.RequestOptions = {
    hostname,
    port: port || 443,
    path: pathname,
    method: "POST",
    pfx,
    passphrase: certPassword,
    headers: {
      "Content-Type":
        envelope && soapVersion === "1.2" ? 'application/soap+xml; charset=utf-8' : 'text/xml; charset=utf-8',
      SOAPAction: soapAction ?? "",
      "Content-Length": Buffer.byteLength(corpo),
    },
  };

  return new Promise<string>((resolve, reject) => {
    const req = https.request(options, (res) => {
      let corpo = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (corpo += chunk));
      res.on("end", () => resolve(corpo));
    });
    req.on("error", reject);
    req.write(corpo);
    req.end();
  });
}

// Mantém promisify importado (disponível para leitura síncrona auxiliar)
export const readFileAsync = promisify(fs.readFile);
