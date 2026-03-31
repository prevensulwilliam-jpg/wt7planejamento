import { useState } from "react";
import { useBankImportHistory, useDownloadStatement, useDeleteStatement, useBankImportStats } from "@/hooks/useBankStatementUpload";
import { formatCurrency, formatDate, formatMonth } from "@/lib/formatters";
import { Download, Trash2, FileText, Calendar, TrendingUp, TrendingDown, Database, HardDrive } from "lucide-react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function ImportHistoryTab({ accounts }: { accounts: any[] }) {
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filePath: string; fileName: string } | null>(null);
  
  const { data: history = [], isLoading } = useBankImportHistory({
    accountId: accountFilter === "all" ? undefined : accountFilter
  });
  
  const stats = useBankImportStats();
  const downloadMutation = useDownloadStatement();
  const deleteMutation = useDeleteStatement();
  
  const handleDownload = (filePath: string, fileName: string) => {
    toast.promise(downloadMutation.mutateAsync(filePath), {
      loading: `Baixando ${fileName}...`,
      success: "Download concluído!",
      error: (err) => err.message
    });
  };
  
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        filePath: deleteTarget.filePath
      });
      toast.success("Extrato deletado com sucesso");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="space-y-6">
      {/* KPIs de estatísticas gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de Uploads"
          value={stats.totalUploads}
          formatAs="number"
          color="gold"
        />
        <KpiCard
          label="Transações Importadas"
          value={stats.totalTransactions}
          formatAs="number"
          color="cyan"
        />
        <KpiCard
          label="Taxa de Duplicidade"
          value={stats.duplicateRate}
          formatAs="number"
          color={stats.duplicateRate > 20 ? "gold" : "green"}
        />
        <KpiCard
          label="Espaço Utilizado"
          value={stats.totalSize}
          formatAs="number"
          color="gray"
        />
      </div>

      <PremiumCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-semibold text-xl" style={{ color: "#F0F4F8" }}>
              <FileText className="inline w-5 h-5 mr-2" style={{ color: "#C9A84C" }} />
              Histórico de Uploads
            </h2>
            <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
              Todos os extratos importados ficam armazenados e podem ser baixados novamente
            </p>
          </div>
          
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-64" style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: "#0D1318", borderColor: "#1A2535" }}>
              <SelectItem value="all" style={{ color: "#F0F4F8" }}>Todas as contas</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id} style={{ color: "#F0F4F8" }}>
                  {a.bank_name} — {a.account_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" style={{ background: "#0D1318" }} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#94A3B8" }}>
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold mb-1">Nenhum extrato importado ainda</p>
            <p className="text-sm">Os extratos que você importar aparecerão aqui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item: any) => (
              <div 
                key={item.id} 
                className="rounded-xl p-5 border transition-all hover:border-[#C9A84C]/30 hover:shadow-lg"
                style={{ background: "#0D1318", borderColor: "#1A2535" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header do arquivo */}
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "#C9A84C" }} />
                      <span className="font-mono text-sm font-semibold truncate" style={{ color: "#F0F4F8" }}>
                        {item.file_name}
                      </span>
                      <WtBadge variant={item.file_type === 'ofx' ? 'success' : 'info'}>
                        {item.file_type?.toUpperCase() || 'CSV'}
                      </WtBadge>
                      <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>
                        {formatFileSize(item.file_size_bytes || 0)}
                      </span>
                    </div>
                    
                    {/* Grid de informações principais */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                      <div>
                        <p className="text-xs uppercase font-mono mb-1" style={{ color: "#94A3B8" }}>Conta</p>
                        <p className="text-sm font-semibold" style={{ color: "#F0F4F8" }}>
                          {item.bank_accounts?.bank_name || "—"}
                        </p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>
                          {item.bank_accounts?.account_type || ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase font-mono mb-1" style={{ color: "#94A3B8" }}>Período</p>
                        <p className="text-sm font-semibold" style={{ color: "#F0F4F8" }}>
                          {formatMonth(item.reference_month)}
                        </p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>
                          {item.period_start && item.period_end 
                            ? `${formatDate(item.period_start)} a ${formatDate(item.period_end)}`
                            : "—"
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase font-mono mb-1" style={{ color: "#94A3B8" }}>Importado</p>
                        <p className="text-sm font-semibold" style={{ color: "#F0F4F8" }}>
                          {formatDate(item.imported_at)}
                        </p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>
                          {new Date(item.imported_at).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase font-mono mb-1" style={{ color: "#94A3B8" }}>Transações</p>
                        <p className="text-sm font-semibold" style={{ color: "#F0F4F8" }}>
                          {item.total_transactions || 0} total
                        </p>
                        <p className="text-xs" style={{ color: "#10B981" }}>
                          {item.new_transactions || 0} novas
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase font-mono mb-1" style={{ color: "#94A3B8" }}>Status</p>
                        <p className="text-sm font-semibold" style={{ color: "#2DD4BF" }}>
                          {item.auto_categorized || 0} auto
                        </p>
                        <p className="text-xs" style={{ color: "#F59E0B" }}>
                          {item.pending_review || 0} pendentes
                        </p>
                      </div>
                    </div>
                    
                    {/* Resumo financeiro e badges */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
                        <span className="text-xs" style={{ color: "#94A3B8" }}>Créditos:</span>
                        <span className="font-mono font-semibold text-sm" style={{ color: "#10B981" }}>
                          {formatCurrency(item.total_credits || 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5" style={{ color: "#F43F5E" }} />
                        <span className="text-xs" style={{ color: "#94A3B8" }}>Débitos:</span>
                        <span className="font-mono font-semibold text-sm" style={{ color: "#F43F5E" }}>
                          {formatCurrency(item.total_debits || 0)}
                        </span>
                      </div>
                      {item.duplicate_transactions > 0 && (
                        <WtBadge variant="warning">
                          {item.duplicate_transactions} duplicadas
                        </WtBadge>
                      )}
                      {item.auto_categorized > 0 && (
                        <WtBadge variant="success">
                          {item.auto_categorized} auto-categorizadas
                        </WtBadge>
                      )}
                    </div>
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleDownload(item.file_path, item.file_name)}
                      disabled={downloadMutation.isPending}
                      className="p-2.5 rounded-lg transition-colors hover:bg-[#C9A84C]/10 disabled:opacity-50"
                      style={{ color: "#C9A84C" }}
                      title="Baixar extrato original"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ 
                        id: item.id, 
                        filePath: item.file_path,
                        fileName: item.file_name 
                      })}
                      className="p-2.5 rounded-lg transition-colors hover:bg-[#F43F5E]/10"
                      style={{ color: "#F43F5E" }}
                      title="Deletar extrato"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumCard>
      
      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent style={{ background: "#0A1118", borderColor: "#1A2535" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "#F0F4F8" }}>
              Deletar extrato permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: "#94A3B8" }}>
              Você está prestes a deletar o arquivo <strong className="text-[#C9A84C]">{deleteTarget?.fileName}</strong>.
              <br /><br />
              ⚠️ Esta ação não pode ser desfeita. O arquivo original será removido do servidor.
              <br /><br />
              ✅ As transações já importadas permanecerão no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              style={{ background: "#0D1318", borderColor: "#1A2535", color: "#F0F4F8" }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-[#F43F5E] hover:bg-[#F43F5E]/90 text-white"
            >
              {deleteMutation.isPending ? "Deletando..." : "Deletar Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
