/**
 * Parser de extrato de consórcio (PDF ou imagem)
 * Envia para wisely-ai (Gemini) para extração inteligente dos dados
 */

import { supabase } from "@/integrations/supabase/client";

export interface ConsortiumExtratoData {
  group_number?: string;
  quota?: string;
  contract_number?: string;
  admin_fee_pct?: number;
  asset_type?: string;
  credit_value?: number;
  adhesion_date?: string;
  end_date?: string;
  installments_total?: number;
  installments_paid?: number;
  installments_remaining?: number;
  total_paid?: number;
  total_pending?: number;
  fund_paid?: number;
  admin_fee_paid?: number;
  insurance_paid?: number;
  monthly_payment?: number;
  total_value?: number;
}

/**
 * Converte File para base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Detecta mediaType a partir do arquivo
 */
function getMediaType(file: File): string {
  const ext = file.name.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return file.type || "application/octet-stream";
  }
}

/**
 * Função principal: envia PDF ou imagem para wisely-ai e retorna dados estruturados
 */
export async function parseConsortiumExtrato(file: File): Promise<ConsortiumExtratoData> {
  const base64 = await fileToBase64(file);
  const mediaType = getMediaType(file);

  const { data, error } = await supabase.functions.invoke("wisely-ai", {
    body: {
      action: "extract-consortium",
      imageBase64: base64,
      mediaType,
    },
  });

  if (error) throw new Error("Erro na edge function: " + error.message);
  if (!data?.ok) throw new Error(data?.error || "Erro ao extrair dados do extrato");

  return data.data as ConsortiumExtratoData;
}
