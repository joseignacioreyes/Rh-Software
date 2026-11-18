"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarConfiguracion2fa, iniciarConfiguracion2fa } from "../acciones";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { claseBotonPrimario, claseError, claseEtiqueta, claseInput } from "@/components/ui/estilos";

type Datos = { factorId: string; qr: string; secreto: string };

export default function Configurar2fa() {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    iniciarConfiguracion2fa().then((r) => ("error" in r ? setError(r.error) : setDatos(r)));
  }, []);

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!datos) return;
    iniciar(async () => {
      const r = await confirmarConfiguracion2fa(datos.factorId, codigo);
      if (r.error) setError(r.error);
      else router.replace("/mi-mes");
    });
  }

  return (
    <MarcoAcceso
      titulo="Activa tu segundo factor"
      subtitulo="Como contador o asistente manejas datos de muchas empresas y trabajadores. Por eso pedimos un código adicional al ingresar."
    >
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-texto-suave">
        <li>Instala una app autenticadora en tu teléfono (Google Authenticator o Microsoft Authenticator).</li>
        <li>Escanea este código QR con la app.</li>
        <li>Escribe el código de 6 números que aparece.</li>
      </ol>
      <div className="mb-4 flex min-h-48 items-center justify-center rounded-md border border-borde bg-white p-2">
        {datos ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={datos.qr} alt="Código QR para la app autenticadora" className="h-44 w-44" />
        ) : (
          <span className="text-sm text-texto-suave">{error ? "" : "Generando código…"}</span>
        )}
      </div>
      {datos && (
        <p className="mb-4 break-all text-center text-xs text-texto-suave">
          ¿No puedes escanear? Escribe esta clave en la app: <span className="font-mono text-texto">{datos.secreto}</span>
        </p>
      )}
      <form onSubmit={confirmar} className="space-y-4">
        <div>
          <label htmlFor="codigo" className={claseEtiqueta}>Código de la app</label>
          <input
            id="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className={`${claseInput} numeros text-center text-lg tracking-[0.4em]`}
          />
        </div>
        {error && <p role="alert" className={claseError}>{error}</p>}
        <button type="submit" disabled={!datos || pendiente} className={`${claseBotonPrimario} w-full`}>
          {pendiente ? "Confirmando…" : "Activar y continuar"}
        </button>
      </form>
    </MarcoAcceso>
  );
}
