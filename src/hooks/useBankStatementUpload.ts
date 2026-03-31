import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UploadResult {
  filePath: string;
  publicUrl: string | null;
  fileName: string;
  fileSize: number;
}

export function useBankStatementUpload() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<UploadResult> => {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${timestamp}_${safeName}`;

      const { error } = await supabase.storage
        .from("bank-statements")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw new Error(`Erro no upload: ${error.message}`);

      const { data: urlData } = supabase.storage
        .from("bank-statements")
        .getPublicUrl(filePath);

      return {
        filePath,
        publicUrl: urlData?.publicUrl ?? null,
        fileName: file.name,
        fileSize: file.size,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_import_history"] });
    },
  });
}
