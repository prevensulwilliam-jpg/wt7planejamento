/**
 * Parser de extrato de consórcio Ademicon
 * Envia PDF para wisely-ai (Gemini) para extração inteligente dos dados
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
      // Remove "data:application/pdf;base64," prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Função principal: envia PDF para wisely-ai e retorna dados estruturados
 */
export async function parseConsortiumExtrato(file: File): Promise<ConsortiumExtratoData> {
  const base64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("wisely-ai", {
    body: {
      action: "extract-consortium",
      imageBase64: base64,
      mediaType: "application/pdf",
    },
  });

  if (error) throw new Error("Erro na edge function: " + error.message);
  if (!data?.ok) throw new Error(data?.error || "Erro ao extrair dados do extrato");

  return data.data as ConsortiumExtratoData;
}
