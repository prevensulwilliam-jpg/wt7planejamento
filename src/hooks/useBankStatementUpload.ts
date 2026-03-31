import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ImportStats {
  totalTransactions: number;
  newTransactions: number;
  duplicateTransactions: number;
  autoCategorized: number;
  pendingReview: number;
  totalCredits: number;
  totalDebits: number;
  periodStart: string;
  periodEnd: string;
  referenceMonth: string;
}

export function useBankStatementUpload() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      file, 
      accountId,
      importStats 
    }: { 
      file: File; 
      accountId: string;
      importStats: ImportStats;
    }) => {
      // 1. Gerar nome único para o arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const timeOnly = new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').slice(0, 8);
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${accountId}/${timestamp}_${timeOnly}_${sanitizedName}`;
      
      // 2. Upload para Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw new Error(`Erro ao salvar arquivo: ${uploadError.message}`);
      
      // 3. Registrar no histórico
      const { data: historyData, error: historyError } = await supabase
        .from('bank_import_history')
        .insert({
          file_name: file.name,
          file_path: storagePath,
          file_size_bytes: file.size,
          bank_account_id: accountId,
          file_type: file.name.toLowerCase().endsWith('.ofx') ? 'ofx' : 'csv',
          total_transactions: importStats.totalTransactions,
          new_transactions: importStats.newTransactions,
          duplicate_transactions: importStats.duplicateTransactions,
          auto_categorized: importStats.autoCategorized,
          pending_review: importStats.pendingReview,
          total_credits: importStats.totalCredits,
          total_debits: importStats.totalDebits,
          period_start: importStats.periodStart,
          period_end: importStats.periodEnd,
          reference_month: importStats.referenceMonth,
          metadata: {
            originalFileName: file.name,
            mimeType: file.type,
            uploadedFrom: 'web',
            userAgent: navigator.userAgent
          }
        })
        .select()
        .single();
      
      if (historyError) throw new Error(`Erro ao registrar histórico: ${historyError.message}`);
      
      return { uploadData, historyData };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_import_history'] });
    }
  });
}

export function useBankImportHistory(filters?: { 
  accountId?: string; 
  month?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['bank_import_history', filters],
    queryFn: async () => {
      let q = supabase
        .from('bank_import_history')
        .select('*, bank_accounts(bank_name, account_type)')
        .order('imported_at', { ascending: false });
      
      if (filters?.accountId && filters.accountId !== 'all') {
        q = q.eq('bank_account_id', filters.accountId);
      }
      
      if (filters?.month) {
        q = q.eq('reference_month', filters.month);
      }
      
      if (filters?.limit) {
        q = q.limit(filters.limit);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });
}

export function useDownloadStatement() {
  return useMutation({
    mutationFn: async (filePath: string) => {
      const { data, error } = await supabase.storage
        .from('bank-statements')
        .download(filePath);
      
      if (error) throw new Error(`Erro ao baixar: ${error.message}`);
      
      // Criar URL para download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'extrato.ofx';
      a.click();
      URL.revokeObjectURL(url);
      
      return data;
    }
  });
}

export function useDeleteStatement() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      // 1. Deletar do storage
      const { error: storageError } = await supabase.storage
        .from('bank-statements')
        .remove([filePath]);
      
      if (storageError) throw new Error(`Erro ao deletar arquivo: ${storageError.message}`);
      
      // 2. Deletar registro do histórico
      const { error: dbError } = await supabase
        .from('bank_import_history')
        .delete()
        .eq('id', id);
      
      if (dbError) throw new Error(`Erro ao deletar registro: ${dbError.message}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_import_history'] });
    }
  });
}

export function useBankImportStats() {
  const { data: history = [] } = useBankImportHistory();
  
  const totalUploads = history.length;
  const totalTransactions = history.reduce((sum: number, h: any) => sum + (h.total_transactions || 0), 0);
  const totalNewTransactions = history.reduce((sum: number, h: any) => sum + (h.new_transactions || 0), 0);
  const totalDuplicates = history.reduce((sum: number, h: any) => sum + (h.duplicate_transactions || 0), 0);
  const totalSize = history.reduce((sum: number, h: any) => sum + (h.file_size_bytes || 0), 0);
  
  return {
    totalUploads,
    totalTransactions,
    totalNewTransactions,
    totalDuplicates,
    totalSize,
    duplicateRate: totalTransactions > 0 ? (totalDuplicates / totalTransactions) * 100 : 0
  };
}
